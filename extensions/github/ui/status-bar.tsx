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
    // Fetch open PRs
    const prs = await api.getPullRequests();
    
    if (prs.length === 0) {
      return {
        label: 'GitHub',
        value: 0,
        icon: 'Github',
        items: [],
      };
    }

    // Create dropdown items for each PR
    const items: StatusBarDropdownItem[] = prs.map(pr => ({
      id: `pr-${pr.number}`,
      text: `#${pr.number}: ${pr.title}`,
      subtext: `by ${pr.user.login}`,
      copyValue: pr.html_url,
      openUrl: pr.html_url,
    }));

    return {
      label: 'GitHub PRs',
      value: prs.length,
      icon: 'Github',
      items,
    };
  } catch (error) {
    console.error('[GitHub StatusBar] Failed to get status data:', error);
    return null;
  }
}
