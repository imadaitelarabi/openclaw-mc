/**
 * GitHub Extension Setup Logic
 */

import { SecureStorage } from '@/lib/secure-storage';
import { uiStateStore } from '@/lib/ui-state-db';
import type { GitHubConfig } from './config';
import { defaultConfig } from './config';
import { GitHubAPI } from './api';
import type { ExtensionConnectionStatus } from '@/types/extension';

const EXTENSION_NAME = 'github';

/**
 * Check if extension setup is complete
 */
export async function isSetupComplete(): Promise<boolean> {
  try {
    // Check if GitHub token exists in secure storage
    const token = await SecureStorage.getItem(EXTENSION_NAME, 'token');
    if (!token) {
      return false;
    }

    return true;
  } catch (error) {
    console.error('[GitHubSetup] Failed to check setup:', error);
    return false;
  }
}

/**
 * Save extension configuration
 */
export async function saveConfig(config: GitHubConfig, token?: string): Promise<void> {
  try {
    // Save non-sensitive config to IndexedDB
    await uiStateStore.saveExtensionConfig(EXTENSION_NAME, config);

    // Save sensitive token to encrypted storage
    if (token) {
      await SecureStorage.setItem(EXTENSION_NAME, 'token', token);
    }

    console.log(`[GitHubSetup] Configuration saved`);
  } catch (error) {
    console.error('[GitHubSetup] Failed to save config:', error);
    throw error;
  }
}

/**
 * Load extension configuration
 */
export async function loadConfig(): Promise<GitHubConfig> {
  try {
    // Load config from IndexedDB
    const config = await uiStateStore.getExtensionConfig(EXTENSION_NAME);
    
    // Merge with defaults
    return { ...defaultConfig, ...config };
  } catch (error) {
    console.error('[GitHubSetup] Failed to load config:', error);
    return defaultConfig;
  }
}

/**
 * Get GitHub token from secure storage
 */
export async function getToken(): Promise<string | null> {
  try {
    return await SecureStorage.getItem(EXTENSION_NAME, 'token');
  } catch (error) {
    console.error('[GitHubSetup] Failed to get token:', error);
    return null;
  }
}

/**
 * Initialize extension
 */
export async function initialize(): Promise<GitHubAPI | null> {
  try {
    const config = await loadConfig();
    const token = await getToken();

    if (!token) {
      console.warn('[GitHubSetup] No GitHub token found');
      return null;
    }

    // Create API client
    const api = new GitHubAPI({ ...config, token });
    
    // Test connection
    const connected = await api.testConnection();
    if (!connected) {
      console.error('[GitHubSetup] Connection test failed');
      return null;
    }

    console.log('[GitHubSetup] GitHub extension initialized successfully');
    return api;
  } catch (error) {
    console.error('[GitHubSetup] Initialization failed:', error);
    return null;
  }
}

/**
 * Check connection status and return user info if connected
 */
export async function checkConnectionStatus(): Promise<ExtensionConnectionStatus> {
  try {
    const token = await getToken();
    
    if (!token) {
      return {
        isConnected: false,
        error: 'No GitHub token configured'
      };
    }

    // Create API client with the token
    const api = new GitHubAPI({ token });
    
    // Test connection and get user info
    try {
      const user = await api.getUser();
      return {
        isConnected: true,
        username: user.login
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Connection failed';
      return {
        isConnected: false,
        error: message
      };
    }
  } catch (error) {
    console.error('[GitHubSetup] Failed to check connection status:', error);
    return {
      isConnected: false,
      error: 'Failed to check connection status'
    };
  }
}

/**
 * Cleanup extension resources
 */
export async function cleanup(): Promise<void> {
  try {
    console.log('[GitHubSetup] GitHub extension cleaned up');
  } catch (error) {
    console.error('[GitHubSetup] Cleanup failed:', error);
  }
}
