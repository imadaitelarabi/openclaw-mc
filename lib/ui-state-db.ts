/**
 * UI State Database
 * IndexedDB storage for UI-only state (NOT chat history)
 * Stores: scroll positions, drafts, tool card states, last-seen messages
 */

import { openDB, DBSchema, IDBPDatabase } from 'idb';
import type { ExtensionState } from '@/types/extension';

// Workspace state interface for persistence
export interface WorkspaceState {
  openPanels: Array<{
    panelId: string;
    type: string;
    agentId?: string;
    title: string;
    settings: {
      showTools: boolean;
      showReasoning: boolean;
    };
  }>;
  activePanelId: string | null;
  timestamp: number;
}

interface UIStateDB extends DBSchema {
  'scroll-positions': {
    key: string; // agentId
    value: { position: number; timestamp: number };
  };
  'drafts': {
    key: string; // agentId
    value: { text: string; timestamp: number };
  };
  'tool-cards': {
    key: string; // `${agentId}:${runId}:${toolName}`
    value: { expanded: boolean };
  };
  'last-seen': {
    key: string; // agentId
    value: { messageId: string; timestamp: number };
  };
  'stream-states': {
    key: string; // agentId
    value: {
      runId: string;
      assistantStream: string;
      reasoningStream: string;
      timestamp: number;
    };
  };
  'workspace': {
    key: string; // 'current'
    value: WorkspaceState;
  };
  'extension-states': {
    key: string; // extension name
    value: ExtensionState;
  };
  'extension-configs': {
    key: string; // extension name
    value: { config: any; timestamp: number };
  };
}

class UIStateStore {
  private dbPromise: Promise<IDBPDatabase<UIStateDB>> | null = null;

  private getDB(): Promise<IDBPDatabase<UIStateDB>> {
    // Only initialize in browser environment
    if (typeof window === 'undefined' || typeof indexedDB === 'undefined') {
      return Promise.reject(new Error('IndexedDB not available (SSR environment)'));
    }

    if (!this.dbPromise) {
      this.dbPromise = openDB<UIStateDB>('openclaw-ui-state', 4, {
        upgrade(db, oldVersion) {
          // Create object stores if they don't exist
          if (!db.objectStoreNames.contains('scroll-positions')) {
            db.createObjectStore('scroll-positions');
          }
          if (!db.objectStoreNames.contains('drafts')) {
            db.createObjectStore('drafts');
          }
          if (!db.objectStoreNames.contains('tool-cards')) {
            db.createObjectStore('tool-cards');
          }
          if (!db.objectStoreNames.contains('last-seen')) {
            db.createObjectStore('last-seen');
          }
          if (!db.objectStoreNames.contains('stream-states')) {
            db.createObjectStore('stream-states');
          }
          // Add workspace store in version 3
          if (oldVersion < 3 && !db.objectStoreNames.contains('workspace')) {
            db.createObjectStore('workspace');
          }
          // Add extension stores in version 4
          if (oldVersion < 4) {
            if (!db.objectStoreNames.contains('extension-states')) {
              db.createObjectStore('extension-states');
            }
            if (!db.objectStoreNames.contains('extension-configs')) {
              db.createObjectStore('extension-configs');
            }
          }
        },
      });
    }

    return this.dbPromise;
  }

  // Draft message management
  async saveDraft(agentId: string, text: string): Promise<void> {
    try {
      const db = await this.getDB();
      await db.put('drafts', { text, timestamp: Date.now() }, agentId);
    } catch (err) {
      console.error('[UIState] Failed to save draft:', err);
    }
  }

  async getDraft(agentId: string): Promise<string | null> {
    try {
      const db = await this.getDB();
      const draft = await db.get('drafts', agentId);
      return draft?.text || null;
    } catch (err) {
      console.error('[UIState] Failed to get draft:', err);
      return null;
    }
  }

