/**
 * GitHub API Client
 *
 * Read-only client for fetching GitHub data.
 */

import type { GitHubConfig } from "./config";

export interface GitHubPR {
  number: number;
  title: string;
  state: "open" | "closed";
  html_url: string;
  user: {
    login: string;
  };
  created_at: string;
  updated_at: string;
  draft?: boolean;
  labels?: Array<{ name: string; color: string }>;
  assignees?: Array<{ login: string }>;
}

export interface GitHubIssue {
  number: number;
  title: string;
  state: "open" | "closed";
  html_url: string;
  user: {
    login: string;
  };
  created_at: string;
  updated_at: string;
  labels: Array<{ name: string; color: string }>;
  assignees?: Array<{ login: string }>;
}

export interface GitHubOrganization {
  login: string;
  type: "Organization" | "User";
}

export interface GitHubRepoRef {
  /** "owner/name" */
  fullName: string;
  owner: string;
  name: string;
}

/** Filters for issues panel searches */
export interface IssueFilters {
  search?: string;
  label?: string;
  author?: string;
  assignee?: string;
}

/** Filters for pull-requests panel searches */
export interface PRFilters extends IssueFilters {
  isDraft?: boolean;
}

export interface GitHubUser {
  login: string;
  name: string | null;
  email: string | null;
  avatar_url: string;
  html_url: string;
}

export interface GitHubRepository {
  id: number;
  name: string;
  full_name: string;
  html_url: string;
  updated_at: string;
  private: boolean;
  owner: {
    login: string;
    type: "Organization" | "User";
  };
}

export class GitHubAPI {
  private config: GitHubConfig;
  private baseURL = "https://api.github.com";

  constructor(config: GitHubConfig) {
    this.config = config;
  }

