/**
 * GitHub Status Bar Component
 */

import type { StatusBarItem, StatusBarDropdownItem } from '@/types/extension';
import { GitHubAPI } from '../api';

/**
 * Get status bar data for GitHub extension
 */
export async function getStatusBarData(api: GitHubAPI): Promise<StatusBarItem | null> {
  try {
    const organizations = await api.getOrganizations();

    if (organizations.length === 0) {
      return {
        label: 'GitHub',
        value: 0,
        icon: 'Github',
        items: [],
      };
    }

    let totalPrs = 0;

    const items: StatusBarDropdownItem[] = await Promise.all(
      organizations.map(async (organization) => {
        const repositories = await api.getRepositories(organization.login, organization.type);

        const repoItems: StatusBarDropdownItem[] = await Promise.all(
          repositories.map(async (repo) => {
            const repoOwner = repo.owner?.login || organization.login;
            const prs = await api.getPullRequests(repoOwner, repo.name);
            totalPrs += prs.length;

            return {
              id: `repo-${organization.login}-${repo.name}`,
              text: repo.name,
              subtext: `${prs.length} open PR${prs.length === 1 ? '' : 's'}`,
              copyValue: repo.html_url,
              openUrl: repo.html_url,
              children: prs.map(pr => ({
                id: `pr-${organization.login}-${repo.name}-${pr.number}`,
                text: `#${pr.number}: ${pr.title}`,
                subtext: `by ${pr.user.login}`,
                copyValue: pr.html_url,
                openUrl: pr.html_url,
              })),
            };
          })
        );

        return {
          id: `org-${organization.login}`,
          text: organization.login,
          subtext: organization.type === 'User' ? 'personal account' : 'organization',
          children: repoItems,
        };
      })
    );

    return {
      label: 'GitHub PRs',
      value: totalPrs,
      icon: 'Github',
      items,
    };
  } catch (error) {
    console.error('[GitHub StatusBar] Failed to get status data:', error);
    return null;
  }
}
