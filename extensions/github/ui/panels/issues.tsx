/**
 * GitHub Issues Panel
 *
 * Displays open GitHub issues with filtering by repo, label, author, and assignee.
 * Items open html_url in a new tab when clicked.
 */

"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { RefreshCw, ExternalLink, AlertCircle, Loader2, Search } from "lucide-react";
import type { ExtensionPanelProps } from "@/types/extension";
import { getApiInstance } from "../../api-instance";
import type { GitHubIssue, GitHubRepoRef, IssueFilters } from "../../api";

function formatRelativeTime(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

function extractRepoFullName(htmlUrl: string): string | null {
  try {
    const url = new URL(htmlUrl);
    const [, owner, repo] = url.pathname.split("/");
    if (!owner || !repo) return null;
    return `${owner}/${repo}`;
  } catch {
    return null;
  }
}

/** Choose a legible text color for a GitHub label hex color. */
function labelTextColor(hex: string): string {
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? "#000000" : "#ffffff";
}

const inputCls =
  "px-2 py-1 text-xs border border-border rounded bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring";

export function IssuesPanel(_props: ExtensionPanelProps) {
  const [items, setItems] = useState<GitHubIssue[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [repos, setRepos] = useState<GitHubRepoRef[]>([]);
  const [selectedRepo, setSelectedRepo] = useState("");

  // Filter inputs (applied on Enter or Refresh)
  const [searchInput, setSearchInput] = useState("");
  const [labelFilter, setLabelFilter] = useState("");
  const [authorFilter, setAuthorFilter] = useState("");
  const [assigneeFilter, setAssigneeFilter] = useState("");

  // Trigger counter — incrementing causes a re-fetch
  const [fetchTick, setFetchTick] = useState(0);

  const refresh = useCallback(() => setFetchTick((n) => n + 1), []);

  // Fetch issues whenever fetchTick or selectedRepo changes
  useEffect(() => {
    const api = getApiInstance();
    if (!api) {
      setError("GitHub extension is not initialized. Please complete onboarding.");
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    const filters: IssueFilters = {
      search: searchInput.trim() || undefined,
      label: labelFilter || undefined,
      author: authorFilter || undefined,
      assignee: assigneeFilter || undefined,
    };

    const repoScope = selectedRepo ? [selectedRepo] : repos.map((repo) => repo.fullName);

    api
      .searchIssuesPanel(filters, repoScope)
      .then((results) => {
        if (!cancelled) setItems(results);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load issues");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchTick, selectedRepo, repos, labelFilter, authorFilter, assigneeFilter]);

  // Load repos list once on mount
  useEffect(() => {
    const api = getApiInstance();
    if (!api) return;
    api
      .listAllRepos()
      .then(setRepos)
      .catch(() => {});
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") refresh();
  };

  const labelOptions = useMemo(
    () =>
      Array.from(new Set(items.flatMap((issue) => issue.labels?.map((label) => label.name) ?? []))).sort(
        (a, b) => a.localeCompare(b)
      ),
    [items]
  );

  const authorOptions = useMemo(
    () => Array.from(new Set(items.map((issue) => issue.user.login))).sort((a, b) => a.localeCompare(b)),
    [items]
  );

  const assigneeOptions = useMemo(
    () =>
      Array.from(
        new Set(items.flatMap((issue) => issue.assignees?.map((assignee) => assignee.login) ?? []))
      ).sort((a, b) => a.localeCompare(b)),
    [items]
  );

  return (
    <div className="flex flex-col h-full">
      {/* Filter bar */}
      <div className="flex-shrink-0 p-3 border-b border-border space-y-2">
        {/* Row 1: search + refresh */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              placeholder="Search issues… (Enter to apply)"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={handleKeyDown}
              className={`${inputCls} w-full pl-6`}
            />
          </div>
          <button
            onClick={refresh}
            disabled={loading}
            title="Refresh"
            className="flex items-center justify-center w-7 h-7 border border-border rounded hover:bg-accent disabled:opacity-50 text-muted-foreground"
          >
            {loading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <RefreshCw className="w-3.5 h-3.5" />
            )}
          </button>
        </div>

        {/* Row 2: filters */}
        <div className="flex gap-2 flex-wrap">
          <select
            value={selectedRepo}
            onChange={(e) => setSelectedRepo(e.target.value)}
            className={`${inputCls} min-w-[130px] max-w-[200px]`}
          >
            <option value="">All accessible repos</option>
            {repos.map((r) => (
              <option key={r.fullName} value={r.fullName}>
                {r.fullName}
              </option>
            ))}
          </select>

          <select
            value={labelFilter}
            onChange={(e) => setLabelFilter(e.target.value)}
            className={`${inputCls} min-w-[110px] max-w-[170px]`}
          >
            <option value="">All labels</option>
            {labelOptions.map((label) => (
              <option key={label} value={label}>
                {label}
              </option>
            ))}
          </select>
          <select
            value={authorFilter}
            onChange={(e) => setAuthorFilter(e.target.value)}
            className={`${inputCls} min-w-[110px] max-w-[170px]`}
          >
            <option value="">All authors</option>
            {authorOptions.map((author) => (
              <option key={author} value={author}>
                {author}
              </option>
            ))}
          </select>
          <select
            value={assigneeFilter}
            onChange={(e) => setAssigneeFilter(e.target.value)}
            className={`${inputCls} min-w-[110px] max-w-[170px]`}
          >
            <option value="">All assignees</option>
            {assigneeOptions.map((assignee) => (
              <option key={assignee} value={assignee}>
                {assignee}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Results */}
      <div className="flex-1 overflow-auto">
        {error && (
          <div className="flex items-start gap-2 m-3 p-3 text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {loading && items.length === 0 && (
          <div className="flex items-center justify-center gap-2 p-8 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading issues…
          </div>
        )}

        {!loading && !error && items.length === 0 && (
          <div className="flex items-center justify-center p-8 text-sm text-muted-foreground">
            No open issues found
          </div>
        )}

        {items.map((issue) => {
          const repoFullName = extractRepoFullName(issue.html_url);
          return (
          <button
            key={issue.number}
            onClick={() => window.open(issue.html_url, "_blank", "noopener,noreferrer")}
            className="w-full text-left px-3 py-2.5 border-b border-border hover:bg-accent group flex items-start gap-2"
          >
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="text-xs text-muted-foreground font-mono">#{issue.number}</span>
                <span className="text-sm font-medium text-foreground truncate">{issue.title}</span>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-muted-foreground">
                  by {issue.user.login}
                  {repoFullName ? ` in [${repoFullName}]` : ""}
                </span>
                {issue.labels?.map((label) => (
                  <span
                    key={label.name}
                    className="px-1.5 py-0.5 rounded-full text-[10px] font-medium"
                    style={{
                      backgroundColor: `#${label.color}`,
                      color: labelTextColor(label.color),
                    }}
                  >
                    {label.name}
                  </span>
                ))}
              </div>
            </div>
            <div className="flex-shrink-0 flex items-center gap-1.5 text-xs text-muted-foreground">
              <span>{formatRelativeTime(issue.updated_at)}</span>
              <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </button>
          );
        })}
      </div>
    </div>
  );
}
