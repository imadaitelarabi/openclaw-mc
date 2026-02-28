/**
 * GitHub API Client
 *
 * Read-only client for fetching GitHub data.
 */

import type { GitHubConfig } from "./config";

export interface GitHubPR {
  number: number;
  node_id?: string;
  title: string;
  state: "open" | "closed";
  html_url: string;
  user: {
    login: string;
    avatar_url?: string;
    html_url?: string;
  };
  created_at: string;
  updated_at: string;
  draft?: boolean;
  labels?: Array<{ name: string; color: string }>;
  assignees?: Array<{ login: string; avatar_url?: string; html_url?: string }>;
  requested_reviewers?: Array<{ login: string; avatar_url?: string; html_url?: string }>;
  body?: string | null;
}

export interface GitHubIssue {
  number: number;
  title: string;
  state: "open" | "closed";
  html_url: string;
  user: {
    login: string;
    avatar_url?: string;
    html_url?: string;
  };
  created_at: string;
  updated_at: string;
  labels: Array<{ name: string; color: string }>;
  assignees?: Array<{ login: string; avatar_url?: string; html_url?: string }>;
  body?: string | null;
}

export interface GitHubComment {
  id: number;
  user: { login: string; avatar_url?: string; html_url?: string };
  body: string;
  created_at: string;
  updated_at: string;
  html_url: string;
}

export interface GitHubAssignableUser {
  login: string;
  avatar_url: string;
  html_url: string;
  name?: string | null;
}

export interface GitHubTimelineEvent {
  event: string;
  id?: number;
  created_at?: string;
  actor?: { login: string; avatar_url?: string; html_url?: string };
  assignee?: { login: string; avatar_url?: string; html_url?: string };
  label?: { name: string; color: string };
  state?: string;
}

export interface GitHubReviewComment {
  id: number;
  user: { login: string };
  body: string;
  created_at: string;
  updated_at: string;
  html_url: string;
  path?: string;
  diff_hunk?: string;
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

export interface GitHubBranchRef {
  name: string;
}

export interface GitHubCopilotAgentAssignmentOptions {
  targetRepo?: string;
  baseBranch?: string;
  customInstructions?: string;
  customAgent?: string;
  model?: string;
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
  default_branch?: string;
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
  private detailsCacheVersion = 0;

  constructor(config: GitHubConfig) {
    this.config = config;
  }

  private withDetailsCacheVersion(endpoint: string): string {
    const separator = endpoint.includes("?") ? "&" : "?";
    return `${endpoint}${separator}_ocmc_details_v=${this.detailsCacheVersion}`;
  }

  private invalidateDetailsCache(): void {
    this.detailsCacheVersion += 1;
  }

  /**
   * Make authenticated request to GitHub API
   */
  private async request<T>(
    endpoint: string,
    options?: {
      method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
      body?: unknown;
      accept?: string;
    }
  ): Promise<T> {
    const { token } = this.config;

    if (!token) {
      throw new Error("GitHub token not configured");
    }

    const method = options?.method ?? "GET";
    const fetchOptions: RequestInit = {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: options?.accept ?? "application/vnd.github.v3+json",
        ...(options?.body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
    };

    if (options?.body !== undefined) {
      fetchOptions.body = JSON.stringify(options.body);
    }

    const response = await fetch(`${this.baseURL}${endpoint}`, fetchOptions);

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

    if (method === "DELETE" || response.status === 204) {
      return undefined as unknown as T;
    }

    return response.json();
  }

  /**
   * Make an authenticated GraphQL request to the GitHub API.
   * Optionally accepts extra headers (e.g. for Copilot feature flags).
   */
  private async graphqlRequest<T>(
    query: string,
    variables: Record<string, unknown>,
    extraHeaders?: Record<string, string>
  ): Promise<T> {
    const { token } = this.config;

    if (!token) {
      throw new Error("GitHub token not configured");
    }

    const response = await fetch(`${this.baseURL}/graphql`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
        ...(extraHeaders ?? {}),
      },
      body: JSON.stringify({ query, variables }),
    });

