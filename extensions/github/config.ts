/**
 * GitHub Extension Configuration
 */

export interface GitHubConfig {
  // API credentials
  token?: string;
  
  // Repository settings
  owner?: string;
  repo?: string;
  
  // User preferences
  refreshInterval?: number;
  maxResults?: number;
  showClosed?: boolean;
}

/**
 * Default configuration values
 */
export const defaultConfig: GitHubConfig = {
  refreshInterval: 300000, // 5 minutes
  maxResults: 10,
  showClosed: false,
};
