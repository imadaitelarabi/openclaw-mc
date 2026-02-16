/**
 * GitHub API Client
 * 
 * Read-only client for fetching GitHub data.
 */

import type { GitHubConfig } from './config';

export interface GitHubPR {
  number: number;
  title: string;
  state: 'open' | 'closed';
  html_url: string;
  user: {
    login: string;
  };
  created_at: string;
  updated_at: string;
}

export interface GitHubIssue {
  number: number;
  title: string;
  state: 'open' | 'closed';
  html_url: string;
  user: {
    login: string;
  };
  created_at: string;
  updated_at: string;
  labels: Array<{ name: string; color: string }>;
}

export class GitHubAPI {
  private config: GitHubConfig;
  private baseURL = 'https://api.github.com';

  constructor(config: GitHubConfig) {
    this.config = config;
  }

  /**
   * Make authenticated request to GitHub API
   */
  private async request<T>(endpoint: string): Promise<T> {
    const { token } = this.config;
    
    if (!token) {
      throw new Error('GitHub token not configured');
    }

    const response = await fetch(`${this.baseURL}${endpoint}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json',
      },
    });

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Test API connection
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.request('/user');
      return true;
    } catch (error) {
      console.error('[GitHubAPI] Connection test failed:', error);
      return false;
    }
  }

  /**
   * Get open pull requests for configured repo
   */
  async getPullRequests(): Promise<GitHubPR[]> {
    const { owner, repo, maxResults = 10 } = this.config;
    
    if (!owner || !repo) {
      return [];
    }

    try {
      const prs = await this.request<GitHubPR[]>(
        `/repos/${owner}/${repo}/pulls?state=open&per_page=${maxResults}`
      );
      return prs;
    } catch (error) {
      console.error('[GitHubAPI] Failed to fetch pull requests:', error);
      return [];
    }
  }

  /**
   * Get open issues for configured repo
   */
  async getIssues(): Promise<GitHubIssue[]> {
    const { owner, repo, maxResults = 10 } = this.config;
    
    if (!owner || !repo) {
      return [];
    }

    try {
      const issues = await this.request<GitHubIssue[]>(
        `/repos/${owner}/${repo}/issues?state=open&per_page=${maxResults}`
      );
      // Filter out PRs (GitHub API includes PRs in issues endpoint)
      return issues.filter(issue => !('pull_request' in issue));
    } catch (error) {
      console.error('[GitHubAPI] Failed to fetch issues:', error);
      return [];
    }
  }

  /**
   * Search pull requests
   */
  async searchPullRequests(query: string): Promise<GitHubPR[]> {
    const { owner, repo } = this.config;
    
    if (!owner || !repo) {
      return [];
    }

    try {
      const searchQuery = `repo:${owner}/${repo} is:pr ${query}`;
      const result = await this.request<{ items: GitHubPR[] }>(
        `/search/issues?q=${encodeURIComponent(searchQuery)}&per_page=5`
      );
      return result.items;
    } catch (error) {
      console.error('[GitHubAPI] Failed to search pull requests:', error);
      return [];
    }
  }

  /**
   * Search issues
   */
  async searchIssues(query: string): Promise<GitHubIssue[]> {
    const { owner, repo } = this.config;
    
    if (!owner || !repo) {
      return [];
    }

    try {
      const searchQuery = `repo:${owner}/${repo} is:issue ${query}`;
      const result = await this.request<{ items: GitHubIssue[] }>(
        `/search/issues?q=${encodeURIComponent(searchQuery)}&per_page=5`
      );
      return result.items;
    } catch (error) {
      console.error('[GitHubAPI] Failed to search issues:', error);
      return [];
    }
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<GitHubConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
}
