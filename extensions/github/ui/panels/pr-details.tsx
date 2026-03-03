/**
 * GitHub PR Details Panel
 *
 * Shows full details for a single pull request: title, status, author,
 * labels, body excerpt, timestamps, and a link to open in GitHub.
 * Supports write actions: merge, close, delete branch, add comment.
 */

"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  ExternalLink,
  AlertCircle,
  Loader2,
  RefreshCw,
  GitPullRequest,
  GitMerge,
  GitPullRequestClosed,
  ChevronDown,
  ChevronRight,
  MessageSquare,
  ArrowLeft,
  X,
  GitBranch,
  CheckCircle2,
  XCircle,
  Clock,
  Link,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { ExtensionPanelProps } from "@/types/extension";
import type { PanelBackNavigation } from "@/types";
import { useOptionalExtensions } from "@/contexts/ExtensionContext";
import { usePanels } from "@/contexts/PanelContext";
import { ConfirmationModal } from "@/components/modals/ConfirmationModal";
import { ExtensionActionBar } from "@/components/panels/ExtensionActionBar";
import { useExtensionActionBar } from "@/hooks/useExtensionActionBar";
import { uiStateStore } from "@/lib/ui-state-db";
import { getApiInstance } from "../../api-instance";
import type {
  GitHubPR,
  GitHubComment,
  GitHubPRReview,
  GitHubPRCommit,
  GitHubTimelineEvent,
  GitHubAssignableUser,
  GitHubCheckRun,
  GitHubWorkflowRun,
  GitHubReactions,
} from "../../api";

const ACTIVITY_PAGE_SIZE = 10;
const DEFAULT_POLL_INTERVAL_MS = 30_000;

type ReactionKey = keyof Omit<GitHubReactions, "total_count">;
const REACTION_ENTRIES: Array<[ReactionKey, string]> = [
  ["+1", "👍"],
  ["-1", "👎"],
  ["laugh", "😄"],
  ["hooray", "🎉"],
  ["confused", "😕"],
  ["heart", "❤️"],
  ["rocket", "🚀"],
  ["eyes", "👀"],
];

function parsePollingIntervalMs(value?: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1_000) return DEFAULT_POLL_INTERVAL_MS;
  return parsed;
}

const MERGE_METHOD_LABELS: Record<"merge" | "squash" | "rebase", string> = {
  merge: "Merge",
  squash: "Squash and merge",
  rebase: "Rebase and merge",
};

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function labelTextColor(hex: string): string {
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? "#000000" : "#ffffff";
}

function UserAvatar({ src, alt, size = 16 }: { src?: string; alt: string; size?: number }) {
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={alt}
        width={size}
        height={size}
        className="rounded-full object-cover flex-shrink-0"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className="rounded-full bg-muted flex items-center justify-center flex-shrink-0 text-[8px] font-medium text-muted-foreground"
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      {alt[0]?.toUpperCase() ?? "?"}
    </div>
  );
}

function prTimelineEventLabel(event: GitHubTimelineEvent): string | null {
  switch (event.event) {
    case "assigned":
      return `assigned ${event.assignee?.login ?? "someone"}`;
    case "unassigned":
      return `unassigned ${event.assignee?.login ?? "someone"}`;
    case "labeled":
      return `added label "${event.label?.name ?? ""}"`;
    case "unlabeled":
      return `removed label "${event.label?.name ?? ""}"`;
    case "closed":
      return "closed this pull request";
    case "reopened":
      return "reopened this pull request";
    case "merged":
      return "merged";
    case "review_requested":
      return "requested a review";
    case "review_request_removed":
      return "removed review request";
    case "review_dismissed":
      return "dismissed a review";
    case "ready_for_review":
      return "marked this pull request as ready for review";
    case "mentioned":
      return "mentioned this pull request";
    case "subscribed":
      return "subscribed to this pull request";
    case "renamed": {
      const from = event.rename?.from;
      const to = event.rename?.to;
      if (from && to) return `renamed this pull request from "${from}" to "${to}"`;
      return "renamed this pull request";
    }
    case "copilot_work_started":
      return "started Copilot work";
    case "copilot_work_finished":
      return "finished Copilot work";
    default:
      return null;
  }
}

interface GitHubPrDetailsPanelProps extends ExtensionPanelProps {
  owner?: string;
  repo?: string;
  number?: number;
  htmlUrl?: string;
  contextPanelId?: string;
  back?: PanelBackNavigation;
}