  /**
   * Make authenticated request to GitHub API
   */
  private async request<T>(endpoint: string): Promise<T> {
    const { token } = this.config;

    if (!token) {
      throw new Error("GitHub token not configured");
    }

    const response = await fetch(`${this.baseURL}${endpoint}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github.v3+json",
      },
    });

    if (!response.ok) {
      let details = response.statusText || "Unknown error";

      try {
        const payload = await response.json();
        if (payload?.message) {
          details = payload.message;
        }
      } catch {
        try {
          const text = await response.text();
          if (text) {
            details = text;
          }
        } catch {}
      }

      throw new Error(`GitHub API ${response.status} on ${endpoint}: ${details}`);
    }

    return response.json();
  }

  /**
   * Test API connection
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.request("/user");
      return true;
    } catch (error) {
      console.error("[GitHubAPI] Connection test failed:", error);
      return false;
    }
  }

  /**
   * Get authenticated user information
   */
  async getUser(): Promise<GitHubUser> {
    return this.request<GitHubUser>("/user");
  }

  /**
   * Get organizations available to the authenticated user.
   * Includes the authenticated user as a pseudo-organization for personal repositories.
   */
  async getOrganizations(): Promise<GitHubOrganization[]> {
    const { maxOrganizations = 8 } = this.config;

    try {
      const [user, orgs] = await Promise.all([
        this.request<{ login: string }>("/user"),
        this.request<Array<{ login: string }>>(
          `/user/orgs?per_page=${Math.max(maxOrganizations, 1)}`
        ),
      ]);

      const organizations: GitHubOrganization[] = [
        { login: user.login, type: "User" },
        ...orgs.map((org) => ({ login: org.login, type: "Organization" as const })),
      ];

      return organizations.slice(0, Math.max(maxOrganizations, 1));
    } catch (error) {
      console.error("[GitHubAPI] Failed to fetch organizations:", error);
      return [];
    }
  }

  /**
   * Get repositories for a specific organization/user.
   */
  async getRepositories(
    owner: string,
    ownerType: "Organization" | "User" = "Organization"
  ): Promise<GitHubRepository[]> {
    const { maxReposPerOrg = 6 } = this.config;

    try {
      const perPage = Math.max(maxReposPerOrg, 1);
      const endpoint =
        ownerType === "User"
          ? `/user/repos?affiliation=owner&sort=updated&per_page=${perPage}`
          : `/orgs/${owner}/repos?sort=updated&per_page=${perPage}`;

      const repos = await this.request<GitHubRepository[]>(endpoint);
      return repos.slice(0, perPage);
    } catch (error) {
      console.error(`[GitHubAPI] Failed to fetch repositories for ${owner}:`, error);
      return [];
    }
  }

  /**
   * Get open pull requests for a specific repository.
   */
  async getPullRequests(owner: string, repo: string): Promise<GitHubPR[]> {
    const { maxResults = 5 } = this.config;

    try {
      const prs = await this.request<GitHubPR[]>(
        `/repos/${owner}/${repo}/pulls?state=open&sort=updated&direction=desc&per_page=${Math.max(maxResults, 1)}`
      );
      return prs;
    } catch (error) {
      console.error(`[GitHubAPI] Failed to fetch pull requests for ${owner}/${repo}:`, error);
      return [];
    }
  }

  /**
   * Get open issues for a specific repository.
   */
  async getIssues(owner: string, repo: string): Promise<GitHubIssue[]> {
    const { maxResults = 5 } = this.config;

    try {
      const issues = await this.request<GitHubIssue[]>(
        `/repos/${owner}/${repo}/issues?state=open&per_page=${Math.max(maxResults, 1)}`
      );
      return issues.filter((issue) => !("pull_request" in issue));
    } catch (error) {
      console.error(`[GitHubAPI] Failed to fetch issues for ${owner}/${repo}:`, error);
      return [];
    }
  }

  /**
   * Search pull requests scoped to a specific repository.
   */
  async searchPullRequests(owner: string, repo: string, query: string): Promise<GitHubPR[]> {
    try {
      const searchQuery = `repo:${owner}/${repo} is:pr ${query}`;
      const result = await this.request<{ items: GitHubPR[] }>(
        `/search/issues?q=${encodeURIComponent(searchQuery)}&per_page=${Math.max(this.config.maxResults || 5, 1)}`
      );
      return result.items;
    } catch (error) {
      console.error(`[GitHubAPI] Failed to search pull requests for ${owner}/${repo}:`, error);
      return [];
    }
  }

  /**
   * Search issues scoped to a specific repository.
   */
  async searchIssues(owner: string, repo: string, query: string): Promise<GitHubIssue[]> {
    try {
      const searchQuery = `repo:${owner}/${repo} is:issue ${query}`;
      const result = await this.request<{ items: GitHubIssue[] }>(
        `/search/issues?q=${encodeURIComponent(searchQuery)}&per_page=${Math.max(this.config.maxResults || 5, 1)}`
      );
      return result.items;
    } catch (error) {
      console.error(`[GitHubAPI] Failed to search issues for ${owner}/${repo}:`, error);
      return [];
    }
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<GitHubConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * List all repos accessible to the user (used to populate panel repo selector).
   * Returns at most 50 repos, sorted by last updated across all orgs/users.
   */
  async listAllRepos(): Promise<GitHubRepoRef[]> {
    const MAX_REPOS = 50;
    try {
      const organizations = await this.getOrganizations();
      const repoLists = await Promise.all(
        organizations.map((org) => this.getRepositories(org.login, org.type))
      );
      const flat: GitHubRepoRef[] = repoLists
        .flat()
        .slice(0, MAX_REPOS)
        .map((repo) => ({
          fullName: repo.full_name,
          owner: repo.owner?.login ?? repo.full_name.split("/")[0],
          name: repo.name,
        }));

      // Deduplicate by fullName
      const seen = new Set<string>();
      return flat.filter((r) => {
        if (seen.has(r.fullName)) return false;
        seen.add(r.fullName);
        return true;
      });
    } catch (error) {
      console.error("[GitHubAPI] Failed to list repos:", error);
      return [];
    }
  }

  /**
   * Search issues using the GitHub Search API with optional filters.
   * Supports "all repos" (no repo qualifier) and scoped-to-repo modes.
   */
  async searchIssuesPanel(filters: IssueFilters, repoFullName?: string): Promise<GitHubIssue[]> {
    const perPage = Math.min(Math.max(this.config.maxResults ?? 30, 1) * 6, 50);
    try {
      const parts: string[] = ["is:issue", "is:open"];
      if (repoFullName) parts.push(`repo:${repoFullName}`);
      if (filters.label) parts.push(`label:${filters.label}`);
      if (filters.author) parts.push(`author:${filters.author}`);
      if (filters.assignee) parts.push(`assignee:${filters.assignee}`);
      if (filters.search) parts.push(filters.search);

      const q = encodeURIComponent(parts.join(" "));
      const result = await this.request<{ items: GitHubIssue[] }>(
        `/search/issues?q=${q}&sort=updated&order=desc&per_page=${perPage}`
      );
      return result.items;
    } catch (error) {
      console.error("[GitHubAPI] Failed to search issues panel:", error);
      return [];
    }
  }

  /**
   * Search pull requests using the GitHub Search API with optional filters.
   * Supports "all repos" (no repo qualifier) and scoped-to-repo modes.
   */
  async searchPRsPanel(filters: PRFilters, repoFullName?: string): Promise<GitHubPR[]> {
    const perPage = Math.min(Math.max(this.config.maxResults ?? 30, 1) * 6, 50);
    try {
      const parts: string[] = ["is:pr", "is:open"];
      if (repoFullName) parts.push(`repo:${repoFullName}`);
      if (filters.label) parts.push(`label:${filters.label}`);
      if (filters.author) parts.push(`author:${filters.author}`);
      if (filters.assignee) parts.push(`assignee:${filters.assignee}`);
      if (filters.isDraft === true) parts.push("draft:true");
      if (filters.isDraft === false) parts.push("draft:false");
      if (filters.search) parts.push(filters.search);

      const q = encodeURIComponent(parts.join(" "));
      const result = await this.request<{ items: GitHubPR[] }>(
        `/search/issues?q=${q}&sort=updated&order=desc&per_page=${perPage}`
      );
      return result.items;
    } catch (error) {
      console.error("[GitHubAPI] Failed to search PRs panel:", error);
      return [];
    }
  }
}
