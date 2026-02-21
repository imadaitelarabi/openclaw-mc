/**
 * GitHub Chat Input Component
 */

import type { ChatInputTagOption } from "@/types/extension";
import { GitHubAPI } from "../api";

const CHAT_INPUT_CACHE_TTL = 5 * 60 * 1000;
const chatInputCache = new WeakMap<
  GitHubAPI,
  Map<string, { data: ChatInputTagOption[]; timestamp: number }>
>();

function getCacheBucket(api: GitHubAPI) {
  let bucket = chatInputCache.get(api);
  if (!bucket) {
    bucket = new Map<string, { data: ChatInputTagOption[]; timestamp: number }>();
    chatInputCache.set(api, bucket);
  }
  return bucket;
}

/**
 * Get tag options based on query
 */
export async function getChatInputOptions(
  api: GitHubAPI,
  query: string
): Promise<ChatInputTagOption[]> {
  const normalizedQuery = query.trim().toLowerCase();
  const cacheBucket = getCacheBucket(api);
  const cached = cacheBucket.get(normalizedQuery);
  if (cached && Date.now() - cached.timestamp < CHAT_INPUT_CACHE_TTL) {
    return cached.data;
  }

  try {
    const toTimestamp = (dateValue?: string) => (dateValue ? new Date(dateValue).getTime() : 0);
    const toRepoOption = (
      repoOwner: string,
      repoName: string,
      repoUrl: string
    ): ChatInputTagOption => ({
      id: `repo-link-${repoOwner}-${repoName}`,
      label: "Repository",
      tag: `@repo ${repoOwner}/${repoName}`,
      value: repoUrl,
      description: `${repoOwner}/${repoName}`,
    });
    const options: ChatInputTagOption[] = [];
    const organizations = await api.getOrganizations();

    // Check if query starts with PR or issue prefix
    const lowerQuery = query.toLowerCase().trim();

    if (lowerQuery.startsWith("pr")) {
      const searchTerm = query.slice(2).trim();

      const orgGroups = await Promise.all(
        organizations.map(async (organization) => {
          const repositories = await api.getRepositories(organization.login, organization.type);

          const repoGroups = await Promise.all(
            repositories.map(async (repo) => {
              const repoOwner = repo.owner?.login || organization.login;
              const prs = searchTerm
                ? await api.searchPullRequests(repoOwner, repo.name, searchTerm)
                : await api.getPullRequests(repoOwner, repo.name);

              if (prs.length === 0) {
                return null;
              }

              const latestPrUpdatedAt = prs.reduce((latest, pr) => {
                const updatedAt = toTimestamp(pr.updated_at);
                return updatedAt > latest ? updatedAt : latest;
              }, 0);

              const sortedPrs = [...prs].sort(
                (a, b) => toTimestamp(b.updated_at) - toTimestamp(a.updated_at)
              );

              return {
                latestPrUpdatedAt,
                option: {
                  id: `pr-repo-${organization.login}-${repo.name}`,
                  label: repo.name,
                  tag: `@PR ${repoOwner}/${repo.name}`,
                  value: repo.html_url,
                  description: `${prs.length} matching pull request${prs.length === 1 ? "" : "s"}`,
                  children: [
                    toRepoOption(repoOwner, repo.name, repo.html_url),
                    ...sortedPrs.map((pr) => ({
                      id: `pr-${organization.login}-${repo.name}-${pr.number}`,
                      label: `#${pr.number}`,
                      tag: `@PR-${repoOwner}/${repo.name}#${pr.number}`,
                      value: pr.html_url,
                      description: pr.title,
                    })),
                  ],
                },
              };
            })
          );

          const validRepoGroups = repoGroups.filter(Boolean) as Array<{
            latestPrUpdatedAt: number;
            option: ChatInputTagOption;
          }>;
          if (validRepoGroups.length === 0) {
            return null;
          }

          const children = validRepoGroups
            .filter((entry) => entry.latestPrUpdatedAt > 0)
            .sort((a, b) => b.latestPrUpdatedAt - a.latestPrUpdatedAt)
            .map((entry) => entry.option);

          if (children.length === 0) {
            return null;
          }

          const latestOrgPrUpdatedAt = validRepoGroups.reduce(
            (latest, repoEntry) =>
              repoEntry.latestPrUpdatedAt > latest ? repoEntry.latestPrUpdatedAt : latest,
            0
          );

          return {
            latestOrgPrUpdatedAt,
            option: {
              id: `pr-org-${organization.login}`,
              label: organization.login,
              tag: `@PR ${organization.login}`,
              value: "",
              description: organization.type === "User" ? "Personal account" : "Organization",
              children,
            },
          };
        })
      );

      const sortedOrgGroups = (
        orgGroups.filter(Boolean) as Array<{
          latestOrgPrUpdatedAt: number;
          option: ChatInputTagOption;
        }>
      )
        .sort((a, b) => b.latestOrgPrUpdatedAt - a.latestOrgPrUpdatedAt)
        .map((entry) => entry.option);

      options.push(...sortedOrgGroups);
    }

    if (lowerQuery.startsWith("issue")) {
      const searchTerm = query.slice(5).trim();

      const orgGroups = await Promise.all(
        organizations.map(async (organization) => {
          const repositories = await api.getRepositories(organization.login, organization.type);

          const repoGroups = await Promise.all(
            repositories.map(async (repo) => {
              const repoOwner = repo.owner?.login || organization.login;
              const issues = searchTerm
                ? await api.searchIssues(repoOwner, repo.name, searchTerm)
                : await api.getIssues(repoOwner, repo.name);

              if (issues.length === 0) {
                return null;
              }

              const latestIssueUpdatedAt = issues.reduce((latest, issue) => {
                const updatedAt = toTimestamp(issue.updated_at);
                return updatedAt > latest ? updatedAt : latest;
              }, 0);

              return {
                latestIssueUpdatedAt,
                option: {
                  id: `issue-repo-${organization.login}-${repo.name}`,
                  label: repo.name,
                  tag: `@issue ${repoOwner}/${repo.name}`,
                  value: repo.html_url,
                  description: `${issues.length} matching issue${issues.length === 1 ? "" : "s"}`,
                  children: [
                    toRepoOption(repoOwner, repo.name, repo.html_url),
                    ...issues.map((issue) => ({
                      id: `issue-${organization.login}-${repo.name}-${issue.number}`,
                      label: `#${issue.number}`,
                      tag: `@issue-${repoOwner}/${repo.name}#${issue.number}`,
                      value: issue.html_url,
                      description: issue.title,
                    })),
                  ],
                },
              };
            })
          );

          const validRepoGroups = repoGroups.filter(Boolean) as Array<{
            latestIssueUpdatedAt: number;
            option: ChatInputTagOption;
          }>;
          if (validRepoGroups.length === 0) {
            return null;
          }

          const children = validRepoGroups
            .sort((a, b) => b.latestIssueUpdatedAt - a.latestIssueUpdatedAt)
            .map((entry) => entry.option);

          if (children.length === 0) {
            return null;
          }

          const latestOrgIssueUpdatedAt = validRepoGroups.reduce(
            (latest, repoEntry) =>
              repoEntry.latestIssueUpdatedAt > latest ? repoEntry.latestIssueUpdatedAt : latest,
            0
          );

          return {
            latestOrgIssueUpdatedAt,
            option: {
              id: `issue-org-${organization.login}`,
              label: organization.login,
              tag: `@issue ${organization.login}`,
              value: "",
              description: organization.type === "User" ? "Personal account" : "Organization",
              children,
            },
          };
        })
      );

      const sortedOrgGroups = (
        orgGroups.filter(Boolean) as Array<{
          latestOrgIssueUpdatedAt: number;
          option: ChatInputTagOption;
        }>
      )
        .sort((a, b) => b.latestOrgIssueUpdatedAt - a.latestOrgIssueUpdatedAt)
        .map((entry) => entry.option);

      options.push(...sortedOrgGroups);
    }

    if (lowerQuery.startsWith("repo")) {
      const searchTerm = query.slice(4).trim().toLowerCase();

      const orgGroups = await Promise.all(
        organizations.map(async (organization) => {
          const repositories = await api.getRepositories(organization.login, organization.type);

          const repoItems = repositories
            .filter((repo) => {
              if (!searchTerm) return true;
              const fullName =
                `${repo.owner?.login || organization.login}/${repo.name}`.toLowerCase();
              return fullName.includes(searchTerm) || repo.name.toLowerCase().includes(searchTerm);
            })
            .map((repo) => {
              const repoOwner = repo.owner?.login || organization.login;
              return {
                sortTime: toTimestamp(repo.updated_at),
                option: {
                  id: `repo-only-${organization.login}-${repo.name}`,
                  label: repo.name,
                  tag: `@repo ${repoOwner}/${repo.name}`,
                  value: repo.html_url,
                  description: repo.private ? "Private repository" : "Repository",
                } as ChatInputTagOption,
              };
            });

          if (repoItems.length === 0) {
            return null;
          }

          const children = [...repoItems]
            .sort((a, b) => b.sortTime - a.sortTime)
            .map((entry) => entry.option);

          const latestRepoUpdatedAt = repoItems.reduce(
            (latest, entry) => (entry.sortTime > latest ? entry.sortTime : latest),
            0
          );

          return {
            latestRepoUpdatedAt,
            option: {
              id: `repo-org-${organization.login}`,
              label: organization.login,
              tag: `@repo ${organization.login}`,
              value: "",
              description: organization.type === "User" ? "Personal account" : "Organization",
              children,
            },
          };
        })
      );

      const sortedOrgGroups = (
        orgGroups.filter(Boolean) as Array<{
          latestRepoUpdatedAt: number;
          option: ChatInputTagOption;
        }>
      )
        .sort((a, b) => b.latestRepoUpdatedAt - a.latestRepoUpdatedAt)
        .map((entry) => entry.option);

      options.push(...sortedOrgGroups);
    }

    // If no prefix, show both PRs and issues grouped
    if (
      !lowerQuery.startsWith("pr") &&
      !lowerQuery.startsWith("issue") &&
      !lowerQuery.startsWith("repo")
    ) {
      const orgGroups = await Promise.all(
        organizations.map(async (organization) => {
          const repositories = await api.getRepositories(organization.login, organization.type);

          const repoGroups = await Promise.all(
            repositories.map(async (repo) => {
              const repoOwner = repo.owner?.login || organization.login;
              const [prs, issues] = await Promise.all([
                api.getPullRequests(repoOwner, repo.name),
                api.getIssues(repoOwner, repo.name),
              ]);

              const latestPrUpdatedAt = prs.reduce((latest, pr) => {
                const updatedAt = toTimestamp(pr.updated_at);
                return updatedAt > latest ? updatedAt : latest;
              }, 0);

              const latestIssueUpdatedAt = issues.reduce((latest, issue) => {
                const updatedAt = toTimestamp(issue.updated_at);
                return updatedAt > latest ? updatedAt : latest;
              }, 0);

              const latestRepoUpdatedAt = toTimestamp(repo.updated_at);
              const latestActivityAt = Math.max(
                latestPrUpdatedAt,
                latestIssueUpdatedAt,
                latestRepoUpdatedAt
              );

              const children: ChatInputTagOption[] = [];

              children.push(toRepoOption(repoOwner, repo.name, repo.html_url));

              if (prs.length > 0) {
                children.push({
                  id: `pr-group-${organization.login}-${repo.name}`,
                  label: "Pull Requests",
                  tag: `@PR ${repoOwner}/${repo.name}`,
                  value: repo.html_url,
                  children: prs.map((pr) => ({
                    id: `pr-${organization.login}-${repo.name}-${pr.number}`,
                    label: `#${pr.number}`,
                    tag: `@PR-${repoOwner}/${repo.name}#${pr.number}`,
                    value: pr.html_url,
                    description: pr.title,
                  })),
                });
              }

              if (issues.length > 0) {
                children.push({
                  id: `issue-group-${organization.login}-${repo.name}`,
                  label: "Issues",
                  tag: `@issue ${repoOwner}/${repo.name}`,
                  value: repo.html_url,
                  children: issues.map((issue) => ({
                    id: `issue-${organization.login}-${repo.name}-${issue.number}`,
                    label: `#${issue.number}`,
                    tag: `@issue-${repoOwner}/${repo.name}#${issue.number}`,
                    value: issue.html_url,
                    description: issue.title,
                  })),
                });
              }

              return {
                latestActivityAt,
                option: {
                  id: `repo-${organization.login}-${repo.name}`,
                  label: repo.name,
                  tag: `@${repoOwner}/${repo.name}`,
                  value: repo.html_url,
                  children,
                },
              };
            })
          );

          const validRepoGroups = repoGroups.filter(Boolean) as Array<{
            latestActivityAt: number;
            option: ChatInputTagOption;
          }>;
          if (validRepoGroups.length === 0) {
            return null;
          }

          const children = validRepoGroups
            .sort((a, b) => b.latestActivityAt - a.latestActivityAt)
            .map((entry) => entry.option);

          if (children.length === 0) {
            return null;
          }

          const latestOrgActivityAt = validRepoGroups.reduce(
            (latest, repoEntry) =>
              repoEntry.latestActivityAt > latest ? repoEntry.latestActivityAt : latest,
            0
          );

          return {
            latestOrgActivityAt,
            option: {
              id: `org-${organization.login}`,
              label: organization.login,
              tag: `@${organization.login}`,
              value: "",
              description: organization.type === "User" ? "Personal account" : "Organization",
              children,
            },
          };
        })
      );

      const sortedOrgGroups = (
        orgGroups.filter(Boolean) as Array<{
          latestOrgActivityAt: number;
          option: ChatInputTagOption;
        }>
      )
        .sort((a, b) => b.latestOrgActivityAt - a.latestOrgActivityAt)
        .map((entry) => entry.option);

      options.push(...sortedOrgGroups);
    }

    cacheBucket.set(normalizedQuery, { data: options, timestamp: Date.now() });
    return options;
  } catch (error) {
    console.error("[GitHub ChatInput] Failed to get tag options:", error);
    return [];
  }
}
