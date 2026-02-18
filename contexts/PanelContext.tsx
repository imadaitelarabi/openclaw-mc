"use client";

import { createContext, useContext, useState, useCallback, ReactNode, useEffect, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { Panel, PanelType, PanelLayout, PanelSettings } from '@/types';
import { uiStateStore, type WorkspaceState } from '@/lib/ui-state-db';

interface PanelContextValue {
  layout: PanelLayout;
  openPanel: (type: PanelType, data?: any) => Promise<string>;
  closePanel: (panelId: string) => void;
  setActivePanel: (panelId: string) => void;
  updatePanel: (panelId: string, updates: Partial<Panel>) => void;
  updatePanelSettings: (panelId: string, settings: Partial<PanelSettings>) => void;
  updatePanelSessionSettings: (panelId: string, sessionSettings: { model?: string; modelProvider?: string; thinking?: 'off' | 'low' | 'medium' | 'high' }) => void;
  getActivePanel: () => Panel | undefined;
}

const PanelContext = createContext<PanelContextValue | undefined>(undefined);

export function usePanels() {
  const context = useContext(PanelContext);
  if (!context) {
    throw new Error('usePanels must be used within a PanelProvider');
  }
  return context;
}

interface PanelProviderProps {
  children: ReactNode;
  maxPanels?: number;
}

export function PanelProvider({ children, maxPanels = 2 }: PanelProviderProps) {
  const [layout, setLayout] = useState<PanelLayout>({
    panels: [],
    maxPanels,
    activePanel: null
  });
  const [isRestored, setIsRestored] = useState(false);

  // Default panel settings
  const getDefaultSettings = (): PanelSettings => ({
    showTools: false,     // Verbose mode off by default
    showReasoning: true   // Reasoning on by default
  });

  // Restore workspace state on mount
  useEffect(() => {
    const restoreWorkspace = async () => {
      try {
        const state = await uiStateStore.getWorkspaceState();
        if (state && state.openPanels && state.openPanels.length > 0) {
          console.log('[PanelContext] Restoring workspace state:', state);
          
          // Reconstruct panels from saved state
          const restoredPanels: Panel[] = state.openPanels.map(savedPanel => ({
            id: savedPanel.panelId,
            type: savedPanel.type as PanelType,
            title: savedPanel.title,
            agentId: savedPanel.agentId,
            data: savedPanel.data || (savedPanel.agentId ? { agentId: savedPanel.agentId, agentName: savedPanel.title } : {}),
            isActive: savedPanel.panelId === state.activePanelId,
            settings: savedPanel.settings || getDefaultSettings()
          }));

          setLayout({
            panels: restoredPanels,
            maxPanels,
            activePanel: state.activePanelId
          });
        }
      } catch (err) {
        console.error('[PanelContext] Failed to restore workspace:', err);
      } finally {
        setIsRestored(true);
      }
    };

    restoreWorkspace();
  }, [maxPanels]);

  // Save workspace state when layout changes (debounced)
  useEffect(() => {
    if (!isRestored) return; // Don't save until we've restored

    const timeoutId = setTimeout(() => {
      const saveWorkspace = async () => {
        try {
          const state: WorkspaceState = {
            openPanels: layout.panels.map(panel => ({
              panelId: panel.id,
              type: panel.type,
              agentId: panel.agentId,
              title: panel.title,
              data: panel.data,
              settings: panel.settings || getDefaultSettings()
            })),
            activePanelId: layout.activePanel,
            timestamp: Date.now()
          };
          
          await uiStateStore.saveWorkspaceState(state);
          console.log('[PanelContext] Saved workspace state');
        } catch (err) {
          console.error('[PanelContext] Failed to save workspace:', err);
        }
      };

      saveWorkspace();
    }, 500); // Debounce 500ms

    return () => clearTimeout(timeoutId);
  }, [layout, isRestored]);

  /**
   * Opens a new panel with the specified type and data.
   * For chat panels, loads persisted settings from IndexedDB before panel creation
   * to prevent UI flash with default settings.
   * @returns Promise that resolves to the new panel's ID
   */
  const openPanel = useCallback(async (type: PanelType, data?: any): Promise<string> => {
    const panelId = uuidv4();
    
    // For chat panels, load persisted settings before creating the panel
    let panelSettings = getDefaultSettings();
    if (type === 'chat' && data?.agentId) {
      try {
        const savedSettings = await uiStateStore.getPanelSettings(data.agentId);
        if (savedSettings) {
          panelSettings = savedSettings;
        }
      } catch (err) {
        console.error('[PanelContext] Failed to load panel settings:', err);
      }
    }
    
    setLayout(prev => {
      let currentLayout = prev;
      
      // Check if we've reached the max panels
      if (currentLayout.panels.length >= currentLayout.maxPanels) {
        // Remove the oldest inactive panel
        const inactivePanels = currentLayout.panels.filter(p => !p.isActive);
        if (inactivePanels.length > 0) {
          // Remove the first inactive panel
          const toRemove = inactivePanels[0];
          currentLayout = {
            ...currentLayout,
            panels: currentLayout.panels.filter(p => p.id !== toRemove.id)
          };
        } else {
          // All panels are active, remove the first one
          currentLayout = {
            ...currentLayout,
            panels: currentLayout.panels.slice(1)
          };
        }
      }

      // Generate title based on type and data
      let title = '';
      switch (type) {
        case 'chat':
          title = data?.agentName || 'Chat';
          break;
        case 'create-agent':
          title = 'Create New Agent';
          break;
        case 'update-agent':
          title = `Edit ${data?.agentName || 'Agent'}`;
          break;
        case 'agent-list':
          title = 'Agents';
          break;
        case 'extension-onboarding':
          title = `${data?.extensionName || 'Extension'} Setup`;
          break;
        case 'cron':
          title = data?.jobName ? `Cron: ${data.jobName}` : 'Cron Job';
          break;
        case 'create-cron':
          title = 'Create Cron Job';
          break;
        case 'update-cron':
          title = data?.jobName ? `Edit ${data.jobName}` : 'Edit Cron Job';
          break;
        default:
          title = type;
      }

      const newPanel: Panel = {
        id: panelId,
        type,
        title,
        agentId: data?.agentId,
        data: data || {},
        isActive: true,
        settings: panelSettings,
        // Initialize session settings for chat panels
        sessionKey: type === 'chat' && data?.agentId ? `agent:${data.agentId}:main` : undefined,
        model: data?.model,
        modelProvider: data?.modelProvider,
        thinking: data?.thinking || 'low'
      };

      // Set all existing panels to inactive
      const updatedPanels = currentLayout.panels.map(p => ({ ...p, isActive: false }));

      return {
        ...currentLayout,
        panels: [...updatedPanels, newPanel],
        activePanel: panelId
      };
    });

    return panelId;
  }, []);

  const closePanel = useCallback((panelId: string) => {
    setLayout(prev => {
      const panelIndex = prev.panels.findIndex(p => p.id === panelId);
      if (panelIndex === -1) return prev;

      const newPanels = prev.panels.filter(p => p.id !== panelId);
      
      // If closing the active panel, activate the last remaining panel
      let newActivePanel = prev.activePanel;
      if (prev.activePanel === panelId) {
        if (newPanels.length > 0) {
          // Activate the panel before the closed one, or the first panel
          const newIndex = Math.max(0, panelIndex - 1);
          newActivePanel = newPanels[newIndex]?.id || null;
          newPanels[newIndex] = { ...newPanels[newIndex], isActive: true };
        } else {
          newActivePanel = null;
        }
      }

      return {
        ...prev,
        panels: newPanels,
        activePanel: newActivePanel
      };
    });
  }, []);

  const setActivePanel = useCallback((panelId: string) => {
    setLayout(prev => {
      const panel = prev.panels.find(p => p.id === panelId);
      if (!panel) return prev;

      return {
        ...prev,
        panels: prev.panels.map(p => ({
          ...p,
          isActive: p.id === panelId
        })),
        activePanel: panelId
      };
    });
  }, []);

  const updatePanel = useCallback((panelId: string, updates: Partial<Panel>) => {
    setLayout(prev => ({
      ...prev,
      panels: prev.panels.map(p =>
        p.id === panelId ? { ...p, ...updates } : p
      )
    }));
  }, []);

  const updatePanelSettings = useCallback((panelId: string, settings: Partial<PanelSettings>) => {
    setLayout(prev => {
      const panel = prev.panels.find(p => p.id === panelId);
      
      // If this is a chat panel, persist settings to IndexedDB
      if (panel?.type === 'chat' && panel.agentId) {
        const updatedSettings = { ...panel.settings, ...settings } as PanelSettings;
        uiStateStore.savePanelSettings(panel.agentId, updatedSettings).catch(err => {
          console.error('[PanelContext] Failed to save panel settings:', err);
        });
      }
      
      return {
        ...prev,
        panels: prev.panels.map(p =>
          p.id === panelId ? { 
            ...p, 
            settings: { ...p.settings, ...settings } as PanelSettings
          } : p
        )
      };
    });
  }, []);

  const updatePanelSessionSettings = useCallback((panelId: string, sessionSettings: { model?: string; modelProvider?: string; thinking?: 'off' | 'low' | 'medium' | 'high' }) => {
    setLayout(prev => ({
      ...prev,
      panels: prev.panels.map(p =>
        p.id === panelId ? { 
          ...p,
          model: sessionSettings.model !== undefined ? sessionSettings.model : p.model,
          modelProvider: sessionSettings.modelProvider !== undefined ? sessionSettings.modelProvider : p.modelProvider,
          thinking: sessionSettings.thinking !== undefined ? sessionSettings.thinking : p.thinking
        } : p
      )
    }));
  }, []);

  const getActivePanel = useCallback((): Panel | undefined => {
    return layout.panels.find(p => p.id === layout.activePanel);
  }, [layout]);

  return (
    <PanelContext.Provider value={{ 
      layout, 
      openPanel, 
      closePanel, 
      setActivePanel, 
      updatePanel,
      updatePanelSettings,
      updatePanelSessionSettings,
      getActivePanel
    }}>
      {children}
    </PanelContext.Provider>
  );
}
