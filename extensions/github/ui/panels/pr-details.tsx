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
import { getApiInstance } from "../../api-instance";
import type {
  GitHubPR,
  GitHubComment,
  GitHubReviewComment,
  GitHubPRReview,
  GitHubPRCommit,
  GitHubTimelineEvent,
  GitHubAssignableUser,
} from "../../api";

const COMMENTS_PAGE_SIZE = 5;
const ACTIVITY_PAGE_SIZE = 10;

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

  const [reviewComments, setReviewComments] = useState<GitHubReviewComment[]>([]);
  const [reviewCommentsLoading, setReviewCommentsLoading] = useState(false);
  const [reviewCommentsError, setReviewCommentsError] = useState<string | null>(null);
  const [displayedReviewCommentCount, setDisplayedReviewCommentCount] =
    useState(COMMENTS_PAGE_SIZE);

  // PR review summaries state
  const [prReviews, setPrReviews] = useState<GitHubPRReview[]>([]);

  // PR commits state
  const [prCommits, setPrCommits] = useState<GitHubPRCommit[]>([]);

  // Timeline state
  const [timeline, setTimeline] = useState<GitHubTimelineEvent[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(false);

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

  const pendingSilentRefreshRef = useRef(false);

  // Trigger counter — incrementing causes a re-fetch
  const [fetchTick, setFetchTick] = useState(0);
  const triggerRefresh = useCallback((silent = false) => {
    pendingSilentRefreshRef.current = silent;
    setFetchTick((n) => n + 1);
  }, []);
  const refresh = useCallback(() => triggerRefresh(false), [triggerRefresh]);

  // Write-action state
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [showConfirm, setShowConfirm] = useState<{
    action: "merge" | "close";
    mergeMethod?: "merge" | "squash" | "rebase";
  } | null>(null);
  const [commentText, setCommentText] = useState("");

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
                  variant: "danger" as const,
                  disabled: actionLoading !== null,
                  loading: actionLoading === "close",
                  onClick: () => setShowConfirm({ action: "close" }),
                },
              ]
            : []),
          {
            id: "review-comments",
            label: "Review Comments",
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
            variant: "ghost" as const,
            onClick: () => window.open(pr.html_url, "_blank", "noopener,noreferrer"),
          },
        ]
      : [],
    error: actionError,
    onDismissError: () => setActionError(null),
  });

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

    if (!isSilentRefresh) {
      setLoading(true);
      setError(null);
      setIssueCommentsError(null);
      setIssueCommentsLoading(true);
      setReviewCommentsError(null);
      setReviewCommentsLoading(true);
      setTimelineLoading(true);
      setDisplayedActivityCount(ACTIVITY_PAGE_SIZE);
      setDisplayedReviewCommentCount(COMMENTS_PAGE_SIZE);
    }

    api
      .getPRDetails(owner, repo, number)
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

    api
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

    api
      .getPRReviewComments(owner, repo, number)
      .then((result) => {
        if (!cancelled) setReviewComments(result);
      })
      .catch((e) => {
        if (!cancelled && !isSilentRefresh) {
          setReviewCommentsError(e instanceof Error ? e.message : "Failed to load review comments");
        }
      })
      .finally(() => {
        if (!cancelled && !isSilentRefresh) setReviewCommentsLoading(false);
      });

    api
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

    api
      .getPRReviews(owner, repo, number)
      .then((result) => {
        if (!cancelled) setPrReviews(result);
      })
      .catch((e) => {
        console.error("[PRDetails] Failed to fetch PR reviews:", e);
        if (!cancelled) setPrReviews([]);
      });

    api
      .getPRCommits(owner, repo, number)
      .then((result) => {
        if (!cancelled) setPrCommits(result);
      })
      .catch((e) => {
        console.error("[PRDetails] Failed to fetch PR commits:", e);
        if (!cancelled) setPrCommits([]);
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

  const visibleReviewComments = reviewComments.slice(
    Math.max(0, reviewComments.length - displayedReviewCommentCount)
  );
  const hasMoreReviewComments = displayedReviewCommentCount < reviewComments.length;

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
                const authorName =
                  commit.author?.login ?? commit.commit.author?.name ?? "Unknown";
                return (
                  <div
                    key={item.id}
                    className="border border-border rounded p-2.5 bg-muted/5"
                  >
                    <div className="flex items-start gap-2 text-xs">
                      <UserAvatar
                        src={commit.author?.avatar_url}
                        alt={authorName}
                        size={16}
                      />
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

        {/* Review Comments */}
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
            <MessageSquare className="w-3.5 h-3.5" />
            Review Comments
            {reviewComments.length > 0 && (
              <span className="text-muted-foreground">({reviewComments.length})</span>
            )}
          </div>

          {reviewCommentsLoading && (
            <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Loading review comments…
            </div>
          )}

          {reviewCommentsError && (
            <div className="flex items-start gap-2 p-2 text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
              <span>{reviewCommentsError}</span>
            </div>
          )}

          {!reviewCommentsLoading && !reviewCommentsError && reviewComments.length === 0 && (
            <p className="text-xs text-muted-foreground">No review comments yet.</p>
          )}

          {hasMoreReviewComments && (
            <button
              onClick={() => setDisplayedReviewCommentCount((c) => c + COMMENTS_PAGE_SIZE)}
              className="text-xs text-primary hover:underline"
            >
              Load more ({reviewComments.length - displayedReviewCommentCount} older)
            </button>
          )}

          <div className="space-y-2">
            {visibleReviewComments.map((comment) => (
              <div
                key={comment.id}
                className="border border-border rounded p-2.5 bg-muted/10 space-y-1.5"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <UserAvatar src={comment.user.avatar_url} alt={comment.user.login} size={16} />
                    <span className="text-xs font-medium text-foreground truncate">
                      {comment.user.login}
                    </span>
                  </div>
                  <span className="text-[10px] text-muted-foreground flex-shrink-0">
                    {formatDate(comment.created_at)}
                  </span>
                </div>
                {comment.path && (
                  <div className="text-[10px] text-muted-foreground font-mono truncate">
                    {comment.path}
                  </div>
                )}
                <div className="markdown-content break-words select-text max-w-none text-xs">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{comment.body}</ReactMarkdown>
                </div>
              </div>
            ))}
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
    </div>
  );
}
