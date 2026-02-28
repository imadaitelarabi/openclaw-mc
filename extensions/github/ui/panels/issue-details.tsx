/**
 * GitHub Issue Details Panel
 *
 * Shows full details for a single issue: title, status, author,
 * labels, body excerpt, timestamps, and a link to open in GitHub.
 * Supports write actions: close/reopen, assign, add comment.
 */

"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  ExternalLink,
  AlertCircle,
  Loader2,
  CircleDot,
  CircleCheck,
  ChevronDown,
  ChevronRight,
  MessageSquare,
  ArrowLeft,
  X,
  RefreshCw,
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
import { useOptionalExtensionModals } from "@/contexts/ExtensionModalContext";
import { getApiInstance } from "../../api-instance";
import type {
  GitHubIssue,
  GitHubComment,
  GitHubAssignableUser,
  GitHubTimelineEvent,
  GitHubCopilotAgentAssignmentOptions,
} from "../../api";
import type { AssignCopilotModalPayload, AssignCopilotModalResult } from "../modals/assign-copilot";

const ACTIVITY_PAGE_SIZE = 10;

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

function timelineEventLabel(event: GitHubTimelineEvent): string | null {
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
      return "closed this issue";
    case "reopened":
      return "reopened this issue";
    case "merged":
      return "merged";
    case "referenced":
      return "referenced this issue";
    case "renamed":
      return "renamed this issue";
    case "milestoned":
      return "added a milestone";
    case "demilestoned":
      return "removed a milestone";
    case "locked":
      return "locked this issue";
    case "unlocked":
      return "unlocked this issue";
    default:
      return null;
  }
}

interface GitHubIssueDetailsPanelProps extends ExtensionPanelProps {
  owner?: string;
  repo?: string;
  number?: number;
  htmlUrl?: string;
  contextPanelId?: string;
  back?: PanelBackNavigation;
}