  async clearDraft(agentId: string): Promise<void> {
    try {
      const db = await this.getDB();
      await db.delete('drafts', agentId);
    } catch (err) {
      console.error('[UIState] Failed to clear draft:', err);
    }
  }

  // Scroll position management
  async saveScrollPosition(agentId: string, position: number): Promise<void> {
    try {
      const db = await this.getDB();
      await db.put('scroll-positions', { position, timestamp: Date.now() }, agentId);
    } catch (err) {
      console.error('[UIState] Failed to save scroll position:', err);
    }
  }

  async getScrollPosition(agentId: string): Promise<number | null> {
    try {
      const db = await this.getDB();
      const pos = await db.get('scroll-positions', agentId);
      return pos?.position ?? null;
    } catch (err) {
      console.error('[UIState] Failed to get scroll position:', err);
      return null;
    }
  }

  // Tool card expand/collapse state
  async saveToolCardState(
    agentId: string,
    runId: string,
    toolName: string,
    expanded: boolean
  ): Promise<void> {
    try {
      const db = await this.getDB();
      const key = `${agentId}:${runId}:${toolName}`;
      await db.put('tool-cards', { expanded }, key);
    } catch (err) {
      console.error('[UIState] Failed to save tool card state:', err);
    }
  }

  async getToolCardState(
    agentId: string,
    runId: string,
    toolName: string
  ): Promise<boolean | null> {
    try {
      const db = await this.getDB();
      const key = `${agentId}:${runId}:${toolName}`;
      const state = await db.get('tool-cards', key);
      return state?.expanded ?? null;
    } catch (err) {
      console.error('[UIState] Failed to get tool card state:', err);
      return null;
    }
  }

  // Last seen message tracking (for unread badges)
  async saveLastSeen(agentId: string, messageId: string): Promise<void> {
    try {
      const db = await this.getDB();
      await db.put('last-seen', { messageId, timestamp: Date.now() }, agentId);
    } catch (err) {
      console.error('[UIState] Failed to save last seen:', err);
    }
  }

  async getLastSeen(agentId: string): Promise<string | null> {
    try {
      const db = await this.getDB();
      const lastSeen = await db.get('last-seen', agentId);
      return lastSeen?.messageId || null;
    } catch (err) {
      console.error('[UIState] Failed to get last seen:', err);
      return null;
    }
  }

  // Active typing stream state (for refresh recovery during in-progress runs)
  async saveStreamState(
    agentId: string,
    runId: string,
    assistantStream: string,
    reasoningStream: string
  ): Promise<void> {
    try {
      const db = await this.getDB();
      await db.put(
        'stream-states',
        {
          runId,
          assistantStream,
          reasoningStream,
          timestamp: Date.now(),
        },
        agentId
      );
    } catch (err) {
      console.error('[UIState] Failed to save stream state:', err);
    }
  }

  async getAllStreamStates(): Promise<Array<{
    agentId: string;
    runId: string;
    assistantStream: string;
    reasoningStream: string;
    timestamp: number;
  }>> {
    try {
      const db = await this.getDB();
      const tx = db.transaction('stream-states', 'readonly');
      const store = tx.objectStore('stream-states');
      const keys = await store.getAllKeys();
      const values = await store.getAll();
      await tx.done;

      return keys
        .map((key, index) => {
          const value = values[index];
          if (typeof key !== 'string' || !value?.runId) {
            return null;
          }

          return {
            agentId: key,
            runId: value.runId,
            assistantStream: value.assistantStream || '',
            reasoningStream: value.reasoningStream || '',
            timestamp: value.timestamp || Date.now(),
          };
        })
        .filter((item): item is {
          agentId: string;
          runId: string;
          assistantStream: string;
          reasoningStream: string;
          timestamp: number;
        } => item !== null);
    } catch (err) {
      console.error('[UIState] Failed to get stream states:', err);
      return [];
    }
  }

