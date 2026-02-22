/**
 * GitHub URL parser utilities.
 *
 * Detects GitHub Issue and Pull Request URLs so they can be opened
 * in the in-app details panels instead of a new browser tab.
 */

export interface GitHubIssueUrlInfo {
  type: "issue";
  owner: string;
  repo: string;
  number: number;
  htmlUrl: string;
}

export interface GitHubPrUrlInfo {
  type: "pr";
  owner: string;
  repo: string;
  number: number;
  htmlUrl: string;
}

export type GitHubUrlInfo = GitHubIssueUrlInfo | GitHubPrUrlInfo;

/**
 * Parses a URL string and returns structured info if it is a GitHub Issue or PR URL.
 * Returns null for any other URL.
 *
 * Handles:
 *   https://github.com/{owner}/{repo}/issues/{number}
 *   https://github.com/{owner}/{repo}/issues/{number}/...
 *   https://github.com/{owner}/{repo}/issues/{number}#...
 *   https://github.com/{owner}/{repo}/pull/{number}
 *   https://github.com/{owner}/{repo}/pull/{number}/...
 *   https://github.com/{owner}/{repo}/pull/{number}#...
 */
export function parseGitHubUrl(url: string): GitHubUrlInfo | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  if (parsed.hostname !== "github.com") {
    return null;
  }

  // pathname: /{owner}/{repo}/issues/{number}[/...]
  const issueMatch = parsed.pathname.match(
    /^\/([^/]+)\/([^/]+)\/issues\/(\d+)(?:\/.*)?$/
  );
  if (issueMatch) {
    const number = parseInt(issueMatch[3], 10);
    return {
      type: "issue",
      owner: issueMatch[1],
      repo: issueMatch[2],
      number,
      htmlUrl: `https://github.com/${issueMatch[1]}/${issueMatch[2]}/issues/${number}`,
    };
  }

  // pathname: /{owner}/{repo}/pull/{number}[/...]
  const prMatch = parsed.pathname.match(
    /^\/([^/]+)\/([^/]+)\/pull\/(\d+)(?:\/.*)?$/
  );
  if (prMatch) {
    const number = parseInt(prMatch[3], 10);
    return {
      type: "pr",
      owner: prMatch[1],
      repo: prMatch[2],
      number,
      htmlUrl: `https://github.com/${prMatch[1]}/${prMatch[2]}/pull/${number}`,
    };
  }

  return null;
}
