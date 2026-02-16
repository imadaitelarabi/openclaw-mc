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
    
    // Check if query starts with PR or issue prefix
    const lowerQuery = query.toLowerCase();
    
    if (lowerQuery.startsWith('pr')) {
      // Search for PRs
      const searchTerm = query.slice(2).trim();
      const prs = searchTerm 
        ? await api.searchPullRequests(searchTerm)
        : await api.getPullRequests();
      
      options.push(...prs.map(pr => ({
        id: `pr-${pr.number}`,
        label: `PR #${pr.number}`,
        tag: `@PR-${pr.number}`,
        value: pr.html_url,
        description: pr.title,
      })));
    }
    
    if (lowerQuery.startsWith('issue')) {
      // Search for issues
      const searchTerm = query.slice(5).trim();
      const issues = searchTerm
        ? await api.searchIssues(searchTerm)
        : await api.getIssues();
      
      options.push(...issues.map(issue => ({
        id: `issue-${issue.number}`,
        label: `Issue #${issue.number}`,
        tag: `@issue-${issue.number}`,
        value: issue.html_url,
        description: issue.title,
      })));
    }
    
    // If no prefix, show both PRs and issues grouped
    if (!lowerQuery.startsWith('pr') && !lowerQuery.startsWith('issue')) {
      const [prs, issues] = await Promise.all([
        api.getPullRequests(),
        api.getIssues()
      ]);
      
      // Add PR group
      if (prs.length > 0) {
        options.push({
          id: 'pr-group',
          label: 'Pull Requests',
          tag: '@PR',
          value: '',
          children: prs.slice(0, 3).map(pr => ({
            id: `pr-${pr.number}`,
            label: `#${pr.number}`,
            tag: `@PR-${pr.number}`,
            value: pr.html_url,
            description: pr.title,
          })),
        });
      }
      
      // Add issue group
      if (issues.length > 0) {
        options.push({
          id: 'issue-group',
          label: 'Issues',
          tag: '@issue',
          value: '',
          children: issues.slice(0, 3).map(issue => ({
            id: `issue-${issue.number}`,
            label: `#${issue.number}`,
            tag: `@issue-${issue.number}`,
            value: issue.html_url,
            description: issue.title,
          })),
        });
      }
    }
    
    return options;
  } catch (error) {
    console.error('[GitHub ChatInput] Failed to get tag options:', error);
    return [];
  }
}
