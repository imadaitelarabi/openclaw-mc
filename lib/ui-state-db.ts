/**
 * UI State Database
 * IndexedDB storage for UI-only state (NOT chat history)
 * Stores: scroll positions, drafts, tool card states, last-seen messages
 */

import { openDB, DBSchema, IDBPDatabase } from 'idb';

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
}

class UIStateStore {
  private dbPromise: Promise<IDBPDatabase<UIStateDB>>;

  constructor() {
    this.dbPromise = openDB<UIStateDB>('openclaw-ui-state', 1, {
      upgrade(db) {
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
      },
    });
  }

  // Draft message management
  async saveDraft(agentId: string, text: string): Promise<void> {
    try {
      const db = await this.dbPromise;
      await db.put('drafts', { text, timestamp: Date.now() }, agentId);
    } catch (err) {
      console.error('[UIState] Failed to save draft:', err);
    }
  }

  async getDraft(agentId: string): Promise<string | null> {
    try {
      const db = await this.dbPromise;
      const draft = await db.get('drafts', agentId);
      return draft?.text || null;
    } catch (err) {
      console.error('[UIState] Failed to get draft:', err);
      return null;
    }
  }

  async clearDraft(agentId: string): Promise<void> {
    try {
      const db = await this.dbPromise;
      await db.delete('drafts', agentId);
    } catch (err) {
      console.error('[UIState] Failed to clear draft:', err);
    }
  }

  // Scroll position management
  async saveScrollPosition(agentId: string, position: number): Promise<void> {
    try {
      const db = await this.dbPromise;
      await db.put('scroll-positions', { position, timestamp: Date.now() }, agentId);
    } catch (err) {
      console.error('[UIState] Failed to save scroll position:', err);
    }
  }

  async getScrollPosition(agentId: string): Promise<number | null> {
    try {
      const db = await this.dbPromise;
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
      const db = await this.dbPromise;
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
      const db = await this.dbPromise;
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
      const db = await this.dbPromise;
      await db.put('last-seen', { messageId, timestamp: Date.now() }, agentId);
    } catch (err) {
      console.error('[UIState] Failed to save last seen:', err);
    }
  }

  async getLastSeen(agentId: string): Promise<string | null> {
    try {
      const db = await this.dbPromise;
      const lastSeen = await db.get('last-seen', agentId);
      return lastSeen?.messageId || null;
    } catch (err) {
      console.error('[UIState] Failed to get last seen:', err);
      return null;
    }
  }

  // Clear all UI state for an agent
  async clearAgentState(agentId: string): Promise<void> {
    try {
      const db = await this.dbPromise;
      await Promise.all([
        db.delete('scroll-positions', agentId),
        db.delete('drafts', agentId),
        db.delete('last-seen', agentId),
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
}

// Export singleton instance
export const uiStateStore = new UIStateStore();
