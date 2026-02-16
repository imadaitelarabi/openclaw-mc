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

              return {
                id: `pr-repo-${organization.login}-${repo.name}`,
                label: repo.name,
                tag: `@PR ${repoOwner}/${repo.name}`,
                value: repo.html_url,
                description: `${prs.length} matching pull request${prs.length === 1 ? '' : 's'}`,
                children: prs.map(pr => ({
                  id: `pr-${organization.login}-${repo.name}-${pr.number}`,
                  label: `#${pr.number}`,
                  tag: `@PR-${repoOwner}/${repo.name}#${pr.number}`,
                  value: pr.html_url,
                  description: pr.title,
                })),
              };
            })
          );

          const children = repoGroups.filter(Boolean) as ChatInputTagOption[];
          if (children.length === 0) {
            return null;
          }

          return {
            id: `pr-org-${organization.login}`,
            label: organization.login,
            tag: `@PR ${organization.login}`,
            value: '',
            description: organization.type === 'User' ? 'Personal account' : 'Organization',
            children,
          };
        })
      );

      options.push(...orgGroups.filter(Boolean) as ChatInputTagOption[]);
    }

    if (lowerQuery.startsWith('issue')) {
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

              return {
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
              };
            })
          );

          const children = repoGroups.filter(Boolean) as ChatInputTagOption[];
          if (children.length === 0) {
            return null;
          }

          return {
            id: `issue-org-${organization.login}`,
            label: organization.login,
            tag: `@issue ${organization.login}`,
            value: '',
            description: organization.type === 'User' ? 'Personal account' : 'Organization',
            children,
          };
        })
      );

      options.push(...orgGroups.filter(Boolean) as ChatInputTagOption[]);
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
                id: `repo-${organization.login}-${repo.name}`,
                label: repo.name,
                tag: `@${repoOwner}/${repo.name}`,
                value: repo.html_url,
                children,
              };
            })
          );

          const children = repoGroups.filter(Boolean) as ChatInputTagOption[];
          if (children.length === 0) {
            return null;
          }

          return {
            id: `org-${organization.login}`,
            label: organization.login,
            tag: `@${organization.login}`,
            value: '',
            description: organization.type === 'User' ? 'Personal account' : 'Organization',
            children,
          };
        })
      );

      options.push(...orgGroups.filter(Boolean) as ChatInputTagOption[]);
    }

    return options;
  } catch (error) {
    console.error('[GitHub ChatInput] Failed to get tag options:', error);
    return [];
  }
}