  async clearStreamState(agentId: string): Promise<void> {
    try {
      const db = await this.getDB();
      await db.delete('stream-states', agentId);
    } catch (err) {
      console.error('[UIState] Failed to clear stream state:', err);
    }
  }

  // Clear all UI state for an agent
  async clearAgentState(agentId: string): Promise<void> {
    try {
      const db = await this.getDB();
      await Promise.all([
        db.delete('scroll-positions', agentId),
        db.delete('drafts', agentId),
        db.delete('last-seen', agentId),
        db.delete('stream-states', agentId),
      ]);
      
      // Clear all tool cards for this agent
      const tx = db.transaction('tool-cards', 'readwrite');
      const store = tx.objectStore('tool-cards');
      const keys = await store.getAllKeys();
      
      for (const key of keys) {
        if (typeof key === 'string' && key.startsWith(`${agentId}:`)) {
          await store.delete(key);
        }
      }
      
      await tx.done;
    } catch (err) {
      console.error('[UIState] Failed to clear agent state:', err);
    }
  }

  // Workspace state management for panel persistence
  async saveWorkspaceState(state: WorkspaceState): Promise<void> {
    try {
      const db = await this.getDB();
      await db.put('workspace', state, 'current');
    } catch (err) {
      console.error('[UIState] Failed to save workspace state:', err);
    }
  }

  async getWorkspaceState(): Promise<WorkspaceState | null> {
    try {
      const db = await this.getDB();
      const state = await db.get('workspace', 'current');
      return state || null;
    } catch (err) {
      console.error('[UIState] Failed to get workspace state:', err);
      return null;
    }
  }

  async clearWorkspaceState(): Promise<void> {
    try {
      const db = await this.getDB();
      await db.delete('workspace', 'current');
    } catch (err) {
      console.error('[UIState] Failed to clear workspace state:', err);
    }
  }

  // Extension state management
  async saveExtensionState(state: ExtensionState): Promise<void> {
    try {
      const db = await this.getDB();
      await db.put('extension-states', state, state.name);
    } catch (err) {
      console.error('[UIState] Failed to save extension state:', err);
    }
  }

  async getExtensionState(extensionName: string): Promise<ExtensionState | null> {
    try {
      const db = await this.getDB();
      const state = await db.get('extension-states', extensionName);
      return state || null;
    } catch (err) {
      console.error('[UIState] Failed to get extension state:', err);
      return null;
    }
  }

  async getAllExtensionStates(): Promise<ExtensionState[]> {
    try {
      const db = await this.getDB();
      const states = await db.getAll('extension-states');
      return states;
    } catch (err) {
      console.error('[UIState] Failed to get all extension states:', err);
      return [];
    }
  }

  async deleteExtensionState(extensionName: string): Promise<void> {
    try {
      const db = await this.getDB();
      await db.delete('extension-states', extensionName);
    } catch (err) {
      console.error('[UIState] Failed to delete extension state:', err);
    }
  }

  // Extension config management
  async saveExtensionConfig(extensionName: string, config: any): Promise<void> {
    try {
      const db = await this.getDB();
      await db.put('extension-configs', { config, timestamp: Date.now() }, extensionName);
    } catch (err) {
      console.error('[UIState] Failed to save extension config:', err);
    }
  }

  async getExtensionConfig(extensionName: string): Promise<any | null> {
    try {
      const db = await this.getDB();
      const data = await db.get('extension-configs', extensionName);
      return data?.config || null;
    } catch (err) {
      console.error('[UIState] Failed to get extension config:', err);
      return null;
    }
  }

  async deleteExtensionConfig(extensionName: string): Promise<void> {
    try {
      const db = await this.getDB();
      await db.delete('extension-configs', extensionName);
    } catch (err) {
      console.error('[UIState] Failed to delete extension config:', err);
    }
  }
}

// Export singleton instance
export const uiStateStore = new UIStateStore();
