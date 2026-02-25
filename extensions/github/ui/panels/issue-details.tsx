/**
 * GitHub Issue Details Panel
 *
 * Shows full details for a single issue: title, status, author,
 * labels, body excerpt, timestamps, and a link to open in GitHub.
 * Supports write actions: close, assign, add comment.
 */

"use client";

import { useState, useEffect } from "react";
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
  UserPlus,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { ExtensionPanelProps } from "@/types/extension";
import type { PanelBackNavigation } from "@/types";
import { useOptionalExtensions } from "@/contexts/ExtensionContext";
import { usePanels } from "@/contexts/PanelContext";
import { ConfirmationModal } from "@/components/modals/ConfirmationModal";
import { getApiInstance } from "../../api-instance";
import type { GitHubIssue, GitHubComment } from "../../api";

const COMMENTS_PAGE_SIZE = 5;

function parseLogins(input: string): string[] {
  return input
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

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
  const extensionContext = useOptionalExtensions();
  const isExtensionContextLoading = extensionContext?.isLoading ?? false;
  const isGitHubEnabled = extensionContext?.isExtensionEnabled("github") ?? false;

  const [issue, setIssue] = useState<GitHubIssue | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [bodyExpanded, setBodyExpanded] = useState(false);

  const [comments, setComments] = useState<GitHubComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentsError, setCommentsError] = useState<string | null>(null);
  const [displayedCommentCount, setDisplayedCommentCount] = useState(COMMENTS_PAGE_SIZE);

  // Write-action state
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assigneeInput, setAssigneeInput] = useState("");
  const [commentText, setCommentText] = useState("");

  useEffect(() => {
    if (!owner || !repo || !number) return;

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

    let cancelled = false;
    setLoading(true);
    setError(null);
    setCommentsError(null);
    setCommentsLoading(true);
    setDisplayedCommentCount(COMMENTS_PAGE_SIZE);

    api
      .getIssueDetails(owner, repo, number)
      .then((result) => {
        if (!cancelled) setIssue(result);
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load issue details");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    api
      .getIssueComments(owner, repo, number)
      .then((result) => {
        if (!cancelled) setComments(result);
      })
      .catch((e) => {
        if (!cancelled) {
          setCommentsError(e instanceof Error ? e.message : "Failed to load comments");
        }
      })
      .finally(() => {
        if (!cancelled) setCommentsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [owner, repo, number, isExtensionContextLoading, isGitHubEnabled]);

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
      const updated = await api.getIssueDetails(owner, repo, number);
      setIssue(updated);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Failed to close issue");
    } finally {
      setActionLoading(null);
    }
  };

  const handleAddAssignees = async (assignees: string[]) => {
    if (!owner || !repo || !number || assignees.length === 0) return;
    setActionLoading("assign");
    setActionError(null);
    try {
      const api = getApiInstance();
      if (!api) throw new Error("GitHub API not initialized");
      await api.addAssignees(owner, repo, number, assignees);
      const updated = await api.getIssueDetails(owner, repo, number);
      setIssue(updated);
      setAssigneeInput("");
      setShowAssignModal(false);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Failed to add assignees");
    } finally {
      setActionLoading(null);
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
      const updated = await api.getIssueDetails(owner, repo, number);
      setIssue(updated);
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
      const newComment = await api.addComment(owner, repo, number, commentText.trim());
      setComments((prev) => [...prev, newComment]);
      setCommentText("");
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Failed to post comment");
    } finally {
      setActionLoading(null);
    }
  };

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

  // Show newest N comments in chronological order; "Load more" reveals older ones
  const visibleComments = comments.slice(Math.max(0, comments.length - displayedCommentCount));
  const hasMoreComments = displayedCommentCount < comments.length;

  return (
    <>
    <div className="flex flex-col h-full overflow-auto p-4 space-y-4">
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
              isOpen ? "border-green-500/40 text-green-500" : "border-purple-500/40 text-purple-500"
            }`}
          >
            {statusLabel}
          </span>
          <span className="text-xs text-muted-foreground font-mono">
            {owner}/{repo}#{issue.number}
          </span>
        </div>
        <h2 className="text-base font-semibold text-foreground leading-snug">{issue.title}</h2>
      </div>

      {/* Open in GitHub */}
      <div>
        <a
          href={issue.html_url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
        >
          <ExternalLink className="w-3 h-3" />
          Open in GitHub
        </a>
      </div>

      {/* Action error */}
      {actionError && (
        <div className="flex items-start gap-2 p-2 text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <span className="flex-1">{actionError}</span>
          <button onClick={() => setActionError(null)} className="flex-shrink-0 hover:opacity-70">
            <X className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Action buttons (open issues only) */}
      {isOpen && (
        <div className="flex flex-wrap gap-2 border-t border-border pt-3">
          <button
            onClick={() => setShowCloseConfirm(true)}
            disabled={actionLoading !== null}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-red-600 hover:bg-red-700 text-white rounded disabled:opacity-50 transition-colors"
          >
            {actionLoading === "close" ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <CircleCheck className="w-3 h-3" />
            )}
            Close Issue
          </button>
          <button
            onClick={() => setShowAssignModal(true)}
            disabled={actionLoading !== null}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-muted hover:bg-muted/80 text-foreground border border-border rounded disabled:opacity-50 transition-colors"
          >
            <UserPlus className="w-3 h-3" />
            Assign
          </button>
        </div>
      )}

      {/* Assign modal */}
      {showAssignModal && (
        <div className="border border-border rounded p-3 space-y-3 bg-muted/10">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-foreground">Assign issue</span>
            <button onClick={() => setShowAssignModal(false)} className="hover:opacity-70">
              <X className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
          </div>

          {/* Current assignees */}
          {issue.assignees && issue.assignees.length > 0 && (
            <div className="space-y-1">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Current</p>
              <div className="flex flex-wrap gap-1">
                {issue.assignees.map((a) => (
                  <span
                    key={a.login}
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] bg-muted border border-border rounded"
                  >
                    {a.login}
                    <button
                      onClick={() => handleRemoveAssignee(a.login)}
                      disabled={actionLoading !== null}
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

          {/* Add assignee input */}
          <div className="flex gap-1.5">
            <input
              type="text"
              value={assigneeInput}
              onChange={(e) => setAssigneeInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleAddAssignees(parseLogins(assigneeInput));
                }
              }}
              placeholder="GitHub username(s), comma-separated"
              className="flex-1 px-2 py-1 text-xs bg-background border border-border rounded"
            />
            <button
              onClick={() => handleAddAssignees(parseLogins(assigneeInput))}
              disabled={!assigneeInput.trim() || actionLoading !== null}
              className="px-2 py-1 text-xs font-medium bg-primary text-primary-foreground rounded disabled:opacity-50 transition-colors hover:opacity-90"
            >
              {actionLoading === "assign" ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                "Add"
              )}
            </button>
          </div>

          {/* Assign to Copilot */}
          <button
            onClick={() => handleAddAssignees(["copilot"])}
            disabled={actionLoading !== null}
            className="w-full text-left px-2 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded transition-colors disabled:opacity-50"
          >
            ✨ Assign to Copilot
          </button>
        </div>
      )}

      {/* Meta */}
      <div className="text-xs text-muted-foreground space-y-1">
        <div>
          <span className="font-medium text-foreground">Author:</span> {issue.user.login}
        </div>
        {issue.assignees && issue.assignees.length > 0 && (
          <div>
            <span className="font-medium text-foreground">Assignees:</span>{" "}
            {issue.assignees.map((a) => a.login).join(", ")}
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

      {/* Comments */}
      <div className="space-y-2">
        <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
          <MessageSquare className="w-3.5 h-3.5" />
          Comments
          {comments.length > 0 && (
            <span className="text-muted-foreground">({comments.length})</span>
          )}
        </div>

        {commentsLoading && (
          <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Loading comments…
          </div>
        )}

        {commentsError && (
          <div className="flex items-start gap-2 p-2 text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            <span>{commentsError}</span>
          </div>
        )}

        {!commentsLoading && !commentsError && comments.length === 0 && (
          <p className="text-xs text-muted-foreground">No comments yet.</p>
        )}

        {hasMoreComments && (
          <button
            onClick={() => setDisplayedCommentCount((c) => c + COMMENTS_PAGE_SIZE)}
            className="text-xs text-primary hover:underline"
          >
            Load more ({comments.length - displayedCommentCount} older)
          </button>
        )}

        <div className="space-y-2">
          {visibleComments.map((comment) => (
            <div
              key={comment.id}
              className="border border-border rounded p-2.5 bg-muted/10 space-y-1.5"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-foreground">{comment.user.login}</span>
                <span className="text-[10px] text-muted-foreground flex-shrink-0">
                  {formatDate(comment.created_at)}
                </span>
              </div>
              <div className="markdown-content break-words select-text max-w-none text-xs">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{comment.body}</ReactMarkdown>
              </div>
            </div>
          ))}
        </div>

        {/* Add comment form */}
        <div className="border border-border rounded p-2.5 space-y-2 bg-muted/10">
          <textarea
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            placeholder="Add a comment…"
            rows={3}
            className="w-full px-2 py-1.5 text-xs bg-background border border-border rounded resize-y"
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

    {/* Confirmation modal */}
    <ConfirmationModal
      isOpen={showCloseConfirm}
      onClose={() => setShowCloseConfirm(false)}
      onConfirm={handleCloseIssue}
      title="Close Issue"
      message="Are you sure you want to close this issue?"
      confirmText="Close Issue"
      variant="danger"
    />
  </>
  );
}
