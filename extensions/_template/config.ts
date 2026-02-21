/**
 * Extension Configuration Interface
 *
 * Define the configuration structure for your extension.
 * This will be stored in IndexedDB and can be modified via the onboarding panel.
 */

export interface ExtensionConfig {
  // API credentials
  apiToken?: string;
  apiUrl?: string;

  // User preferences
  enabled?: boolean;
  refreshInterval?: number;

  // Add your extension-specific config fields here
  [key: string]: any;
}

/**
 * Default configuration values
 */
export const defaultConfig: ExtensionConfig = {
  enabled: true,
  refreshInterval: 60000, // 1 minute
};
