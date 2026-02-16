/**
 * Extension Setup Logic
 * 
 * Handles initialization and configuration validation.
 */

import { SecureStorage } from '@/lib/secure-storage';
import { uiStateStore } from '@/lib/ui-state-db';
import type { ExtensionConfig } from './config';
import { defaultConfig } from './config';
import { ExtensionAPI } from './api';

const EXTENSION_NAME = 'extension-name'; // Match manifest.json name

/**
 * Check if extension setup is complete
 */
export async function isSetupComplete(): Promise<boolean> {
  try {
    // Check if required config exists
    const config = await uiStateStore.getExtensionConfig(EXTENSION_NAME);
    if (!config) {
      return false;
    }

    // Check if API token exists in secure storage
    const token = await SecureStorage.getItem(EXTENSION_NAME, 'apiToken');
    if (!token) {
      return false;
    }

    return true;
  } catch (error) {
    console.error('[ExtensionSetup] Failed to check setup:', error);
    return false;
  }
}

/**
 * Save extension configuration
 */
export async function saveConfig(config: ExtensionConfig, apiToken?: string): Promise<void> {
  try {
    // Save non-sensitive config to IndexedDB
    await uiStateStore.saveExtensionConfig(EXTENSION_NAME, config);

    // Save sensitive token to encrypted storage
    if (apiToken) {
      await SecureStorage.setItem(EXTENSION_NAME, 'apiToken', apiToken);
    }

    console.log(`[ExtensionSetup] Configuration saved for ${EXTENSION_NAME}`);
  } catch (error) {
    console.error('[ExtensionSetup] Failed to save config:', error);
    throw error;
  }
}

/**
 * Load extension configuration
 */
export async function loadConfig(): Promise<ExtensionConfig> {
  try {
    // Load config from IndexedDB
    const config = await uiStateStore.getExtensionConfig(EXTENSION_NAME);
    
    // Merge with defaults
    return { ...defaultConfig, ...config };
  } catch (error) {
    console.error('[ExtensionSetup] Failed to load config:', error);
    return defaultConfig;
  }
}

/**
 * Get API token from secure storage
 */
export async function getApiToken(): Promise<string | null> {
  try {
    return await SecureStorage.getItem(EXTENSION_NAME, 'apiToken');
  } catch (error) {
    console.error('[ExtensionSetup] Failed to get API token:', error);
    return null;
  }
}

/**
 * Initialize extension
 */
export async function initialize(): Promise<ExtensionAPI | null> {
  try {
    const config = await loadConfig();
    const apiToken = await getApiToken();

    if (!apiToken) {
      console.warn('[ExtensionSetup] No API token found');
      return null;
    }

    // Create API client
    const api = new ExtensionAPI({ ...config, apiToken });
    
    // Test connection
    const connected = await api.testConnection();
    if (!connected) {
      console.error('[ExtensionSetup] Connection test failed');
      return null;
    }

    console.log(`[ExtensionSetup] ${EXTENSION_NAME} initialized successfully`);
    return api;
  } catch (error) {
    console.error('[ExtensionSetup] Initialization failed:', error);
    return null;
  }
}

/**
 * Cleanup extension resources
 */
export async function cleanup(): Promise<void> {
  try {
    // Perform cleanup (close connections, clear caches, etc.)
    console.log(`[ExtensionSetup] ${EXTENSION_NAME} cleaned up`);
  } catch (error) {
    console.error('[ExtensionSetup] Cleanup failed:', error);
  }
}
