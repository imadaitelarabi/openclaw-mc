/**
 * GitHub Chat Input Component
 */

import type { ChatInputTagOption } from '@/types/extension';
import { GitHubAPI } from '../api';

/**
 * Get tag options based on query
 */
export async function getChatInputOptions(
  api: GitHubAPI,
  query: string
): Promise<ChatInputTagOption[]> {
  try {
    const toTimestamp = (dateValue?: string) => (dateValue ? new Date(dateValue).getTime() : 0);
    const options: ChatInputTagOption[] = [];
    const organizations = await api.getOrganizations();

    // Check if query starts with PR or issue prefix
    const lowerQuery = query.toLowerCase().trim();

    if (lowerQuery.startsWith('pr')) {
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
                  description: `${prs.length} matching pull request${prs.length === 1 ? '' : 's'}`,
                  children: sortedPrs.map(pr => ({
                    id: `pr-${organization.login}-${repo.name}-${pr.number}`,
                    label: `#${pr.number}`,
                    tag: `@PR-${repoOwner}/${repo.name}#${pr.number}`,
                    value: pr.html_url,
                    description: pr.title,
                  })),
                },
              };
            })
          );

          const validRepoGroups = repoGroups.filter(Boolean) as Array<{ latestPrUpdatedAt: number; option: ChatInputTagOption }>;
          if (validRepoGroups.length === 0) {
            return null;
          }

          const children = validRepoGroups
            .filter(entry => entry.latestPrUpdatedAt > 0)
            .sort((a, b) => b.latestPrUpdatedAt - a.latestPrUpdatedAt)
            .map(entry => entry.option);

          if (children.length === 0) {
            return null;
          }

          const latestOrgPrUpdatedAt = validRepoGroups.reduce(
            (latest, repoEntry) => (repoEntry.latestPrUpdatedAt > latest ? repoEntry.latestPrUpdatedAt : latest),
            0
          );

          return {
            latestOrgPrUpdatedAt,
            option: {
              id: `pr-org-${organization.login}`,
              label: organization.login,
              tag: `@PR ${organization.login}`,
              value: '',
              description: organization.type === 'User' ? 'Personal account' : 'Organization',
              children,
            },
          };
        })
      );

      const sortedOrgGroups = (orgGroups.filter(Boolean) as Array<{ latestOrgPrUpdatedAt: number; option: ChatInputTagOption }>)
        .sort((a, b) => b.latestOrgPrUpdatedAt - a.latestOrgPrUpdatedAt)
        .map(entry => entry.option);

      options.push(...sortedOrgGroups);
    }

    if (lowerQuery.startsWith('issue')) {
      const searchTerm = query.slice(5).trim();

      const orgGroups = await Promise.all(
        organizations.map(async (organization) => {
          const repositories = await api.getRepositories(organization.login, organization.type);

          const repoGroups = await Promise.all(
            repositories.map(async (repo) => {
              const repoOwner = repo.owner?.login || organization.login;
              const orderingPrs = await api.getPullRequests(repoOwner, repo.name);
              const issues = searchTerm
                ? await api.searchIssues(repoOwner, repo.name, searchTerm)
                : await api.getIssues(repoOwner, repo.name);

              if (issues.length === 0) {
                return null;
              }

              const latestPrUpdatedAt = orderingPrs.reduce((latest, pr) => {
                const updatedAt = toTimestamp(pr.updated_at);
                return updatedAt > latest ? updatedAt : latest;
              }, 0);

              return {
                latestPrUpdatedAt,
                option: {
                  id: `issue-repo-${organization.login}-${repo.name}`,
                  label: repo.name,
                  tag: `@issue ${repoOwner}/${repo.name}`,
                  value: repo.html_url,
                  description: `${issues.length} matching issue${issues.length === 1 ? '' : 's'}`,
                  children: issues.map(issue => ({
                    id: `issue-${organization.login}-${repo.name}-${issue.number}`,
                    label: `#${issue.number}`,
                    tag: `@issue-${repoOwner}/${repo.name}#${issue.number}`,
                    value: issue.html_url,
                    description: issue.title,
                  })),
                },
              };
            })
          );

          const validRepoGroups = repoGroups.filter(Boolean) as Array<{ latestPrUpdatedAt: number; option: ChatInputTagOption }>;
          if (validRepoGroups.length === 0) {
            return null;
          }

          const children = validRepoGroups
            .filter(entry => entry.latestPrUpdatedAt > 0)
            .sort((a, b) => b.latestPrUpdatedAt - a.latestPrUpdatedAt)
            .map(entry => entry.option);

          if (children.length === 0) {
            return null;
          }

          const latestOrgPrUpdatedAt = validRepoGroups.reduce(
            (latest, repoEntry) => (repoEntry.latestPrUpdatedAt > latest ? repoEntry.latestPrUpdatedAt : latest),
            0
          );

          return {
            latestOrgPrUpdatedAt,
            option: {
              id: `issue-org-${organization.login}`,
              label: organization.login,
              tag: `@issue ${organization.login}`,
              value: '',
              description: organization.type === 'User' ? 'Personal account' : 'Organization',
              children,
            },
          };
        })
      );

      const sortedOrgGroups = (orgGroups.filter(Boolean) as Array<{ latestOrgPrUpdatedAt: number; option: ChatInputTagOption }>)
        .sort((a, b) => b.latestOrgPrUpdatedAt - a.latestOrgPrUpdatedAt)
        .map(entry => entry.option);

      options.push(...sortedOrgGroups);
    }

    // If no prefix, show both PRs and issues grouped
    if (!lowerQuery.startsWith('pr') && !lowerQuery.startsWith('issue')) {
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

              if (prs.length === 0 && issues.length === 0) {
                return null;
              }

              const latestPrUpdatedAt = prs.reduce((latest, pr) => {
                const updatedAt = toTimestamp(pr.updated_at);
                return updatedAt > latest ? updatedAt : latest;
              }, 0);

              const children: ChatInputTagOption[] = [];

              if (prs.length > 0) {
                children.push({
                  id: `pr-group-${organization.login}-${repo.name}`,
                  label: 'Pull Requests',
                  tag: `@PR ${repoOwner}/${repo.name}`,
                  value: repo.html_url,
                  children: prs.map(pr => ({
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
                  label: 'Issues',
                  tag: `@issue ${repoOwner}/${repo.name}`,
                  value: repo.html_url,
                  children: issues.map(issue => ({
                    id: `issue-${organization.login}-${repo.name}-${issue.number}`,
                    label: `#${issue.number}`,
                    tag: `@issue-${repoOwner}/${repo.name}#${issue.number}`,
                    value: issue.html_url,
                    description: issue.title,
                  })),
                });
              }

              return {
                latestPrUpdatedAt,
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

          const validRepoGroups = repoGroups.filter(Boolean) as Array<{ latestPrUpdatedAt: number; option: ChatInputTagOption }>;
          if (validRepoGroups.length === 0) {
            return null;
          }

          const children = validRepoGroups
            .filter(entry => entry.latestPrUpdatedAt > 0)
            .sort((a, b) => b.latestPrUpdatedAt - a.latestPrUpdatedAt)
            .map(entry => entry.option);

          if (children.length === 0) {
            return null;
          }

          const latestOrgPrUpdatedAt = validRepoGroups.reduce(
            (latest, repoEntry) => (repoEntry.latestPrUpdatedAt > latest ? repoEntry.latestPrUpdatedAt : latest),
            0
          );

          return {
            latestOrgPrUpdatedAt,
            option: {
              id: `org-${organization.login}`,
              label: organization.login,
              tag: `@${organization.login}`,
              value: '',
              description: organization.type === 'User' ? 'Personal account' : 'Organization',
              children,
            },
          };
        })
      );

      const sortedOrgGroups = (orgGroups.filter(Boolean) as Array<{ latestOrgPrUpdatedAt: number; option: ChatInputTagOption }>)
        .sort((a, b) => b.latestOrgPrUpdatedAt - a.latestOrgPrUpdatedAt)
        .map(entry => entry.option);

      options.push(...sortedOrgGroups);
    }

    return options;
  } catch (error) {
    console.error('[GitHub ChatInput] Failed to get tag options:', error);
    return [];
  }
}
