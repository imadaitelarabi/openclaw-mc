/**
 * GitHub Pull Requests Panel
 *
 * Displays open GitHub pull requests with filtering by repo, label, author,
 * assignee, and a draft toggle. Items open html_url in a new tab when clicked.
 */

"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  RefreshCw,
  ExternalLink,
  AlertCircle,
  Loader2,
  Search,
  GitPullRequest,
} from "lucide-react";
import type { ExtensionPanelProps } from "@/types/extension";
import { useOptionalExtensions } from "@/contexts/ExtensionContext";
import { getApiInstance } from "../../api-instance";
import type { GitHubPR, GitHubRepoRef, PRFilters } from "../../api";
import { FilterDropdown } from "@/components/panels/FilterDropdown";

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

function labelTextColor(hex: string): string {
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? "#000000" : "#ffffff";
}

const inputCls =
  "px-2 py-1 text-xs border border-border rounded bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring";

export function PullRequestsPanel(_props: ExtensionPanelProps) {
  const extensionContext = useOptionalExtensions();
  const isExtensionContextLoading = extensionContext?.isLoading ?? false;
  const isGitHubEnabled = extensionContext?.isExtensionEnabled("github") ?? false;

  const [items, setItems] = useState<GitHubPR[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [repos, setRepos] = useState<GitHubRepoRef[]>([]);
  const [selectedRepo, setSelectedRepo] = useState("");

  // Filter inputs (applied on Enter or Refresh)
  const [searchInput, setSearchInput] = useState("");
  const [labelFilter, setLabelFilter] = useState("");
  const [authorFilter, setAuthorFilter] = useState("");
  const [assigneeFilter, setAssigneeFilter] = useState("");
  // Draft filter: undefined = all, true = draft only, false = non-draft only
  const [draftFilter, setDraftFilter] = useState<boolean | undefined>(undefined);

  // Trigger counter — incrementing causes a re-fetch
  const [fetchTick, setFetchTick] = useState(0);

  const refresh = useCallback(() => setFetchTick((n) => n + 1), []);

  // Fetch PRs whenever fetchTick, selectedRepo, or draftFilter changes
  useEffect(() => {
    if (isExtensionContextLoading) {
      setError(null);
      setLoading(false);
      return;
    }

    const api = getApiInstance();
    if (!api) {
      setLoading(false);
      setError(
        isGitHubEnabled
          ? "GitHub extension is still initializing. Please retry in a moment."
          : "GitHub extension is not initialized. Please complete onboarding."
      );
      return;
    }

    if (!selectedRepo) {
      setItems([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    const filters: PRFilters = {
      search: searchInput.trim() || undefined,
      label: labelFilter || undefined,
      author: authorFilter || undefined,
      assignee: assigneeFilter || undefined,
      isDraft: draftFilter,
    };

    api
      .searchPRsPanel(filters, selectedRepo)
      .then((results) => {
        if (!cancelled) setItems(results);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load pull requests");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    fetchTick,
    selectedRepo,
    draftFilter,
    repos,
    labelFilter,
    authorFilter,
    assigneeFilter,
    isExtensionContextLoading,
    isGitHubEnabled,
  ]);

  // Load repos list once on mount
  useEffect(() => {
    if (isExtensionContextLoading) {
      return;
    }

    const api = getApiInstance();
    if (!api) {
      setRepos([]);
      setSelectedRepo("");
      return;
    }

    setError(null);

    api
      .listAllRepos()
      .then((repoList) => {
        setRepos(repoList);
        setSelectedRepo((current) => current || repoList[0]?.fullName || "");
      })
      .catch(() => {});
  }, [isExtensionContextLoading, isGitHubEnabled]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") refresh();
  };

  const labelOptions = useMemo(
    () =>
      Array.from(new Set(items.flatMap((pr) => pr.labels?.map((label) => label.name) ?? []))).sort(
        (a, b) => a.localeCompare(b)
      ),
    [items]
  );

  const authorOptions = useMemo(
    () => Array.from(new Set(items.map((pr) => pr.user.login))).sort((a, b) => a.localeCompare(b)),
    [items]
  );

  const assigneeOptions = useMemo(
    () =>
      Array.from(
        new Set(items.flatMap((pr) => pr.assignees?.map((assignee) => assignee.login) ?? []))
      ).sort((a, b) => a.localeCompare(b)),
    [items]
  );

  useEffect(() => {
    setLabelFilter("");
    setAuthorFilter("");
    setAssigneeFilter("");
    setDraftFilter(undefined);
  }, [selectedRepo]);

  const repoOptions = useMemo(
    () => repos.map((repo) => ({ value: repo.fullName, label: repo.fullName })),
    [repos]
  );

  const labelDropdownOptions = useMemo(
    () => labelOptions.map((label) => ({ value: label, label })),
    [labelOptions]
  );

  const authorDropdownOptions = useMemo(
    () => authorOptions.map((author) => ({ value: author, label: author })),
    [authorOptions]
  );

  const assigneeDropdownOptions = useMemo(
    () => assigneeOptions.map((assignee) => ({ value: assignee, label: assignee })),
    [assigneeOptions]
  );

  const draftDropdownOptions = useMemo(
    () => [
      { value: "all", label: "All PRs" },
      { value: "draft", label: "Draft only" },
      { value: "ready", label: "Non-draft" },
    ],
    []
  );

  const draftDropdownValue =
    draftFilter === true ? "draft" : draftFilter === false ? "ready" : "all";

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
              placeholder="Search pull requests… (Enter to apply)"
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
          <FilterDropdown
            value={selectedRepo}
            onChange={setSelectedRepo}
            placeholder="Select repo"
            options={repoOptions}
            includeEmptyOption={false}
            disabled={repoOptions.length === 0}
            widthClassName="min-w-[170px] max-w-[240px]"
          />

          <FilterDropdown
            value={labelFilter}
            onChange={setLabelFilter}
            placeholder="All labels"
            options={labelDropdownOptions}
            widthClassName="min-w-[120px] max-w-[180px]"
          />
          <FilterDropdown
            value={authorFilter}
            onChange={setAuthorFilter}
            placeholder="All authors"
            options={authorDropdownOptions}
            widthClassName="min-w-[120px] max-w-[180px]"
          />
          <FilterDropdown
            value={assigneeFilter}
            onChange={setAssigneeFilter}
            placeholder="All assignees"
            options={assigneeDropdownOptions}
            widthClassName="min-w-[120px] max-w-[180px]"
          />

          <FilterDropdown
            value={draftDropdownValue}
            onChange={(value) => {
              if (value === "draft") {
                setDraftFilter(true);
              } else if (value === "ready") {
                setDraftFilter(false);
              } else {
                setDraftFilter(undefined);
              }
            }}
            placeholder="All PRs"
            options={draftDropdownOptions}
            includeEmptyOption={false}
            widthClassName="min-w-[110px] max-w-[160px]"
          />
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
            Loading pull requests…
          </div>
        )}

        {!loading && !error && repos.length === 0 && (
          <div className="flex items-center justify-center p-8 text-sm text-muted-foreground">
            No accessible repositories found
          </div>
        )}

        {!loading && !error && repos.length > 0 && !selectedRepo && (
          <div className="flex items-center justify-center p-8 text-sm text-muted-foreground">
            Select a repository to load pull requests
          </div>
        )}

        {!loading && !error && selectedRepo && items.length === 0 && (
          <div className="flex items-center justify-center p-8 text-sm text-muted-foreground">
            No open pull requests found
          </div>
        )}

        {items.map((pr) => {
          const repoFullName = extractRepoFullName(pr.html_url);
          return (
            <button
              key={pr.number}
              onClick={() => window.open(pr.html_url, "_blank", "noopener,noreferrer")}
              className="w-full text-left px-3 py-2.5 border-b border-border hover:bg-accent group flex items-start gap-2"
            >
              <GitPullRequest
                className={`w-3.5 h-3.5 flex-shrink-0 mt-0.5 ${
                  pr.draft ? "text-muted-foreground" : "text-green-500"
                }`}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="text-xs text-muted-foreground font-mono">#{pr.number}</span>
                  <span className="text-sm font-medium text-foreground truncate">{pr.title}</span>
                  {pr.draft && (
                    <span className="flex-shrink-0 px-1 py-0.5 text-[10px] font-medium bg-muted text-muted-foreground rounded">
                      Draft
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs text-muted-foreground">
                    by {pr.user.login}
                    {repoFullName ? ` in [${repoFullName}]` : ""}
                  </span>
                  {pr.labels?.map((label) => (
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
                <span>{formatRelativeTime(pr.updated_at)}</span>
                <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
