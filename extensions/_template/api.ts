/**
 * Extension API Client
 *
 * Read-only API client for fetching data from external services.
 * All methods should be read-only - no mutations, writes, or actions.
 */

import type { ExtensionConfig } from "./config";

export class ExtensionAPI {
  private config: ExtensionConfig;

  constructor(config: ExtensionConfig) {
    this.config = config;
  }

  /**
   * Test API connection
   * Called during onboarding to validate credentials
   */
  async testConnection(): Promise<boolean> {
    try {
      // Implement connection test
      // Example: fetch a simple endpoint to verify auth
      return true;
    } catch (error) {
      console.error("[ExtensionAPI] Connection test failed:", error);
      return false;
    }
  }

  /**
   * Fetch data for status bar
   * Should return data that can be displayed in the status bar
   */
  async getStatusData(): Promise<any> {
    try {
      // Implement status data fetching
      // Example: fetch count of items, recent notifications, etc.
      return null;
    } catch (error) {
      console.error("[ExtensionAPI] Failed to fetch status data:", error);
      return null;
    }
  }

  /**
   * Search for taggable items
   * @param query - Search query from user input
   */
  async searchItems(_query: string): Promise<any[]> {
    try {
      // Implement item search
      // Example: search PRs, issues, deployments, etc.
      return [];
    } catch (error) {
      console.error("[ExtensionAPI] Failed to search items:", error);
      return [];
    }
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<ExtensionConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
}
