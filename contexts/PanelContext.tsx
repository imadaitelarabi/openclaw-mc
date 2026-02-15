"use client";

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { Panel, PanelType, PanelLayout } from '@/types';

interface PanelContextValue {
  layout: PanelLayout;
  openPanel: (type: PanelType, data?: any) => string;
  closePanel: (panelId: string) => void;
  setActivePanel: (panelId: string) => void;
  updatePanel: (panelId: string, updates: Partial<Panel>) => void;
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

  const openPanel = useCallback((type: PanelType, data?: any): string => {
    const panelId = uuidv4();
    
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
        default:
          title = type;
      }

      const newPanel: Panel = {
        id: panelId,
        type,
        title,
        agentId: data?.agentId,
        data: data || {},
        isActive: true
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

  return (
    <PanelContext.Provider value={{ layout, openPanel, closePanel, setActivePanel, updatePanel }}>
      {children}
    </PanelContext.Provider>
  );
}