export function GitHubPrDetailsPanel({
  owner,
  repo,
  number,
  htmlUrl,
  contextPanelId,
  back,
}: GitHubPrDetailsPanelProps) {
  const { replacePanel, openPanel } = usePanels();
  const extensionContext = useOptionalExtensions();
  const isExtensionContextLoading = extensionContext?.isLoading ?? false;
  const isGitHubEnabled = extensionContext?.isExtensionEnabled("github") ?? false;

  const [pr, setPr] = useState<GitHubPR | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [githubInitAttempted, setGitHubInitAttempted] = useState(false);
  const [githubInitLoading, setGitHubInitLoading] = useState(false);
  const [githubInitError, setGitHubInitError] = useState<string | null>(null);

  const [bodyExpanded, setBodyExpanded] = useState(true);

  const [issueComments, setIssueComments] = useState<GitHubComment[]>([]);
  const [issueCommentsLoading, setIssueCommentsLoading] = useState(false);
  const [issueCommentsError, setIssueCommentsError] = useState<string | null>(null);
  const [displayedActivityCount, setDisplayedActivityCount] = useState(ACTIVITY_PAGE_SIZE);

  // PR review summaries state
  const [prReviews, setPrReviews] = useState<GitHubPRReview[]>([]);

  // PR commits state
  const [prCommits, setPrCommits] = useState<GitHubPRCommit[]>([]);

  // Timeline state
  const [timeline, setTimeline] = useState<GitHubTimelineEvent[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(false);

  // Check runs state
  const [checkRuns, setCheckRuns] = useState<GitHubCheckRun[]>([]);
  const [checksExpanded, setChecksExpanded] = useState(true);
  // Workflow runs (for "Awaiting approval" grouping)
  const [workflowRuns, setWorkflowRuns] = useState<GitHubWorkflowRun[]>([]);
  const [showApproveConfirm, setShowApproveConfirm] = useState<number | null>(null);
  const [approveLoading, setApproveLoading] = useState(false);
  const [approveError, setApproveError] = useState<string | null>(null);
  const [approveMessage, setApproveMessage] = useState<string | null>(null);

  // Reviewer dropdown state
  const [reviewableUsers, setReviewableUsers] = useState<GitHubAssignableUser[]>([]);
  const [reviewableLoading, setReviewableLoading] = useState(false);
  const [reviewSearch, setReviewSearch] = useState("");
  const [showReviewDropdown, setShowReviewDropdown] = useState(false);
  const [reviewDropdownPos, setReviewDropdownPos] = useState<{
    left: number;
    bottom: number;
  } | null>(null);
  const panelRootRef = useRef<HTMLDivElement | null>(null);
  const reviewDropdownRef = useRef<HTMLDivElement | null>(null);
  const postActionRefreshTimersRef = useRef<number[]>([]);

  const pendingSilentRefreshRef = useRef(false);
  const isFetchingRef = useRef(false);

  // Trigger counter — incrementing causes a re-fetch
  const [fetchTick, setFetchTick] = useState(0);
  const triggerRefresh = useCallback((silent = false) => {
    pendingSilentRefreshRef.current = silent;
    setFetchTick((n) => n + 1);
  }, []);
  const refresh = useCallback(() => triggerRefresh(false), [triggerRefresh]);
  const refreshSilently = useCallback(() => triggerRefresh(true), [triggerRefresh]);
  const refreshAfterAction = useCallback(() => {
    refreshSilently();
    const timer = window.setTimeout(() => {
      refreshSilently();
      postActionRefreshTimersRef.current = postActionRefreshTimersRef.current.filter(
        (id) => id !== timer
      );
    }, 1500);
    postActionRefreshTimersRef.current.push(timer);
  }, [refreshSilently]);

  // Write-action state
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState<{
    action: "merge" | "close";
    mergeMethod?: "merge" | "squash" | "rebase";
  } | null>(null);
  const [commentText, setCommentText] = useState("");

  const [pollingEnabled, setPollingEnabled] = useState(false);
  const [pollingIntervalMs, setPollingIntervalMs] = useState(DEFAULT_POLL_INTERVAL_MS);

  // ── Action bar (built before early returns to satisfy Rules of Hooks) ───
  // Merge is disabled for draft PRs (UI + server-side guard in handleMerge).
  const isMergeDisabled = (pr?.draft ?? false) || actionLoading !== null;
  const mergeDisabledReason = pr?.draft
    ? "Draft pull requests cannot be merged. Mark as ready for review first."
    : undefined;

  const actionBar = useExtensionActionBar({
    actions: pr
      ? [
          ...(pr.state === "open"
            ? [
                {
                  id: "request-review",
                  label: "Request Review",
                  icon: "request-review",
                  variant: "default" as const,
                  disabled: actionLoading !== null,
                  onClick: () => {
                    setReviewSearch("");
                    setShowReviewDropdown(true);
                  },
                },
                ...(pr.draft
                  ? [
                      {
                        id: "ready-for-review",
                        label: "Mark ready for review",
                        icon: "ready-for-review",
                        variant: "success" as const,
                        disabled: actionLoading !== null,
                        loading: actionLoading === "ready-for-review",
                        onClick: () => handleMarkReadyForReview(),
                      },
                    ]
                  : []),
                {
                  id: "merge",
                  label: "Merge",
                  icon: "merge",
                  variant: "success" as const,
                  disabled: isMergeDisabled,
                  disabledReason: mergeDisabledReason,
                  loading: actionLoading === "merge",
                  onClick: () => setShowConfirm({ action: "merge", mergeMethod: "merge" }),
                  dropdownItems: [
                    {
                      id: "merge-squash",
                      label: "Squash and merge",
                      disabled: isMergeDisabled,
                      disabledReason: mergeDisabledReason,
                      onClick: () => setShowConfirm({ action: "merge", mergeMethod: "squash" }),
                    },
                    {
                      id: "merge-rebase",
                      label: "Rebase and merge",
                      disabled: isMergeDisabled,
                      disabledReason: mergeDisabledReason,
                      onClick: () => setShowConfirm({ action: "merge", mergeMethod: "rebase" }),
                    },
                  ],
                },
                {
                  id: "close",
                  label: "Close PR",
                  icon: "close",
                  variant: "danger" as const,
                  disabled: actionLoading !== null,
                  loading: actionLoading === "close",
                  onClick: () => setShowConfirm({ action: "close" }),
                },
              ]
            : []),
          {
            id: "review-comments",
            label: "Changes",
            icon: "review-comments",
            variant: "ghost" as const,
            onClick: () =>
              contextPanelId
                ? replacePanel(contextPanelId, "github-pr-review-comments", {
                    owner,
                    repo,
                    number,
                    back: {
                      type: "github-pr-details" as const,
                      data: { owner, repo, number, htmlUrl, back },
                    },
                  })
                : openPanel("github-pr-review-comments", {
                    owner,
                    repo,
                    number,
                    back: {
                      type: "github-pr-details" as const,
                      data: { owner, repo, number, htmlUrl, back },
                    },
                  }),
          },
          {
            id: "open-github",
            label: "Open in GitHub",
            icon: "open-github",
            variant: "ghost" as const,
            onClick: () => window.open(pr.html_url, "_blank", "noopener,noreferrer"),
          },
          {
            id: "open-vscode",
            label: "Open in VSCode",
            icon: "open-vscode",
            variant: "ghost" as const,
            disabled: !pr.head?.ref || !pr.head?.repo?.full_name || actionLoading !== null,
            disabledReason:
              !pr.head?.ref || !pr.head?.repo?.full_name
                ? "Branch information is not available for this PR"
                : undefined,
            loading: actionLoading === "open-vscode",
            onClick: () => {
              const cloneUrl = pr.head?.repo?.clone_url;
              const fullName = pr.head?.repo?.full_name;
              const branch = pr.head?.ref;
              if (!cloneUrl || !fullName || !branch) return;
              handleOpenInVSCode(cloneUrl, fullName, branch);
            },
            dropdownItems:
              pr.head?.ref && pr.head?.repo?.full_name
                ? [
                    {
                      id: "open-vscode-web",
                      label: "Open in VSCode (Web)",
                      onClick: () => {
                        const fullName = pr.head?.repo?.full_name;
                        const branch = pr.head?.ref;
                        if (!fullName || !branch) return;
                        window.open(
                          `https://vscode.dev/github/${fullName}/tree/${encodeURIComponent(branch)}`,
                          "_blank",
                          "noopener,noreferrer"
                        );
                      },
                    },
                  ]
                : undefined,
          },
        ]
      : [],
    error: actionError,
    onDismissError: () => setActionError(null),
  });

  useEffect(() => {
    uiStateStore.getExtensionFilters("github:settings").then((saved) => {
      if (saved?.pollingEnabled === "true") setPollingEnabled(true);
      if (saved?.pollingIntervalMs) {
        setPollingIntervalMs(parsePollingIntervalMs(saved.pollingIntervalMs));
      }
    });

    const onSettingsChanged = (e: Event) => {
      const detail = (e as CustomEvent<{ pollingEnabled?: boolean; pollingIntervalMs?: number }>)
        .detail;
      if (typeof detail?.pollingEnabled === "boolean") {
        setPollingEnabled(detail.pollingEnabled);
      }
      if (typeof detail?.pollingIntervalMs === "number") {
        setPollingIntervalMs(parsePollingIntervalMs(String(detail.pollingIntervalMs)));
      }
    };
    window.addEventListener("github:settings:changed", onSettingsChanged);
    return () => window.removeEventListener("github:settings:changed", onSettingsChanged);
  }, []);

  useEffect(() => {
    if (!pollingEnabled) return;
    const id = setInterval(() => {
      if (!document.hidden && !isFetchingRef.current) {
        triggerRefresh(true);
      }
    }, pollingIntervalMs);
    return () => clearInterval(id);
  }, [pollingEnabled, pollingIntervalMs, triggerRefresh]);

  useEffect(() => {
    if (isExtensionContextLoading) return;
    if (isGitHubEnabled) return;
    if (githubInitAttempted || githubInitLoading) return;
    if (!extensionContext?.enableExtension) return;

    let cancelled = false;
    setGitHubInitAttempted(true);
    setGitHubInitLoading(true);
    setGitHubInitError(null);

    extensionContext
      .enableExtension("github")
      .then(() => {
        if (!cancelled) {
          refresh();
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setGitHubInitError(
            e instanceof Error ? e.message : "Failed to initialize GitHub extension"
          );
        }
      })
      .finally(() => {
        if (!cancelled) setGitHubInitLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [
    extensionContext,
    githubInitAttempted,
    githubInitLoading,
    isExtensionContextLoading,
    isGitHubEnabled,
    refresh,
  ]);

  useEffect(() => {
    if (!owner || !repo || !number) return;

    if (isExtensionContextLoading) {
      setError(null);
      setLoading(false);
      return;
    }

    const api = getApiInstance();
    if (!api) {
      if (!isGitHubEnabled && (githubInitLoading || !githubInitAttempted)) {
        setError("Initializing GitHub extension…");
        return;
      }
      setLoading(false);
      setError(
        githubInitError ??
          (isGitHubEnabled
            ? "GitHub extension is still initializing. Please retry in a moment."
            : "GitHub extension is not initialized. Please complete onboarding.")
      );
      return;
    }

    let cancelled = false;
    const isSilentRefresh = pendingSilentRefreshRef.current;
    pendingSilentRefreshRef.current = false;
    isFetchingRef.current = true;

    if (!isSilentRefresh) {
      setLoading(true);
      setError(null);
      setIssueCommentsError(null);
      setIssueCommentsLoading(true);
      setTimelineLoading(true);
      setDisplayedActivityCount(ACTIVITY_PAGE_SIZE);
    }

    const detailsFetch = api.getPRDetails(owner, repo, number);

    const detailsPromise = detailsFetch
      .then((result) => {
        if (!cancelled) setPr(result);
      })
      .catch((e) => {
        if (!cancelled && !isSilentRefresh) {
          setError(e instanceof Error ? e.message : "Failed to load pull request details");
        }
      })
      .finally(() => {
        if (!cancelled && !isSilentRefresh) setLoading(false);
      });

    // Checks + workflow runs share the head SHA from the freshly-fetched PR details
    // so they are always in sync with the same polling tick.
    const checksAndRunsPromise = detailsFetch
      .then((result) => {
        const headSha = result.head?.sha;
        if (!headSha || cancelled) return;
        return Promise.allSettled([
          api
            .getCheckRuns(owner, repo, headSha)
            .then((runs) => {
              if (!cancelled) setCheckRuns(runs);
            })
            .catch(() => {
              if (!cancelled) setCheckRuns([]);
            }),
          api
            .listWorkflowRuns(owner, repo, { headSha, perPage: 30 })
            .then((runs) => {
              if (!cancelled) setWorkflowRuns(runs);
            })
            .catch(() => {
              if (!cancelled) setWorkflowRuns([]);
            }),
        ]);
      })
      .catch(() => {});

    const commentsPromise = api
      .getIssueComments(owner, repo, number)
      .then((result) => {
        if (!cancelled) setIssueComments(result);
      })
      .catch((e) => {
        if (!cancelled && !isSilentRefresh) {
          setIssueCommentsError(e instanceof Error ? e.message : "Failed to load comments");
        }
      })
      .finally(() => {
        if (!cancelled && !isSilentRefresh) setIssueCommentsLoading(false);
      });

    const timelinePromise = api
      .getIssueTimeline(owner, repo, number)
      .then((result) => {
        if (!cancelled) setTimeline(result);
      })
      .catch(() => {
        if (!cancelled) setTimeline([]);
      })
      .finally(() => {
        if (!cancelled) setTimelineLoading(false);
      });

    const reviewsPromise = api
      .getPRReviews(owner, repo, number)
      .then((result) => {
        if (!cancelled) setPrReviews(result);
      })
      .catch((e) => {
        console.error("[PRDetails] Failed to fetch PR reviews:", e);
        if (!cancelled) setPrReviews([]);
      });

    const commitsPromise = api
      .getPRCommits(owner, repo, number)
      .then((result) => {
        if (!cancelled) setPrCommits(result);
      })
      .catch((e) => {
        console.error("[PRDetails] Failed to fetch PR commits:", e);
        if (!cancelled) setPrCommits([]);
      });

    Promise.allSettled([
      detailsPromise,
      checksAndRunsPromise,
      commentsPromise,
      timelinePromise,
      reviewsPromise,
      commitsPromise,
    ]).finally(() => {
      isFetchingRef.current = false;
    });

    return () => {
      cancelled = true;
    };
  }, [owner, repo, number, isExtensionContextLoading, isGitHubEnabled, fetchTick]);

  // Fetch reviewable users when dropdown is opened
  useEffect(() => {
    if (!showReviewDropdown || !owner || !repo) return;
    const api = getApiInstance();
    if (!api) return;
    setReviewableLoading(true);
    api
      .getAssignableUsers(owner, repo)
      .then((users) => setReviewableUsers(users))
      .catch(() => setReviewableUsers([]))
      .finally(() => setReviewableLoading(false));
  }, [showReviewDropdown, owner, repo]);

  // Position reviewer dropdown above action bar
  useEffect(() => {
    if (!showReviewDropdown) return;
    const updatePosition = () => {
      const root = panelRootRef.current;
      if (!root) return;
      const reviewAction = root.querySelector<HTMLElement>('[data-action-id="request-review"]');
      if (!reviewAction) return;
      const rootRect = root.getBoundingClientRect();
      const actionRect = reviewAction.getBoundingClientRect();
      const left = Math.max(12, actionRect.left - rootRect.left - 8);
      const bottom = Math.max(44, rootRect.bottom - actionRect.top + 8);
      setReviewDropdownPos({ left, bottom });
    };
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [showReviewDropdown]);

  // Close reviewer dropdown when clicking outside
  useEffect(() => {
    if (!showReviewDropdown) return;
    const handleOutsidePointer = (event: MouseEvent | TouchEvent) => {
      const targetNode = event.target as Node | null;
      if (!targetNode) return;
      if (reviewDropdownRef.current?.contains(targetNode)) return;
      setShowReviewDropdown(false);
    };
    document.addEventListener("mousedown", handleOutsidePointer);
    document.addEventListener("touchstart", handleOutsidePointer);
    return () => {
      document.removeEventListener("mousedown", handleOutsidePointer);
      document.removeEventListener("touchstart", handleOutsidePointer);
    };
  }, [showReviewDropdown]);

  useEffect(() => {
    return () => {
      postActionRefreshTimersRef.current.forEach((id) => window.clearTimeout(id));
      postActionRefreshTimersRef.current = [];
    };
  }, []);

  const fallbackUrl =
    htmlUrl ||
    (owner && repo && number ? `https://github.com/${owner}/${repo}/pull/${number}` : undefined);

  // ── Write-action handlers ─────────────────────────────────────────────

  const handleMerge = async (method: "merge" | "squash" | "rebase") => {
    if (!owner || !repo || !number) return;
    // Server-side guard: refuse to merge draft PRs even if somehow invoked
    if (pr?.draft) {
      setActionError("Draft pull requests cannot be merged. Mark it as ready for review first.");
      return;
    }
    setActionLoading("merge");
    setActionError(null);
    setShowConfirm(null);
    try {
      const api = getApiInstance();
      if (!api) throw new Error("GitHub API not initialized");
      await api.mergePR(owner, repo, number, { merge_method: method });
      const updated = await api.getPRDetails(owner, repo, number);
      setPr(updated);
      refreshAfterAction();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Failed to merge PR");
    } finally {
      setActionLoading(null);
    }
  };

  const handleClosePR = async () => {
    if (!owner || !repo || !number) return;
    setActionLoading("close");
    setActionError(null);
    setShowConfirm(null);
    try {
      const api = getApiInstance();
      if (!api) throw new Error("GitHub API not initialized");
      await api.closePR(owner, repo, number);
      const updated = await api.getPRDetails(owner, repo, number);
      setPr(updated);
      refreshAfterAction();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Failed to close PR");
    } finally {
      setActionLoading(null);
    }
  };

  const handleMarkReadyForReview = async () => {
    if (!owner || !repo || !number) return;
    setActionLoading("ready-for-review");
    setActionError(null);
    try {
      const api = getApiInstance();
      if (!api) throw new Error("GitHub API not initialized");
      await api.markPrReadyForReview(owner, repo, number, pr?.node_id);
      const updated = await api.getPRDetails(owner, repo, number);
      setPr(updated);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Failed to mark PR as ready for review");
    } finally {
      setActionLoading(null);
    }
  };

  const handleOpenInVSCode = async (cloneUrl: string, fullName: string, branch: string) => {
    setActionLoading("open-vscode");
    setActionError(null);
    try {
      const missionControle = window.location.pathname.startsWith("/mission-controle");
      const openApiBase = missionControle
        ? "/mission-controle/api/vscode/open"
        : "/api/vscode/open";
      const selectFolderApiBase = missionControle
        ? "/mission-controle/api/vscode/select-folder"
        : "/api/vscode/select-folder";

      const callOpen = async (selectedPath?: string) => {
        const response = await fetch(openApiBase, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cloneUrl, fullName, branch, selectedPath }),
        });
        const result = await response.json();
        if (!response.ok) {
          throw new Error(result.error || `Server error ${response.status}`);
        }
        return result as { mode: string; webUrl: string; message?: string };
      };

      const askFolderSelection = async () => {
        const response = await fetch(selectFolderApiBase, { method: "POST" });
        const result = await response.json();
        if (!response.ok) {
          throw new Error(result.error || `Server error ${response.status}`);
        }
        return result as { canceled?: boolean; path?: string; error?: string };
      };

      let result = await callOpen();

      if (result.mode === "needs-folder") {
        const selection = await askFolderSelection();
        if (selection.error) {
          throw new Error(selection.error);
        }
        if (selection.canceled || !selection.path) {
          setActionError("Open in VSCode canceled.");
          return;
        }
        result = await callOpen(selection.path);
      }

      if (result.mode === "web") {
        window.open(result.webUrl, "_blank", "noopener,noreferrer");
      }

      if (result.message) {
        setActionError(result.message);
      }
      // For desktop mode, VS Code opens locally – no further client action needed.
    } catch (err) {
      // Server unreachable or returned an error – open vscode.dev directly.
      window.open(
        `https://vscode.dev/github/${fullName}/tree/${encodeURIComponent(branch)}`,
        "_blank",
        "noopener,noreferrer"
      );
      setActionError(
        `Could not open VS Code locally (${err instanceof Error ? err.message : "unknown error"}) – opened vscode.dev instead.`
      );
    } finally {
      setActionLoading(null);
    }
  };

  const handleAddComment = async () => {
    if (!owner || !repo || !number || !commentText.trim()) return;
    setActionLoading("comment");
    setActionError(null);
    try {
      const api = getApiInstance();
      if (!api) throw new Error("GitHub API not initialized");
      const newComment = await api.addComment(owner, repo, number, commentText.trim());
      setIssueComments((prev) => [...prev, newComment]);
      setCommentText("");
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Failed to post comment");
    } finally {
      setActionLoading(null);
    }
  };

  const handleRequestReviewer = async (login: string) => {
    if (!owner || !repo || !number) return;
    const previousPr = pr;
    if (pr) {
      const reviewableUser = reviewableUsers.find((u) => u.login === login);
      setPr({
        ...pr,
        requested_reviewers: [
          ...(pr.requested_reviewers ?? []).filter((r) => r.login !== login),
          { login, avatar_url: reviewableUser?.avatar_url, html_url: reviewableUser?.html_url },
        ],
      });
    }
    setActionLoading("request-review");
    setActionError(null);
    setShowReviewDropdown(false);
    try {
      const api = getApiInstance();
      if (!api) throw new Error("GitHub API not initialized");
      await api.requestReviewers(owner, repo, number, [login]);
      const updated = await api.getPRDetails(owner, repo, number);
      setPr(updated);
    } catch (e) {
      setPr(previousPr);
      setShowReviewDropdown(true);
      setActionError(e instanceof Error ? e.message : "Failed to request reviewer");
    } finally {
      setActionLoading(null);
    }
  };

  const handleRemoveReviewer = async (login: string) => {
    if (!owner || !repo || !number) return;
    setActionLoading(`remove-reviewer-${login}`);
    setActionError(null);
    try {
      const api = getApiInstance();
      if (!api) throw new Error("GitHub API not initialized");
      await api.removeReviewers(owner, repo, number, [login]);
      const updated = await api.getPRDetails(owner, repo, number);
      setPr(updated);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Failed to remove reviewer");
    } finally {
      setActionLoading(null);
    }
  };

  // Filtered reviewer users for search
  const filteredReviewableUsers = useMemo(() => {
    const q = reviewSearch.toLowerCase().trim();
    if (!q) return reviewableUsers;
    return reviewableUsers.filter(
      (u) => u.login.toLowerCase().includes(q) || (u.name && u.name.toLowerCase().includes(q))
    );
  }, [reviewableUsers, reviewSearch]);

  const isForkPR = useMemo(() => {
    const headFullName = pr?.head?.repo?.full_name;
    const baseFullName = pr?.base?.repo?.full_name;
    if (!headFullName || !baseFullName) return false;
    return headFullName.toLowerCase() !== baseFullName.toLowerCase();
  }, [pr]);

  const handleApproveRun = async (runId: number) => {
    if (!owner || !repo) return;
    if (!isForkPR) {
      setApproveError(
        "This run is not from a fork pull request. 'Approve & run' is only supported for fork PR workflow approvals."
      );
      setApproveMessage(null);
      setShowApproveConfirm(null);
      return;
    }
    setApproveLoading(true);
    setApproveError(null);
    setApproveMessage(null);
    try {
      const api = getApiInstance();
      if (!api) throw new Error("GitHub API not initialized");
      await api.approveWorkflowRun(owner, repo, runId);
      setApproveMessage("Approval sent. The workflow should start shortly.");
      setShowApproveConfirm(null);
      refreshSilently();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to approve workflow run";
      const isPermissionError =
        msg.includes("403") ||
        msg.includes("401") ||
        msg.includes("Must have admin rights") ||
        msg.includes("Resource not accessible");
      setApproveError(
        isPermissionError
          ? "Cannot approve: your token is missing Actions write permission or you don't have admin access to this repository."
          : msg
      );
      setApproveMessage(null);
      setShowApproveConfirm(null);
    } finally {
      setApproveLoading(false);
    }
  };

  const handleRerunRun = async (runId: number) => {
    if (!owner || !repo) return;
    setApproveLoading(true);
    setApproveError(null);
    setApproveMessage(null);
    try {
      const api = getApiInstance();
      if (!api) throw new Error("GitHub API not initialized");
      await api.rerunWorkflowRun(owner, repo, runId);
      setApproveMessage("Re-run requested. GitHub is scheduling the new run.");
      refreshSilently();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to re-run workflow run";
      const msgLower = msg.toLowerCase();
      if (msgLower.includes("already running")) {
        setApproveError(null);
        setApproveMessage("This workflow is already running.");
        refreshSilently();
        return;
      }
      const isPermissionError =
        msg.includes("403") ||
        msg.includes("401") ||
        msg.includes("Must have admin rights") ||
        msg.includes("Resource not accessible");
      setApproveError(
        isPermissionError
          ? "Cannot re-run: your token is missing Actions write permission or you don't have sufficient access to this repository."
          : msg
      );
      setApproveMessage(null);
    } finally {
      setApproveLoading(false);
    }
  };

  // Merged activity: issue comments + timeline events + review summaries + commits
  const activityItems = useMemo(() => {
    const commentItems = issueComments.map((comment) => ({
      type: "comment" as const,
      id: `comment-${comment.id}`,
      createdAt: comment.created_at,
      comment,
    }));

    const timelineItems = timeline
      .map((event, index) => {
        const label = prTimelineEventLabel(event);
        if (!label || !event.created_at) return null;
        return {
          type: "timeline" as const,
          id: `timeline-${event.id ?? `${event.event}-${index}`}`,
          createdAt: event.created_at,
          event,
          label,
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);

    const reviewItems = prReviews
      .filter((r) => r.submitted_at && r.body)
      .map((r) => ({
        type: "review" as const,
        id: `review-${r.id}`,
        createdAt: r.submitted_at!,
        review: r,
      }));

    const commitItems = prCommits
      .filter((c) => c.commit.author?.date)
      .map((c) => ({
        type: "commit" as const,
        id: `commit-${c.sha}`,
        createdAt: c.commit.author!.date,
        commit: c,
      }));

    return [...commentItems, ...timelineItems, ...reviewItems, ...commitItems].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
  }, [issueComments, timeline, prReviews, prCommits]);

  if (!owner || !repo || !number) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
        No pull request selected.
      </div>
    );
  }

  if (isExtensionContextLoading) {
    return (
      <div className="flex items-center justify-center gap-2 p-8 text-sm text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading GitHub extension…
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 p-8 text-sm text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading pull request…
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 space-y-3">
        <div className="flex items-start gap-2 p-3 text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
        {fallbackUrl && (
          <a
            href={fallbackUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
          >
            <ExternalLink className="w-3 h-3" />
            Open in GitHub
          </a>
        )}
      </div>
    );
  }

  if (!pr) return null;

  const StatusIcon =
    pr.state === "closed" ? GitPullRequestClosed : pr.draft ? GitPullRequest : GitMerge;

  const statusColor =
    pr.state === "closed" ? "text-red-500" : pr.draft ? "text-muted-foreground" : "text-green-500";

  const statusLabel = pr.state === "closed" ? "Closed" : pr.draft ? "Draft" : "Open";

  const visibleActivity = activityItems.slice(
    Math.max(0, activityItems.length - displayedActivityCount)
  );
  const hasMoreActivity = displayedActivityCount < activityItems.length;

  return (
    <div ref={panelRootRef} className="relative flex flex-col h-full">
      <div className="flex-1 overflow-auto p-4 space-y-4">
        {/* Back button */}
        {back && contextPanelId && (
          <div>
            <button
              onClick={() => replacePanel(contextPanelId, back.type, back.data)}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Back
            </button>
          </div>
        )}

        {/* Header */}
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <StatusIcon className={`w-4 h-4 flex-shrink-0 ${statusColor}`} />
            <span
              className={`text-xs font-medium px-1.5 py-0.5 rounded border ${
                pr.state === "closed"
                  ? "border-red-500/40 text-red-500"
                  : pr.draft
                    ? "border-border text-muted-foreground"
                    : "border-green-500/40 text-green-500"
              }`}
            >
              {statusLabel}
            </span>
            <span className="text-xs text-muted-foreground font-mono">
              {owner}/{repo}#{pr.number}
            </span>
            <button
              onClick={refresh}
              disabled={loading}
              title="Refresh"
              aria-label="Refresh PR"
              className="ml-auto flex items-center justify-center w-6 h-6 rounded hover:bg-accent disabled:opacity-50 text-muted-foreground transition-colors"
            >
              {loading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
          <h2 className="text-base font-semibold text-foreground leading-snug">{pr.title}</h2>
          {/* Branch: source → target */}
          {pr.head?.ref && pr.base?.ref && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground font-mono mt-0.5">
              <GitBranch className="w-3 h-3 flex-shrink-0" />
              <span className="text-foreground">{pr.head.ref}</span>
              <span>→</span>
              <span className="text-foreground">{pr.base.ref}</span>
            </div>
          )}
        </div>

        {/* Meta */}
        <div className="text-xs text-muted-foreground space-y-1.5">
          {/* Author */}
          <div className="flex items-center gap-1.5">
            <span className="font-medium text-foreground">Author:</span>
            <UserAvatar src={pr.user.avatar_url} alt={pr.user.login} size={16} />
            {pr.user.html_url ? (
              <a
                href={pr.user.html_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-foreground hover:underline"
              >
                {pr.user.login}
              </a>
            ) : (
              <span className="text-foreground">{pr.user.login}</span>
            )}
          </div>

          {/* Assignees */}
          {pr.assignees && pr.assignees.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-medium text-foreground">Assignees:</span>
              {pr.assignees.map((a) => (
                <span key={a.login} className="inline-flex items-center gap-1">
                  <UserAvatar src={a.avatar_url} alt={a.login} size={14} />
                  {a.html_url ? (
                    <a
                      href={a.html_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-foreground hover:underline"
                    >
                      {a.login}
                    </a>
                  ) : (
                    <span className="text-foreground">{a.login}</span>
                  )}
                </span>
              ))}
            </div>
          )}

          {/* Reviewers */}
          {pr.requested_reviewers && pr.requested_reviewers.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-medium text-foreground">Reviewers:</span>
              {pr.requested_reviewers.map((r) => (
                <span key={r.login} className="inline-flex items-center gap-1">
                  <UserAvatar src={r.avatar_url} alt={r.login} size={14} />
                  {r.html_url ? (
                    <a
                      href={r.html_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-foreground hover:underline"
                    >
                      {r.login}
                    </a>
                  ) : (
                    <span className="text-foreground">{r.login}</span>
                  )}
                  {pr.state === "open" && (
                    <button
                      onClick={() => handleRemoveReviewer(r.login)}
                      disabled={actionLoading !== null}
                      className="text-muted-foreground hover:text-destructive disabled:opacity-50 ml-0.5"
                      aria-label={`Remove reviewer ${r.login}`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </span>
              ))}
            </div>
          )}

          <div>
            <span className="font-medium text-foreground">Opened:</span> {formatDate(pr.created_at)}
          </div>
          <div>
            <span className="font-medium text-foreground">Updated:</span>{" "}
            {formatDate(pr.updated_at)}
          </div>
        </div>

        {/* Labels */}
        {pr.labels && pr.labels.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {pr.labels.map((label) => (
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
        )}

        {/* Body */}
        {pr.body && (
          <div className="border border-border rounded bg-muted/20">
            <button
              onClick={() => setBodyExpanded((v) => !v)}
              className="flex items-center gap-1.5 w-full px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              {bodyExpanded ? (
                <ChevronDown className="w-3.5 h-3.5 flex-shrink-0" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 flex-shrink-0" />
              )}
              {bodyExpanded ? "Hide description" : "Show description"}
            </button>
            {bodyExpanded && (
              <div className="px-3 pb-3 max-h-96 overflow-auto border-t border-border">
                <div className="markdown-content break-words select-text max-w-none text-xs pt-2">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{pr.body}</ReactMarkdown>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Checks (CI/CD status) */}
        {(() => {
          const awaitingApprovalRuns = workflowRuns.filter(
            (r) => r.status === "waiting" || r.status === "requested" || r.status === "pending"
          );
          const actionRequiredRuns = workflowRuns.filter(
            (r) => r.status === "completed" && r.conclusion === "action_required"
          );
          const approvalRuns = [...awaitingApprovalRuns, ...actionRequiredRuns];
          const approvableRuns = isForkPR ? approvalRuns : [];
          const hasChecks = checkRuns.length > 0 || approvalRuns.length > 0;
          if (!hasChecks) return null;
          const failed = checkRuns.filter(
            (r) => r.conclusion === "failure" || r.conclusion === "timed_out"
          ).length;
          const passed = checkRuns.filter((r) => r.conclusion === "success").length;
          const pending = checkRuns.filter((r) => r.status !== "completed").length;
          return (
            <div className="border border-border rounded bg-muted/20">
              <button
                onClick={() => setChecksExpanded((v) => !v)}
                className="flex items-center gap-1.5 w-full px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                {checksExpanded ? (
                  <ChevronDown className="w-3.5 h-3.5 flex-shrink-0" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5 flex-shrink-0" />
                )}
                Checks ({checkRuns.length + approvalRuns.length})
                {approvalRuns.length > 0 && (
                  <span className="ml-auto text-[10px] text-amber-500 font-medium">
                    {approvableRuns.length > 0
                      ? `${approvableRuns.length} needs approval`
                      : `${approvalRuns.length} needs attention`}
                  </span>
                )}
                {approvalRuns.length === 0 && failed > 0 && (
                  <span className="ml-auto text-[10px] text-red-500 font-medium">
                    {failed} failed
                  </span>
                )}
                {approvalRuns.length === 0 && failed === 0 && pending > 0 && (
                  <span className="ml-auto text-[10px] text-yellow-500 font-medium">
                    {pending} pending
                  </span>
                )}
                {approvalRuns.length === 0 &&
                  failed === 0 &&
                  pending === 0 &&
                  checkRuns.length > 0 &&
                  passed === checkRuns.length && (
                    <span className="ml-auto text-[10px] text-green-500 font-medium">
                      All passed
                    </span>
                  )}
              </button>
              {checksExpanded && (
                <div className="border-t border-border divide-y divide-border">
                  {checkRuns.map((run) => {
                    const isPending = run.status !== "completed";
                    const isSuccess = run.conclusion === "success";
                    const isFailed =
                      run.conclusion === "failure" ||
                      run.conclusion === "timed_out" ||
                      run.conclusion === "action_required";
                    return (
                      <div key={run.id} className="flex items-center gap-2 px-3 py-1.5 text-xs">
                        {isPending ? (
                          <Clock className="w-3.5 h-3.5 flex-shrink-0 text-yellow-500" />
                        ) : isSuccess ? (
                          <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0 text-green-500" />
                        ) : isFailed ? (
                          <XCircle className="w-3.5 h-3.5 flex-shrink-0 text-red-500" />
                        ) : (
                          <Clock className="w-3.5 h-3.5 flex-shrink-0 text-muted-foreground" />
                        )}
                        <span className="flex-1 min-w-0 text-foreground truncate">{run.name}</span>
                        {run.app?.name && (
                          <span className="text-[10px] text-muted-foreground flex-shrink-0">
                            {run.app.name}
                          </span>
                        )}
                        <a
                          href={run.html_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-shrink-0 text-muted-foreground hover:text-foreground"
                          aria-label={`View ${run.name} logs`}
                        >
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    );
                  })}
                  {approvalRuns.length > 0 && (
                    <>
                      {checkRuns.length > 0 && (
                        <div className="px-3 py-1 text-[10px] font-medium text-amber-500 uppercase tracking-wide bg-amber-500/5">
                          Needs Approval
                        </div>
                      )}
                      {approvalRuns.map((run) => (
                        <div key={run.id} className="flex items-center gap-2 px-3 py-1.5 text-xs">
                          <Clock className="w-3.5 h-3.5 flex-shrink-0 text-amber-500" />
                          <span className="flex-1 min-w-0 text-foreground truncate">
                            {run.name ?? "Workflow run"}
                          </span>
                          {run.actor && (
                            <span className="text-[10px] text-muted-foreground flex-shrink-0">
                              {run.actor.login}
                            </span>
                          )}
                          <a
                            href={run.html_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-shrink-0 text-muted-foreground hover:text-foreground"
                            aria-label={`View workflow run`}
                          >
                            <ExternalLink className="w-3 h-3" />
                          </a>
                          {isForkPR ? (
                            <button
                              onClick={() => setShowApproveConfirm(run.id)}
                              disabled={approveLoading}
                              className="flex-shrink-0 px-1.5 py-0.5 text-[10px] font-medium rounded border border-amber-500/50 text-amber-500 hover:bg-amber-500/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              Approve & run
                            </button>
                          ) : (
                            <button
                              onClick={() => handleRerunRun(run.id)}
                              disabled={approveLoading}
                              className="flex-shrink-0 px-1.5 py-0.5 text-[10px] font-medium rounded border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              Re-run
                            </button>
                          )}
                        </div>
                      ))}
                    </>
                  )}
                  {approveError && (
                    <div className="px-3 py-2 text-[10px] text-red-500 bg-red-500/5 border-t border-border">
                      {approveError}
                      <button
                        onClick={() => setApproveError(null)}
                        className="ml-2 underline text-muted-foreground hover:text-foreground"
                      >
                        Dismiss
                      </button>
                    </div>
                  )}
                  {approveMessage && (
                    <div className="px-3 py-2 text-[10px] text-green-500 bg-green-500/5 border-t border-border">
                      {approveMessage}
                      <button
                        onClick={() => setApproveMessage(null)}
                        className="ml-2 underline text-muted-foreground hover:text-foreground"
                      >
                        Dismiss
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })()}

        {/* Cross-referenced issues */}
        {(() => {
          const crossRefs = timeline.filter(
            (e) => e.event === "cross-referenced" && e.source?.issue && !e.source.issue.pull_request
          );
          if (crossRefs.length === 0) return null;
          return (
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                <Link className="w-3.5 h-3.5" />
                Referenced Issues ({crossRefs.length})
              </div>
              <div className="space-y-1">
                {crossRefs.map((e, idx) => {
                  const src = e.source!.issue!;
                  const fullName = src.repository?.full_name ?? "";
                  const [refOwner, refRepo] = fullName.split("/");
                  const canOpenInPanel = Boolean(refOwner && refRepo);
                  return (
                    <div
                      key={idx}
                      className="flex items-center gap-1.5 text-xs text-muted-foreground border border-border rounded px-2 py-1 bg-muted/10"
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${src.state === "open" ? "bg-green-500" : "bg-purple-500"}`}
                      />
                      {canOpenInPanel ? (
                        <button
                          onClick={() => {
                            const panelData = {
                              owner: refOwner,
                              repo: refRepo,
                              number: src.number,
                              htmlUrl: src.html_url,
                              back: {
                                type: "github-pr-details" as const,
                                data: { owner, repo, number, htmlUrl, back },
                              },
                            };
                            contextPanelId
                              ? replacePanel(contextPanelId, "github-issue-details", panelData)
                              : openPanel("github-issue-details", panelData);
                          }}
                          className="text-foreground hover:underline truncate text-left"
                        >
                          {src.title}
                        </button>
                      ) : (
                        <a
                          href={src.html_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-foreground hover:underline truncate"
                        >
                          {src.title}
                        </a>
                      )}
                      <span className="font-mono flex-shrink-0">#{src.number}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {/* Conversation (issue comments + timeline events) */}
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
            <MessageSquare className="w-3.5 h-3.5" />
            Conversation
            {activityItems.length > 0 && (
              <span className="text-muted-foreground">({activityItems.length})</span>
            )}
          </div>

          {(issueCommentsLoading || timelineLoading) && (
            <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Loading activity…
            </div>
          )}

          {issueCommentsError && (
            <div className="flex items-start gap-2 p-2 text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
              <span>{issueCommentsError}</span>
            </div>
          )}

          {!issueCommentsLoading &&
            !timelineLoading &&
            !issueCommentsError &&
            activityItems.length === 0 && (
              <p className="text-xs text-muted-foreground">No conversation yet.</p>
            )}

          {hasMoreActivity && (
            <button
              onClick={() => setDisplayedActivityCount((c) => c + ACTIVITY_PAGE_SIZE)}
              className="text-xs text-primary hover:underline"
            >
              Load more ({activityItems.length - displayedActivityCount} older)
            </button>
          )}

          <div className="space-y-2">
            {visibleActivity.map((item) => {
              if (item.type === "comment") {
                const comment = item.comment;
                return (
                  <div
                    key={item.id}
                    className="border border-border rounded p-2.5 bg-muted/10 space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <UserAvatar
                          src={comment.user.avatar_url}
                          alt={comment.user.login}
                          size={16}
                        />
                        {comment.user.html_url ? (
                          <a
                            href={comment.user.html_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs font-medium text-foreground hover:underline truncate"
                          >
                            {comment.user.login}
                          </a>
                        ) : (
                          <span className="text-xs font-medium text-foreground truncate">
                            {comment.user.login}
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-muted-foreground flex-shrink-0">
                        {formatDate(comment.created_at)}
                      </span>
                    </div>
                    <div className="markdown-content break-words select-text max-w-none text-xs">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{comment.body}</ReactMarkdown>
                    </div>
                    {comment.reactions && comment.reactions.total_count > 0 && (
                      <div className="flex flex-wrap gap-1 pt-0.5">
                        {REACTION_ENTRIES.filter(([key]) => comment.reactions![key] > 0).map(
                          ([key, emoji]) => (
                            <span
                              key={key}
                              className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] bg-muted border border-border rounded-full"
                            >
                              {emoji} {comment.reactions![key]}
                            </span>
                          )
                        )}
                      </div>
                    )}
                  </div>
                );
              }

              if (item.type === "review") {
                const review = item.review;
                const stateLabel: Record<string, string> = {
                  APPROVED: "approved",
                  CHANGES_REQUESTED: "requested changes",
                  COMMENTED: "reviewed",
                  DISMISSED: "dismissed their review",
                  PENDING: "pending review",
                };
                const displayState = stateLabel[review.state];
                if (!displayState) {
                  console.warn("[PRDetails] Unknown review state:", review.state);
                }
                return (
                  <div
                    key={item.id}
                    className="border border-border rounded p-2.5 bg-muted/10 space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <UserAvatar
                          src={review.user.avatar_url}
                          alt={review.user.login}
                          size={16}
                        />
                        {review.user.html_url ? (
                          <a
                            href={review.user.html_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs font-medium text-foreground hover:underline truncate"
                          >
                            {review.user.login}
                          </a>
                        ) : (
                          <span className="text-xs font-medium text-foreground truncate">
                            {review.user.login}
                          </span>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {displayState ?? review.state.toLowerCase()}
                        </span>
                      </div>
                      {review.submitted_at && (
                        <span className="text-[10px] text-muted-foreground flex-shrink-0">
                          {formatDate(review.submitted_at)}
                        </span>
                      )}
                    </div>
                    {review.body && (
                      <div className="markdown-content break-words select-text max-w-none text-xs">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>{review.body}</ReactMarkdown>
                      </div>
                    )}
                  </div>
                );
              }

              if (item.type === "commit") {
                const commit = item.commit;
                const shortSha = commit.sha.slice(0, 7);
                const firstLine = commit.commit.message.split("\n")[0];
                const authorName = commit.author?.login ?? commit.commit.author?.name ?? "Unknown";
                return (
                  <div key={item.id} className="border border-border rounded p-2.5 bg-muted/5">
                    <div className="flex items-start gap-2 text-xs">
                      <UserAvatar src={commit.author?.avatar_url} alt={authorName} size={16} />
                      <span className="flex-1 min-w-0 text-muted-foreground">
                        {commit.author?.html_url ? (
                          <a
                            href={commit.author.html_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-medium text-foreground hover:underline"
                          >
                            {authorName}
                          </a>
                        ) : (
                          <span className="font-medium text-foreground">{authorName}</span>
                        )}{" "}
                        committed{" "}
                        <a
                          href={commit.html_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-mono text-primary hover:underline"
                        >
                          {shortSha}
                        </a>
                        {": "}
                        <span className="text-foreground">{firstLine}</span>
                      </span>
                      {commit.commit.author?.date && (
                        <span className="text-[10px] text-muted-foreground flex-shrink-0">
                          {formatDate(commit.commit.author.date)}
                        </span>
                      )}
                    </div>
                  </div>
                );
              }

              return (
                <div key={item.id} className="border border-border rounded p-2.5 bg-muted/5">
                  <div className="flex items-start gap-2 text-xs">
                    {item.event.actor ? (
                      <UserAvatar
                        src={item.event.actor.avatar_url}
                        alt={item.event.actor.login}
                        size={16}
                      />
                    ) : (
                      <div
                        className="w-4 h-4 rounded-full bg-muted flex-shrink-0"
                        aria-hidden="true"
                      />
                    )}
                    <span className="text-muted-foreground flex-1 min-w-0">
                      {item.event.actor?.login && (
                        <>
                          {item.event.actor.html_url ? (
                            <a
                              href={item.event.actor.html_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-medium text-foreground hover:underline"
                            >
                              {item.event.actor.login}
                            </a>
                          ) : (
                            <span className="font-medium text-foreground">
                              {item.event.actor.login}
                            </span>
                          )}{" "}
                        </>
                      )}
                      {item.label}
                    </span>
                    <span className="text-[10px] text-muted-foreground flex-shrink-0">
                      {formatDate(item.createdAt)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Add comment form */}
          <div className="border border-border rounded p-2.5 space-y-2 bg-muted/10">
            <textarea
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Add a comment…"
              className="w-full px-2 py-1.5 text-xs bg-background border border-border rounded resize-none h-28"
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                  e.preventDefault();
                  handleAddComment();
                }
              }}
            />
            <div className="flex justify-end">
              <button
                onClick={handleAddComment}
                disabled={!commentText.trim() || actionLoading === "comment"}
                className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium bg-primary text-primary-foreground rounded disabled:opacity-50 transition-colors hover:opacity-90"
              >
                {actionLoading === "comment" && <Loader2 className="w-3 h-3 animate-spin" />}
                Post Comment
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Reviewer dropdown */}
      {showReviewDropdown && reviewDropdownPos && (
        <div
          ref={reviewDropdownRef}
          style={{
            position: "absolute",
            left: reviewDropdownPos.left,
            bottom: reviewDropdownPos.bottom,
            width: 280,
            zIndex: 50,
          }}
          className="bg-popover border border-border rounded-md shadow-lg overflow-hidden"
          role="listbox"
          aria-label="Select reviewer"
        >
          {/* Search input */}
          <div className="p-2 border-b border-border">
            <input
              type="text"
              value={reviewSearch}
              onChange={(e) => setReviewSearch(e.target.value)}
              placeholder="Search users..."
              className="w-full px-2 py-1 text-xs bg-background border border-border rounded"
              autoFocus
            />
          </div>
          {/* User list */}
          <div className="max-h-48 overflow-auto">
            {reviewableLoading ? (
              <div className="flex items-center gap-2 p-3 text-xs text-muted-foreground">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Loading…
              </div>
            ) : filteredReviewableUsers.length === 0 ? (
              <p className="p-3 text-xs text-muted-foreground">No users found.</p>
            ) : (
              filteredReviewableUsers.map((user) => {
                const isRequested = pr?.requested_reviewers?.some((r) => r.login === user.login);
                return (
                  <button
                    key={user.login}
                    onClick={() => handleRequestReviewer(user.login)}
                    className="flex items-center gap-2 w-full px-3 py-2 text-xs hover:bg-accent text-left transition-colors"
                    role="option"
                    aria-selected={isRequested}
                  >
                    <UserAvatar src={user.avatar_url} alt={user.login} size={20} />
                    <span className="flex-1 min-w-0">
                      <span className="font-medium text-foreground">{user.login}</span>
                      {user.name && <span className="ml-1 text-muted-foreground">{user.name}</span>}
                    </span>
                    {isRequested && <span className="text-xs text-primary">✓</span>}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Action bar (Merge / Close PR) with draft-merge guard */}
      <ExtensionActionBar bar={actionBar} />

      {/* Confirmation modals */}
      <ConfirmationModal
        isOpen={showConfirm?.action === "merge"}
        onClose={() => setShowConfirm(null)}
        onConfirm={() => handleMerge(showConfirm?.mergeMethod ?? "merge")}
        title="Merge Pull Request"
        message={`Are you sure you want to ${showConfirm?.mergeMethod ?? "merge"} this pull request? This action cannot be undone.`}
        confirmText={`${MERGE_METHOD_LABELS[showConfirm?.mergeMethod ?? "merge"]} PR`}
        variant="warning"
      />
      <ConfirmationModal
        isOpen={showConfirm?.action === "close"}
        onClose={() => setShowConfirm(null)}
        onConfirm={handleClosePR}
        title="Close Pull Request"
        message="Are you sure you want to close this pull request?"
        confirmText="Close PR"
        variant="danger"
      />
      <ConfirmationModal
        isOpen={showApproveConfirm !== null}
        onClose={() => setShowApproveConfirm(null)}
        onConfirm={() => showApproveConfirm !== null && handleApproveRun(showApproveConfirm)}
        title="Approve Workflow Run"
        message="This will approve the workflow run from a fork and allow it to execute. Only approve runs from trusted contributors."
        confirmText="Approve & run"
        variant="warning"
        loading={approveLoading}
      />
    </div>
  );
}
