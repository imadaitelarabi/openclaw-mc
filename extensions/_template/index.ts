/**
 * Extension Entry Point
 * 
 * Main file that registers the extension with Mission Control.
 * Export a setup function that returns the Extension object.
 */

import type { Extension, ExtensionHooks } from '@/types/extension';
import manifest from './manifest.json';
import { initialize, cleanup, isSetupComplete } from './setup';
import { getStatusBarData } from './ui/status-bar';
import { getChatInputOptions } from './ui/chat-input';
import { OnboardingPanel } from './ui/onboarding';
import { ExtensionAPI } from './api';

// API instance (initialized on setup)
let apiInstance: ExtensionAPI | null = null;

/**
 * Extension setup function
 * Called when extension is enabled
 */
async function setup(): Promise<void> {
  console.log(`[Extension] Setting up ${manifest.name}...`);
  
  apiInstance = await initialize();
  
  if (!apiInstance) {
    throw new Error('Failed to initialize extension');
  }
}

/**
 * Extension cleanup function
 * Called when extension is disabled
 */
async function cleanupExtension(): Promise<void> {
  console.log(`[Extension] Cleaning up ${manifest.name}...`);
  
  await cleanup();
  apiInstance = null;
}

/**
 * Extension hooks implementation
 */
const hooks: ExtensionHooks = {
  // Status bar hook
  statusBar: async () => {
    if (!apiInstance) {
      return null;
    }
    return getStatusBarData(apiInstance);
  },

  // Chat input hook
  chatInput: async (query: string) => {
    if (!apiInstance) {
      return [];
    }
    return getChatInputOptions(apiInstance, query);
  },

  // Onboarding hook
  onboarding: {
    isRequired: async () => !(await isSetupComplete()),
    component: OnboardingPanel,
  },
};

/**
 * Extension instance
 */
export const extension: Extension = {
  manifest,
  state: {
    name: manifest.name,
    enabled: false,
    onboarded: false,
    lastUpdated: Date.now(),
  },
  hooks,
  setup,
  cleanup: cleanupExtension,
};

// Default export
export default extension;