export function GitHubIssueDetailsPanel({
  owner,
  repo,
  number,
  htmlUrl,
  contextPanelId,
  back,
}: GitHubIssueDetailsPanelProps) {
  const { replacePanel } = usePanels();
  const extensionModals = useOptionalExtensionModals();
  const extensionContext = useOptionalExtensions();
  const isExtensionContextLoading = extensionContext?.isLoading ?? false;
  const isGitHubEnabled = extensionContext?.isExtensionEnabled("github") ?? false;

  const [issue, setIssue] = useState<GitHubIssue | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [githubInitAttempted, setGitHubInitAttempted] = useState(false);
  const [githubInitLoading, setGitHubInitLoading] = useState(false);
  const [githubInitError, setGitHubInitError] = useState<string | null>(null);

  const [bodyExpanded, setBodyExpanded] = useState(true);

  const [comments, setComments] = useState<GitHubComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentsError, setCommentsError] = useState<string | null>(null);
  const [displayedActivityCount, setDisplayedActivityCount] = useState(ACTIVITY_PAGE_SIZE);

  // Timeline state
  const [timeline, setTimeline] = useState<GitHubTimelineEvent[]>([]);
  const [timelineLoading, setTimelineLoading] = useState(false);

  // Assignable users state
  const [assignableUsers, setAssignableUsers] = useState<GitHubAssignableUser[]>([]);
  const [assignableLoading, setAssignableLoading] = useState(false);
  const [assignSearch, setAssignSearch] = useState("");
  const [assignDropdownPos, setAssignDropdownPos] = useState<{
    left: number;
    bottom: number;
  } | null>(null);
  const panelRootRef = useRef<HTMLDivElement | null>(null);
  const assignDropdownRef = useRef<HTMLDivElement | null>(null);
  const postActionRefreshTimersRef = useRef<number[]>([]);
  const pendingSilentRefreshRef = useRef(false);

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
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [showReopenConfirm, setShowReopenConfirm] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [commentText, setCommentText] = useState("");

  // ── Action bar (built before early returns to satisfy Rules of Hooks) ───
  const actionBar = useExtensionActionBar({
    actions: issue
      ? [
          ...(issue.state === "open"
            ? [
                {
                  id: "close",
                  label: "Close Issue",
                  variant: "danger" as const,
                  disabled: actionLoading !== null,
                  loading: actionLoading === "close",
                  onClick: () => setShowCloseConfirm(true),
                },
                {
                  id: "assign",
                  label: "Assign",
                  variant: "default" as const,
                  disabled: actionLoading !== null,
                  onClick: () => {
                    setAssignSearch("");
                    setShowAssignModal(true);
                  },
                },
              ]
            : [
                {
                  id: "reopen",
                  label: "Reopen Issue",
                  variant: "default" as const,
                  disabled: actionLoading !== null,
                  loading: actionLoading === "reopen",
                  onClick: () => setShowReopenConfirm(true),
                },
              ]),
          {
            id: "open-github",
            label: "Open in GitHub",
            variant: "ghost" as const,
            onClick: () => window.open(issue.html_url, "_blank", "noopener,noreferrer"),
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
          triggerRefresh(true);
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
    triggerRefresh,
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
      setCommentsError(null);
      setCommentsLoading(true);
      setTimelineLoading(true);
      setDisplayedActivityCount(ACTIVITY_PAGE_SIZE);
    }

    api
      .getIssueDetails(owner, repo, number)
      .then((result) => {
        if (!cancelled) setIssue(result);
      })
      .catch((e) => {
        if (!cancelled && !isSilentRefresh) {
          setError(e instanceof Error ? e.message : "Failed to load issue details");
        }
      })
      .finally(() => {
        if (!cancelled && !isSilentRefresh) setLoading(false);
      });

    api
      .getIssueComments(owner, repo, number)
      .then((result) => {
        if (!cancelled) setComments(result);
      })
      .catch((e) => {
        if (!cancelled && !isSilentRefresh) {
          setCommentsError(e instanceof Error ? e.message : "Failed to load comments");
        }
      })
      .finally(() => {
        if (!cancelled && !isSilentRefresh) setCommentsLoading(false);
      });

    api
      .getIssueTimeline(owner, repo, number)
      .then((result) => {
        if (!cancelled) setTimeline(result);
      })
      .catch(() => {
        // Timeline is optional; silently ignore errors
        if (!cancelled) setTimeline([]);
      })
      .finally(() => {
        if (!cancelled && !isSilentRefresh) setTimelineLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [owner, repo, number, isExtensionContextLoading, isGitHubEnabled, fetchTick]);

  // Fetch assignable users when assign modal is opened
  useEffect(() => {
    if (!showAssignModal || !owner || !repo) return;

    const api = getApiInstance();
    if (!api) return;

    setAssignableLoading(true);
    api
      .getAssignableUsers(owner, repo)
      .then((users) => setAssignableUsers(users))
      .catch(() => setAssignableUsers([]))
      .finally(() => setAssignableLoading(false));
  }, [showAssignModal, owner, repo]);

  useEffect(() => {
    if (!showAssignModal) return;

    const updatePosition = () => {
      const root = panelRootRef.current;
      if (!root) return;
      const assignAction = root.querySelector<HTMLElement>('[data-action-id="assign"]');
      if (!assignAction) return;

      const rootRect = root.getBoundingClientRect();
      const actionRect = assignAction.getBoundingClientRect();

      const left = Math.max(12, actionRect.left - rootRect.left - 8);
      const bottom = Math.max(44, rootRect.bottom - actionRect.top + 8);

      setAssignDropdownPos({ left, bottom });
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [showAssignModal]);

  useEffect(() => {
    if (!showAssignModal) return;

    const handleOutsidePointer = (event: MouseEvent | TouchEvent) => {
      const targetNode = event.target as Node | null;
      if (!targetNode) return;
      if (assignDropdownRef.current?.contains(targetNode)) return;
      setShowAssignModal(false);
    };

    document.addEventListener("mousedown", handleOutsidePointer);
    document.addEventListener("touchstart", handleOutsidePointer);

    return () => {
      document.removeEventListener("mousedown", handleOutsidePointer);
      document.removeEventListener("touchstart", handleOutsidePointer);
    };
  }, [showAssignModal]);

  useEffect(() => {
    return () => {
      postActionRefreshTimersRef.current.forEach((id) => window.clearTimeout(id));
      postActionRefreshTimersRef.current = [];
    };
  }, []);

  const fallbackUrl =
    htmlUrl ||
    (owner && repo && number ? `https://github.com/${owner}/${repo}/issues/${number}` : undefined);

  // ── Write-action handlers ─────────────────────────────────────────────

  const handleCloseIssue = async () => {
    if (!owner || !repo || !number) return;
    setActionLoading("close");
    setActionError(null);
    setShowCloseConfirm(false);
    try {
      const api = getApiInstance();
      if (!api) throw new Error("GitHub API not initialized");
      await api.closeIssue(owner, repo, number);
      refreshAfterAction();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Failed to close issue");
    } finally {
      setActionLoading(null);
    }
  };

  const handleReopenIssue = async () => {
    if (!owner || !repo || !number) return;
    setActionLoading("reopen");
    setActionError(null);
    setShowReopenConfirm(false);
    try {
      const api = getApiInstance();
      if (!api) throw new Error("GitHub API not initialized");
      await api.reopenIssue(owner, repo, number);
      refreshAfterAction();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Failed to reopen issue");
    } finally {
      setActionLoading(null);
    }
  };

  const handleAddAssignees = async (
    assignees: string[],
    copilotOptions?: GitHubCopilotAgentAssignmentOptions
  ) => {
    if (!owner || !repo || !number || assignees.length === 0) return;
    // Optimistic update
    const previousIssue = issue;
    if (issue) {
      const newAssignees = assignees.map((login) => ({
        login,
        avatar_url: assignableUsers.find((u) => u.login === login)?.avatar_url,
        html_url: assignableUsers.find((u) => u.login === login)?.html_url,
      }));
      setIssue({
        ...issue,
        assignees: [
          ...(issue.assignees ?? []).filter((a) => !assignees.includes(a.login)),
          ...newAssignees,
        ],
      });
    }
    setActionLoading("assign");
    setActionError(null);
    setShowAssignModal(false);
    try {
      const api = getApiInstance();
      if (!api) throw new Error("GitHub API not initialized");

      const isCopilotAssignment =
        assignees.length === 1 &&
        (assignees[0].toLowerCase() === "copilot" ||
          assignees[0].toLowerCase() === "copilot-swe-agent");

      if (isCopilotAssignment) {
        await api.assignCopilotToIssue(owner, repo, number, copilotOptions);
      } else {
        await api.addAssignees(owner, repo, number, assignees);
      }
      refreshAfterAction();
    } catch (e) {
      // Rollback on failure
      setIssue(previousIssue);
      setShowAssignModal(true);
      setActionError(e instanceof Error ? e.message : "Failed to add assignees");
    } finally {
      setActionLoading(null);
    }
  };

  const handleAssignCopilot = async () => {
    if (!owner || !repo || !number) return;

    setShowAssignModal(false);

    try {
      if (!extensionModals) {
        await handleAddAssignees(["copilot"]);
        return;
      }

      const result = await extensionModals.openModal<
        AssignCopilotModalPayload,
        AssignCopilotModalResult
      >("assign-copilot", {
        owner,
        repo,
        number,
      });

      if (!result?.confirmed) return;

      await handleAddAssignees(["copilot"], result.options);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Failed to open Copilot assignment modal");
    }
  };

  const handleRemoveAssignee = async (login: string) => {
    if (!owner || !repo || !number) return;
    setActionLoading(`remove-${login}`);
    setActionError(null);
    try {
      const api = getApiInstance();
      if (!api) throw new Error("GitHub API not initialized");
      await api.removeAssignees(owner, repo, number, [login]);
      refreshAfterAction();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Failed to remove assignee");
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
      await api.addComment(owner, repo, number, commentText.trim());
      setCommentText("");
      refreshAfterAction();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Failed to post comment");
    } finally {
      setActionLoading(null);
    }
  };

  // Filtered assignable users for search
  const filteredAssignableUsers = useMemo(() => {
    const q = assignSearch.toLowerCase().trim();
    if (!q) return assignableUsers;
    return assignableUsers.filter(
      (u) => u.login.toLowerCase().includes(q) || (u.name && u.name.toLowerCase().includes(q))
    );
  }, [assignableUsers, assignSearch]);

  const activityItems = useMemo(() => {
    const commentItems = comments.map((comment) => ({
      type: "comment" as const,
      id: `comment-${comment.id}`,
      createdAt: comment.created_at,
      comment,
    }));

    const timelineItems = timeline
      .map((event, index) => {
        const label = timelineEventLabel(event);
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

    return [...commentItems, ...timelineItems].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
  }, [comments, timeline]);

  if (!owner || !repo || !number) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
        No issue selected.
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
        Loading issue…
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

  if (!issue) return null;

  const isOpen = issue.state === "open";
  const StatusIcon = isOpen ? CircleDot : CircleCheck;
  const statusColor = isOpen ? "text-green-500" : "text-purple-500";
  const statusLabel = isOpen ? "Open" : "Closed";

  // Show newest N activity items in chronological order; "Load more" reveals older ones
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
                isOpen
                  ? "border-green-500/40 text-green-500"
                  : "border-purple-500/40 text-purple-500"
              }`}
            >
              {statusLabel}
            </span>
            <span className="text-xs text-muted-foreground font-mono">
              {owner}/{repo}#{issue.number}
            </span>
            <button
              onClick={refresh}
              disabled={loading}
              title="Refresh"
              aria-label="Refresh issue"
              className="ml-auto flex items-center justify-center w-6 h-6 rounded hover:bg-accent disabled:opacity-50 text-muted-foreground transition-colors"
            >
              {loading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
          <h2 className="text-base font-semibold text-foreground leading-snug">{issue.title}</h2>
        </div>

        {/* Action error */}
        {/* (Errors are displayed in the ExtensionActionBar below) */}

        {/* Meta */}
        <div className="text-xs text-muted-foreground space-y-1.5">
          <div className="flex items-center gap-1.5">
            <span className="font-medium text-foreground">Author:</span>
            <UserAvatar src={issue.user.avatar_url} alt={issue.user.login} size={16} />
            {issue.user.html_url ? (
              <a
                href={issue.user.html_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-foreground hover:underline"
              >
                {issue.user.login}
              </a>
            ) : (
              <span className="text-foreground">{issue.user.login}</span>
            )}
          </div>
          {issue.assignees && issue.assignees.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-medium text-foreground">Assignees:</span>
              {issue.assignees.map((a) => (
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
          <div>
            <span className="font-medium text-foreground">Opened:</span>{" "}
            {formatDate(issue.created_at)}
          </div>
          <div>
            <span className="font-medium text-foreground">Updated:</span>{" "}
            {formatDate(issue.updated_at)}
          </div>
        </div>

        {/* Labels */}
        {issue.labels && issue.labels.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {issue.labels.map((label) => (
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
        {issue.body && (
          <div className="border border-border rounded bg-muted/20">
            <button
              onClick={() => setBodyExpanded((v) => !v)}
              aria-expanded={bodyExpanded}
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
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{issue.body}</ReactMarkdown>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Conversation (comments + timeline) */}
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
            <MessageSquare className="w-3.5 h-3.5" />
            Conversation
            {activityItems.length > 0 && (
              <span className="text-muted-foreground">({activityItems.length})</span>
            )}
          </div>

          {(commentsLoading || timelineLoading) && (
            <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Loading activity…
            </div>
          )}

          {commentsError && (
            <div className="flex items-start gap-2 p-2 text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
              <span>{commentsError}</span>
            </div>
          )}

          {!commentsLoading && !timelineLoading && !commentsError && activityItems.length === 0 && (
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
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                  e.preventDefault();
                  handleAddComment();
                }
              }}
              placeholder="Add a comment… (Cmd/Ctrl+Enter to submit)"
              aria-label="Comment text"
              className="w-full px-2 py-1.5 text-xs bg-background border border-border rounded resize-none h-28 focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <div className="flex justify-end">
              <button
                onClick={handleAddComment}
                disabled={!commentText.trim() || actionLoading === "comment"}
                aria-label="Post comment"
                className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium bg-primary text-primary-foreground rounded disabled:opacity-50 transition-colors hover:opacity-90"
              >
                {actionLoading === "comment" && <Loader2 className="w-3 h-3 animate-spin" />}
                Post Comment
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Assign dropdown */}
      {showAssignModal && (
        <div
          ref={assignDropdownRef}
          className="absolute z-20 w-[340px] max-w-[calc(100%-24px)] border border-border rounded-md p-2.5 space-y-2 bg-popover shadow-lg"
          style={{
            left: assignDropdownPos?.left ?? 12,
            bottom: assignDropdownPos?.bottom ?? 44,
          }}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-foreground">Assign</span>
            <button
              onClick={() => setShowAssignModal(false)}
              aria-label="Close assign dropdown"
              className="hover:opacity-70"
            >
              <X className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
          </div>

          {issue.assignees && issue.assignees.length > 0 && (
            <div className="space-y-1">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Current</p>
              <div className="flex flex-wrap gap-1">
                {issue.assignees.map((a) => (
                  <span
                    key={a.login}
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] bg-muted border border-border rounded"
                  >
                    <UserAvatar src={a.avatar_url} alt={a.login} size={12} />
                    {a.login}
                    <button
                      onClick={() => handleRemoveAssignee(a.login)}
                      disabled={actionLoading !== null}
                      aria-label={`Remove ${a.login}`}
                      className="hover:opacity-70 disabled:opacity-50"
                    >
                      {actionLoading === `remove-${a.login}` ? (
                        <Loader2 className="w-2.5 h-2.5 animate-spin" />
                      ) : (
                        <X className="w-2.5 h-2.5" />
                      )}
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}

          <input
            type="text"
            value={assignSearch}
            onChange={(e) => setAssignSearch(e.target.value)}
            placeholder="Search users…"
            aria-label="Search assignable users"
            className="w-full px-2 py-1.5 text-xs bg-background border border-border rounded focus:outline-none focus:ring-1 focus:ring-ring"
          />

          <div
            className="max-h-44 overflow-y-auto space-y-0.5"
            role="listbox"
            aria-label="Assignable users"
          >
            <button
              role="option"
              aria-selected={false}
              onClick={handleAssignCopilot}
              disabled={actionLoading !== null}
              className="w-full flex items-center gap-2 px-2 py-1.5 text-xs rounded hover:bg-muted/60 transition-colors disabled:opacity-50 text-left"
            >
              <span className="text-sm flex-shrink-0" aria-hidden="true">
                ✨
              </span>
              <span className="font-medium text-foreground">Assign to Copilot</span>
              <span className="text-muted-foreground ml-auto text-[10px]">AI</span>
            </button>

            {assignableLoading && (
              <div className="flex items-center gap-2 py-2 px-2 text-xs text-muted-foreground">
                <Loader2 className="w-3 h-3 animate-spin" />
                Loading users…
              </div>
            )}

            {!assignableLoading && filteredAssignableUsers.length === 0 && assignSearch && (
              <p className="px-2 py-1.5 text-xs text-muted-foreground">No users found.</p>
            )}

            {filteredAssignableUsers.map((user) => {
              const isAssigned = issue.assignees?.some((a) => a.login === user.login) ?? false;
              return (
                <button
                  key={user.login}
                  role="option"
                  aria-selected={isAssigned}
                  onClick={() => handleAddAssignees([user.login])}
                  disabled={actionLoading !== null || isAssigned}
                  className="w-full flex items-center gap-2 px-2 py-1.5 text-xs rounded hover:bg-muted/60 transition-colors disabled:opacity-50 text-left"
                >
                  <UserAvatar src={user.avatar_url} alt={user.login} size={18} />
                  <span className="font-medium text-foreground truncate">{user.login}</span>
                  {user.name && (
                    <span className="text-muted-foreground truncate ml-0.5">{user.name}</span>
                  )}
                  {isAssigned && (
                    <span className="ml-auto text-[10px] text-muted-foreground flex-shrink-0">
                      assigned
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Action bar (Close/Reopen / Assign / Open in GitHub) */}
      <ExtensionActionBar bar={actionBar} />

      {/* Close confirmation modal */}
      <ConfirmationModal
        isOpen={showCloseConfirm}
        onClose={() => setShowCloseConfirm(false)}
        onConfirm={handleCloseIssue}
        title="Close Issue"
        message="Are you sure you want to close this issue?"
        confirmText="Close Issue"
        variant="danger"
      />

      {/* Reopen confirmation modal */}
      <ConfirmationModal
        isOpen={showReopenConfirm}
        onClose={() => setShowReopenConfirm(false)}
        onConfirm={handleReopenIssue}
        title="Reopen Issue"
        message="Are you sure you want to reopen this issue?"
        confirmText="Reopen Issue"
        variant="warning"
      />
    </div>
  );
}
