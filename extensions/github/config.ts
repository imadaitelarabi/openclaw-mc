/**
 * GitHub Extension Configuration
 */

export interface GitHubConfig {
  // API credentials
  token?: string;

  // User preferences
  refreshInterval?: number;
  maxResults?: number;
  showClosed?: boolean;

  // Organization/repository browsing limits
  maxOrganizations?: number;
  maxReposPerOrg?: number;
}

/**
 * Default configuration values
 */
export const defaultConfig: GitHubConfig = {
  refreshInterval: 300000, // 5 minutes
  maxResults: 5,
  showClosed: false,
  maxOrganizations: 8,
  maxReposPerOrg: 6,
};
