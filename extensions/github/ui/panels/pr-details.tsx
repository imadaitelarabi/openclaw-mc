/**
 * GitHub PR Details Panel
 *
 * Shows full details for a single pull request: title, status, author,
 * labels, body excerpt, timestamps, and a link to open in GitHub.
 */

"use client";

import { useState, useEffect } from "react";
import {
  ExternalLink,
  AlertCircle,
  Loader2,
  GitPullRequest,
  GitMerge,
  GitPullRequestClosed,
  ChevronDown,
  ChevronRight,
  MessageSquare,
  ArrowLeft,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { ExtensionPanelProps } from "@/types/extension";
import type { PanelBackNavigation } from "@/types";
import { useOptionalExtensions } from "@/contexts/ExtensionContext";
import { usePanels } from "@/contexts/PanelContext";
import { getApiInstance } from "../../api-instance";
import type { GitHubPR, GitHubComment, GitHubReviewComment } from "../../api";

const COMMENTS_PAGE_SIZE = 5;

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
  const { replacePanel } = usePanels();
  const extensionContext = useOptionalExtensions();
  const isExtensionContextLoading = extensionContext?.isLoading ?? false;
  const isGitHubEnabled = extensionContext?.isExtensionEnabled("github") ?? false;

  const [pr, setPr] = useState<GitHubPR | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [bodyExpanded, setBodyExpanded] = useState(false);

  const [issueComments, setIssueComments] = useState<GitHubComment[]>([]);
  const [issueCommentsLoading, setIssueCommentsLoading] = useState(false);
  const [issueCommentsError, setIssueCommentsError] = useState<string | null>(null);
  const [displayedIssueCommentCount, setDisplayedIssueCommentCount] = useState(COMMENTS_PAGE_SIZE);

  const [reviewComments, setReviewComments] = useState<GitHubReviewComment[]>([]);
  const [reviewCommentsLoading, setReviewCommentsLoading] = useState(false);
  const [reviewCommentsError, setReviewCommentsError] = useState<string | null>(null);
  const [displayedReviewCommentCount, setDisplayedReviewCommentCount] =
    useState(COMMENTS_PAGE_SIZE);

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
    setIssueCommentsError(null);
    setIssueCommentsLoading(true);
    setReviewCommentsError(null);
    setReviewCommentsLoading(true);
    setDisplayedIssueCommentCount(COMMENTS_PAGE_SIZE);
    setDisplayedReviewCommentCount(COMMENTS_PAGE_SIZE);

    api
      .getPRDetails(owner, repo, number)
      .then((result) => {
        if (!cancelled) setPr(result);
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load pull request details");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    api
      .getIssueComments(owner, repo, number)
      .then((result) => {
        if (!cancelled) setIssueComments(result);
      })
      .catch((e) => {
        if (!cancelled) {
          setIssueCommentsError(e instanceof Error ? e.message : "Failed to load comments");
        }
      })
      .finally(() => {
        if (!cancelled) setIssueCommentsLoading(false);
      });

    api
      .getPRReviewComments(owner, repo, number)
      .then((result) => {
        if (!cancelled) setReviewComments(result);
      })
      .catch((e) => {
        if (!cancelled) {
          setReviewCommentsError(e instanceof Error ? e.message : "Failed to load review comments");
        }
      })
      .finally(() => {
        if (!cancelled) setReviewCommentsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [owner, repo, number, isExtensionContextLoading, isGitHubEnabled]);

  const fallbackUrl =
    htmlUrl ||
    (owner && repo && number ? `https://github.com/${owner}/${repo}/pull/${number}` : undefined);

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

  // Show newest N comments in chronological order; "Load more" reveals older ones
  const visibleIssueComments = issueComments.slice(
    Math.max(0, issueComments.length - displayedIssueCommentCount)
  );
  const hasMoreIssueComments = displayedIssueCommentCount < issueComments.length;

  const visibleReviewComments = reviewComments.slice(
    Math.max(0, reviewComments.length - displayedReviewCommentCount)
  );
  const hasMoreReviewComments = displayedReviewCommentCount < reviewComments.length;

  return (
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
        </div>
        <h2 className="text-base font-semibold text-foreground leading-snug">{pr.title}</h2>
      </div>

      {/* Open in GitHub */}
      <div>
        <a
          href={pr.html_url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
        >
          <ExternalLink className="w-3 h-3" />
          Open in GitHub
        </a>
      </div>

      {/* Meta */}
      <div className="text-xs text-muted-foreground space-y-1">
        <div>
          <span className="font-medium text-foreground">Author:</span> {pr.user.login}
        </div>
        {pr.assignees && pr.assignees.length > 0 && (
          <div>
            <span className="font-medium text-foreground">Assignees:</span>{" "}
            {pr.assignees.map((a) => a.login).join(", ")}
          </div>
        )}
        <div>
          <span className="font-medium text-foreground">Opened:</span> {formatDate(pr.created_at)}
        </div>
        <div>
          <span className="font-medium text-foreground">Updated:</span> {formatDate(pr.updated_at)}
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

      {/* Conversation Comments */}
      <div className="space-y-2">
        <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
          <MessageSquare className="w-3.5 h-3.5" />
          Conversation
          {issueComments.length > 0 && (
            <span className="text-muted-foreground">({issueComments.length})</span>
          )}
        </div>

        {issueCommentsLoading && (
          <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Loading comments…
          </div>
        )}

        {issueCommentsError && (
          <div className="flex items-start gap-2 p-2 text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            <span>{issueCommentsError}</span>
          </div>
        )}

        {!issueCommentsLoading && !issueCommentsError && issueComments.length === 0 && (
          <p className="text-xs text-muted-foreground">No comments yet.</p>
        )}

        {hasMoreIssueComments && (
          <button
            onClick={() => setDisplayedIssueCommentCount((c) => c + COMMENTS_PAGE_SIZE)}
            className="text-xs text-primary hover:underline"
          >
            Load more ({issueComments.length - displayedIssueCommentCount} older)
          </button>
        )}

        <div className="space-y-2">
          {visibleIssueComments.map((comment) => (
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
                <span className="text-xs font-medium text-foreground">{comment.user.login}</span>
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
  );
}
