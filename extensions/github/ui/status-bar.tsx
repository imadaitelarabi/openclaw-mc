/**
 * GitHub Status Bar Component
 */

import type { StatusBarItem, StatusBarDropdownItem } from "@/types/extension";
import { GitHubAPI } from "../api";

/**
 * Get status bar data for GitHub extension
 */
export async function getStatusBarData(api: GitHubAPI): Promise<StatusBarItem | null> {
  try {
    const toTimestamp = (dateValue?: string) => (dateValue ? new Date(dateValue).getTime() : 0);
    const organizations = await api.getOrganizations();

    if (organizations.length === 0) {
      return {
        label: "GitHub",
        value: 0,
        icon: "Github",
        items: [],
      };
    }

    let totalPrs = 0;

    const orgEntries = await Promise.all(
      organizations.map(async (organization) => {
        const repositories = await api.getRepositories(organization.login, organization.type);

        const repoEntries = await Promise.all(
          repositories.map(async (repo) => {
            const repoOwner = repo.owner?.login || organization.login;
            const prs = await api.getPullRequests(repoOwner, repo.name);
            totalPrs += prs.length;

            const latestPrUpdatedAt = prs.reduce((latest, pr) => {
              const updatedAt = toTimestamp(pr.updated_at);
              return updatedAt > latest ? updatedAt : latest;
            }, 0);

            const sortedPrs = [...prs].sort(
              (a, b) => toTimestamp(b.updated_at) - toTimestamp(a.updated_at)
            );

            return {
              latestPrUpdatedAt,
              item: {
                id: `repo-${organization.login}-${repo.name}`,
                text: repo.name,
                subtext: `${prs.length} open PR${prs.length === 1 ? "" : "s"}`,
                copyValue: repo.html_url,
                openUrl: repo.html_url,
                children: sortedPrs.map((pr) => ({
                  id: `pr-${organization.login}-${repo.name}-${pr.number}`,
                  text: `#${pr.number}: ${pr.title}`,
                  subtext: `by ${pr.user.login}`,
                  copyValue: pr.html_url,
                  openUrl: pr.html_url,
                  openPanelId: "pr-details",
                  panelData: {
                    kind: "github-pr",
                    owner: repoOwner,
                    repo: repo.name,
                    number: pr.number,
                    htmlUrl: pr.html_url,
                  },
                })),
              },
            };
          })
        );

        const sortedRepoItems = repoEntries
          .filter((entry) => entry.latestPrUpdatedAt > 0)
          .sort((a, b) => b.latestPrUpdatedAt - a.latestPrUpdatedAt)
          .map((entry) => entry.item);

        if (sortedRepoItems.length === 0) {
          return null;
        }

        const latestOrgPrUpdatedAt = repoEntries.reduce(
          (latest, repoEntry) =>
            repoEntry.latestPrUpdatedAt > latest ? repoEntry.latestPrUpdatedAt : latest,
          0
        );

        return {
          latestOrgPrUpdatedAt,
          item: {
            id: `org-${organization.login}`,
            text: organization.login,
            subtext: organization.type === "User" ? "personal account" : "organization",
            children: sortedRepoItems,
          },
        };
      })
    );

    const items: StatusBarDropdownItem[] = orgEntries
      .filter(Boolean)
      .filter((entry): entry is { latestOrgPrUpdatedAt: number; item: StatusBarDropdownItem } =>
        Boolean(entry)
      )
      .sort((a, b) => b.latestOrgPrUpdatedAt - a.latestOrgPrUpdatedAt)
      .map((entry) => entry.item);

    return {
      label: "GitHub PRs",
      value: totalPrs,
      icon: "Github",
      items,
    };
  } catch (error) {
    console.error("[GitHub StatusBar] Failed to get status data:", error);
    return null;
  }
}