    if (!response.ok) {
      let details = response.statusText || "Unknown error";
      try {
        const payload = await response.json();
        if (payload?.message) details = payload.message;
        if (Array.isArray(payload?.errors) && payload.errors.length > 0) {
          details = payload.errors.map((e: { message?: string }) => e.message).join("; ");
        }
      } catch {}
      throw new Error(`GitHub GraphQL ${response.status}: ${details}`);
    }

    const result = (await response.json()) as { data?: T; errors?: Array<{ message: string }> };
    if (result.errors?.length) {
      throw new Error(result.errors.map((e) => e.message).join("; "));
    }
    if (!result.data) {
      throw new Error("GitHub GraphQL returned no data");
    }

    return result.data;
  }

  /**
   * Get the authenticated user's profile.
   */
  async getUser(): Promise<{ login: string; name: string | null; avatar_url: string; html_url: string }> {
    return this.request<{ login: string; name: string | null; avatar_url: string; html_url: string }>("/user");
  }

  /**
   * Test whether the current token can reach the GitHub API.
   */
  async testConnection(): Promise<boolean> {
    try {
      await this.request<unknown>("/user");
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get organizations and user account available to the token.
   */
  async getOrganizations(): Promise<GitHubOrganization[]> {
    const { maxOrganizations = 5 } = this.config;

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
   * Get repository details.
   */
  async getRepository(owner: string, repo: string): Promise<GitHubRepository> {
    return this.request<GitHubRepository>(`/repos/${owner}/${repo}`);
  }

  /**
   * List repository branches.
   */
  async getRepositoryBranches(owner: string, repo: string): Promise<GitHubBranchRef[]> {
    return this.request<GitHubBranchRef[]>(`/repos/${owner}/${repo}/branches?per_page=100`);
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
   * Get a single pull request by number.
   */
  async getPRDetails(owner: string, repo: string, number: number): Promise<GitHubPR> {
    return this.request<GitHubPR>(
      this.withDetailsCacheVersion(`/repos/${owner}/${repo}/pulls/${number}`)
    );
  }

  /**
   * Get a single issue by number.
   */
  async getIssueDetails(owner: string, repo: string, number: number): Promise<GitHubIssue> {
    return this.request<GitHubIssue>(
      this.withDetailsCacheVersion(`/repos/${owner}/${repo}/issues/${number}`)
    );
  }

  /**
   * Get comments for an issue (or PR conversation comments).
   */
  async getIssueComments(owner: string, repo: string, number: number): Promise<GitHubComment[]> {
    return this.request<GitHubComment[]>(
      this.withDetailsCacheVersion(`/repos/${owner}/${repo}/issues/${number}/comments?per_page=100`)
    );
  }

  /**
   * Get review (inline) comments for a pull request.
   */
  async getPRReviewComments(
    owner: string,
    repo: string,
    number: number
  ): Promise<GitHubReviewComment[]> {
    return this.request<GitHubReviewComment[]>(
      this.withDetailsCacheVersion(`/repos/${owner}/${repo}/pulls/${number}/comments?per_page=100`)
    );
  }

  // ── Write actions ────────────────────────────────────────────────────────

  /**
   * Merge a pull request.
   */
  async mergePR(
    owner: string,
    repo: string,
    number: number,
    options?: {
      commit_title?: string;
      commit_message?: string;
      merge_method?: "merge" | "squash" | "rebase";
    }
  ): Promise<void> {
    await this.request(`/repos/${owner}/${repo}/pulls/${number}/merge`, {
      method: "PUT",
      body: options ?? {},
    });
    this.invalidateDetailsCache();
  }

  /**
   * Mark a draft pull request as ready for review using the GitHub GraphQL API.
   * There is no REST endpoint for this; GraphQL is required.
   * Accepts an optional `pullRequestId` (GraphQL node_id) to avoid a redundant REST call.
   */
  async markPrReadyForReview(owner: string, repo: string, number: number, pullRequestId?: string): Promise<void> {
    // Fetch the PR node_id via REST only if not provided by the caller
    const nodeId = pullRequestId ?? (
      await this.request<{ node_id: string }>(`/repos/${owner}/${repo}/pulls/${number}`)
    ).node_id;

    await this.graphqlRequest<unknown>(
      `mutation MarkPullRequestReadyForReview($pullRequestId: ID!) {
        markPullRequestReadyForReview(input: { pullRequestId: $pullRequestId }) {
          pullRequest {
            isDraft
          }
        }
      }`,
      { pullRequestId: nodeId }
    );

    this.invalidateDetailsCache();
  }

  /**
   * Close a pull request.
   */
  async closePR(owner: string, repo: string, number: number): Promise<void> {
    await this.request(`/repos/${owner}/${repo}/pulls/${number}`, {
      method: "PATCH",
      body: { state: "closed" },
    });
    this.invalidateDetailsCache();
  }

  /**
   * Delete a branch (typically called after merge).
   */
  async deleteBranch(owner: string, repo: string, branch: string): Promise<void> {
    await this.request(`/repos/${owner}/${repo}/git/refs/heads/${branch}`, {
      method: "DELETE",
    });
    this.invalidateDetailsCache();
  }

  /**
   * Close an issue.
   */
  async closeIssue(owner: string, repo: string, number: number): Promise<void> {
    await this.request(`/repos/${owner}/${repo}/issues/${number}`, {
      method: "PATCH",
      body: { state: "closed" },
    });
    this.invalidateDetailsCache();
  }

  /**
   * Add a comment to an issue or pull request.
   */
  async addComment(
    owner: string,
    repo: string,
    number: number,
    body: string
  ): Promise<GitHubComment> {
    const comment = await this.request<GitHubComment>(
      `/repos/${owner}/${repo}/issues/${number}/comments`,
      {
        method: "POST",
        body: { body },
      }
    );
    this.invalidateDetailsCache();
    return comment;
  }

  /**
   * Add assignees to an issue or pull request.
   */
  async addAssignees(
    owner: string,
    repo: string,
    number: number,
    assignees: string[]
  ): Promise<void> {
    await this.request(`/repos/${owner}/${repo}/issues/${number}/assignees`, {
      method: "POST",
      body: { assignees },
    });
    this.invalidateDetailsCache();
  }

  /**
   * Assign Copilot to an issue and optionally provide coding-agent assignment details.
   */
  async assignCopilotToIssue(
    owner: string,
    repo: string,
    number: number,
    options?: GitHubCopilotAgentAssignmentOptions
  ): Promise<void> {
    const agentAssignment = {
      target_repo: options?.targetRepo ?? `${owner}/${repo}`,
      ...(options?.baseBranch ? { base_branch: options.baseBranch } : {}),
      ...(options?.customInstructions
        ? { custom_instructions: options.customInstructions }
        : {}),
      ...(options?.customAgent ? { custom_agent: options.customAgent } : {}),
      ...(options?.model ? { model: options.model } : {}),
    };

    await this.request(`/repos/${owner}/${repo}/issues/${number}/assignees`, {
      method: "POST",
      body: {
        assignees: ["copilot-swe-agent[bot]"],
        agent_assignment: agentAssignment,
      },
    });

    this.invalidateDetailsCache();
  }

  /**
   * Remove assignees from an issue or pull request.
   */
  async removeAssignees(
    owner: string,
    repo: string,
    number: number,
    assignees: string[]
  ): Promise<void> {
    await this.request(`/repos/${owner}/${repo}/issues/${number}/assignees`, {
      method: "DELETE",
      body: { assignees },
    });
    this.invalidateDetailsCache();
  }

  /**
   * Request reviewers for a pull request.
   */
  async requestReviewers(
    owner: string,
    repo: string,
    number: number,
    reviewers: string[]
  ): Promise<void> {
    await this.request(`/repos/${owner}/${repo}/pulls/${number}/requested_reviewers`, {
      method: "POST",
      body: { reviewers },
    });
    this.invalidateDetailsCache();
  }

  /**
   * Remove requested reviewers from a pull request.
   */
  async removeReviewers(
    owner: string,
    repo: string,
    number: number,
    reviewers: string[]
  ): Promise<void> {
    await this.request(`/repos/${owner}/${repo}/pulls/${number}/requested_reviewers`, {
      method: "DELETE",
      body: { reviewers },
    });
    this.invalidateDetailsCache();
  }

  /**
   * Reopen a closed issue.
   */
  async reopenIssue(owner: string, repo: string, number: number): Promise<void> {
    await this.request(`/repos/${owner}/${repo}/issues/${number}`, {
      method: "PATCH",
      body: { state: "open" },
    });
    this.invalidateDetailsCache();
  }

  /**
   * Get users that can be assigned to issues in a repository.
   */
  async getAssignableUsers(owner: string, repo: string): Promise<GitHubAssignableUser[]> {
    return this.request<GitHubAssignableUser[]>(
      `/repos/${owner}/${repo}/assignees?per_page=100`
    );
  }

  /**
   * Get the timeline of events for an issue.
   */
  async getIssueTimeline(
    owner: string,
    repo: string,
    number: number
  ): Promise<GitHubTimelineEvent[]> {
    return this.request<GitHubTimelineEvent[]>(
      `/repos/${owner}/${repo}/issues/${number}/timeline?per_page=100`,
      { accept: "application/vnd.github.mockingbird-preview+json" }
    );
  }

  // ── Configuration ────────────────────────────────────────────────────────

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
    const dedupe = (repos: GitHubRepository[]): GitHubRepoRef[] => {
      const seen = new Set<string>();
      return repos
        .map((repo) => ({
          fullName: repo.full_name,
          owner: repo.owner?.login ?? repo.full_name.split("/")[0],
          name: repo.name,
        }))
        .filter((repo) => {
          if (seen.has(repo.fullName)) return false;
          seen.add(repo.fullName);
          return true;
        })
        .slice(0, MAX_REPOS);
    };

    try {
      // Primary path: GitHub endpoint that returns repositories the user can access.
      // This includes owned, collaborator, and org member repos.
      const accessibleRepos = await this.request<GitHubRepository[]>(
        "/user/repos?affiliation=owner,collaborator,organization_member&sort=updated&per_page=100"
      );

      const primary = dedupe(accessibleRepos);
      if (primary.length > 0) {
        return primary;
      }
    } catch (error) {
      console.error("[GitHubAPI] Primary accessible-repos fetch failed, falling back:", error);
    }

    try {
      // Fallback path: gather repos from organizations and user account
      const organizations = await this.getOrganizations();
      const repoLists = await Promise.all(
        organizations.map((org) => this.getRepositories(org.login, org.type))
      );
      return dedupe(repoLists.flat());
    } catch (error) {
      console.error("[GitHubAPI] Failed to list repos:", error);
      return [];
    }
  }

  /**
   * Search issues in a specific repository for panel rendering.
   */
  async searchIssuesPanel(filters: IssueFilters, repoFullName?: string): Promise<GitHubIssue[]> {
    const perPage = Math.min(Math.max(this.config.maxResults ?? 30, 1) * 6, 50);
    try {
      if (!repoFullName) return [];

      const parts: string[] = ["is:issue", "is:open"];
      parts.push(`repo:${repoFullName}`);
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
   * Search pull requests in a specific repository for panel rendering.
   */
  async searchPRsPanel(filters: PRFilters, repoFullName?: string): Promise<GitHubPR[]> {
    const perPage = Math.min(Math.max(this.config.maxResults ?? 30, 1) * 6, 50);
    try {
      if (!repoFullName) return [];

      const parts: string[] = ["is:pr", "is:open"];
      parts.push(`repo:${repoFullName}`);
      if (filters.label) parts.push(`label:${filters.label}`);
      if (filters.author) parts.push(`author:${filters.author}`);
      if (filters.assignee) parts.push(`assignee:${filters.assignee}`);
      if (filters.isDraft === true) parts.push("draft:true");
      if (filters.isDraft === false) parts.push("-draft:true");
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
