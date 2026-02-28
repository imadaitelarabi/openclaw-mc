/**
 * GitHub PR Changes Panel
 *
 * Displays changed files in a pull request and any inline review threads on
 * each file, with filtering, pagination, and write actions.
 */

"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  ExternalLink,
  AlertCircle,
  Loader2,
  RefreshCw,
  MessageSquare,
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  Send,
  Pencil,
  Trash2,
  X,
  Check,
  Smile,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { ExtensionPanelProps } from "@/types/extension";
import type { PanelBackNavigation } from "@/types";
import { useOptionalExtensions } from "@/contexts/ExtensionContext";
import { usePanels } from "@/contexts/PanelContext";
import { getApiInstance } from "../../api-instance";
import type { GitHubPRFile, GitHubReviewComment } from "../../api";

const PAGE_SIZE = 20;

const REACTION_EMOJIS: Record<string, string> = {
  "+1": "👍",
  "-1": "👎",
  laugh: "😄",
  confused: "😕",
  heart: "❤️",
  hooray: "🎉",
  rocket: "🚀",
  eyes: "👀",
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

/** Render a diff hunk with line-by-line coloring for additions, deletions, and context headers. */
function DiffHunk({ hunk }: { hunk: string }) {
  const lines = hunk.split("\n");
  return (
    <div className="text-[10px] font-mono border border-border rounded overflow-hidden leading-4 max-h-60 overflow-y-auto">
      {lines.map((line, i) => {
        let lineClass = "bg-muted/20 text-foreground";
        if (line.startsWith("@@")) {
          lineClass = "bg-blue-500/10 text-blue-600 dark:text-blue-400";
        } else if (line.startsWith("+")) {
          lineClass = "bg-green-500/15 text-green-700 dark:text-green-400";
        } else if (line.startsWith("-")) {
          lineClass = "bg-red-500/15 text-red-700 dark:text-red-400";
        }
        return (
          // Use index + content as key; hunk lines are static display content
          <div
            key={`${i}-${line.slice(0, 20)}`}
            className={`px-2 py-px whitespace-pre-wrap break-all ${lineClass}`}
          >
            {/* Non-breaking space preserves the row height for blank lines */}
            {line || "\u00a0"}
          </div>
        );
      })}
    </div>
  );
}


interface Thread {
  root: GitHubReviewComment;
  replies: GitHubReviewComment[];
}

function groupThreadsByFile(comments: GitHubReviewComment[]): Map<string, Thread[]> {
  const rootsById = new Map<number, GitHubReviewComment>();
  const replyMap = new Map<number, GitHubReviewComment[]>();

  for (const c of comments) {
    if (!c.in_reply_to_id) {
      rootsById.set(c.id, c);
      if (!replyMap.has(c.id)) replyMap.set(c.id, []);
    }
  }

  for (const c of comments) {
    if (c.in_reply_to_id) {
      // find the true root by walking up the reply chain
      let candidate = c.in_reply_to_id;
      let parent = comments.find((x) => x.id === candidate);
      while (parent?.in_reply_to_id) {
        candidate = parent.in_reply_to_id;
        parent = comments.find((x) => x.id === candidate);
      }
      const rootId = candidate;
      const bucket = replyMap.get(rootId);
      if (bucket) {
        bucket.push(c);
      } else {
        // orphaned reply – treat as root
        rootsById.set(c.id, c);
        replyMap.set(c.id, []);
      }
    }
  }

  const fileMap = new Map<string, Thread[]>();
  for (const [rootId, root] of rootsById) {
    const path = root.path ?? "(unknown file)";
    if (!fileMap.has(path)) fileMap.set(path, []);
    const replies = (replyMap.get(rootId) ?? [])
      .slice()
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    fileMap.get(path)!.push({ root, replies });
  }

  // sort threads within each file newest-first by root comment date
  for (const threads of fileMap.values()) {
    threads.sort(
      (a, b) => new Date(b.root.created_at).getTime() - new Date(a.root.created_at).getTime()
    );
  }

  return fileMap;
}

interface CommentCardProps {
  comment: GitHubReviewComment;
  owner: string;
  repo: string;
  prNumber: number;
  onRefresh: () => void;
  isReply?: boolean;
}

function CommentCard({
  comment,
  owner,
  repo,
  prNumber,
  onRefresh,
  isReply = false,
}: CommentCardProps) {
  const [editing, setEditing] = useState(false);
  const [editBody, setEditBody] = useState(comment.body);
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const [replying, setReplying] = useState(false);
  const [replyBody, setReplyBody] = useState("");
  const [replyLoading, setReplyLoading] = useState(false);
  const [replyError, setReplyError] = useState<string | null>(null);

  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const [reactionLoading, setReactionLoading] = useState<string | null>(null);
  const [reactionError, setReactionError] = useState<string | null>(null);
  const [showReactions, setShowReactions] = useState(false);

  const isOutdated = comment.position === null || comment.position === undefined;

  const api = useMemo(() => {
    try {
      return getApiInstance();
    } catch {
      return null;
    }
  }, []);

  const handleEdit = useCallback(async () => {
    if (!api) return;
    setEditLoading(true);
    setEditError(null);
    try {
      await api.editReviewComment(owner, repo, comment.id, editBody);
      setEditing(false);
      onRefresh();
    } catch (e) {
      setEditError(e instanceof Error ? e.message : "Failed to edit comment");
    } finally {
      setEditLoading(false);
    }
  }, [api, owner, repo, comment.id, editBody, onRefresh]);

  const handleDelete = useCallback(async () => {
    if (!api) return;
    setDeleteLoading(true);
    setDeleteError(null);
    try {
      await api.deleteReviewComment(owner, repo, comment.id);
      setConfirmDelete(false);
      onRefresh();
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : "Failed to delete comment");
    } finally {
      setDeleteLoading(false);
    }
  }, [api, owner, repo, comment.id, onRefresh]);

  const handleReply = useCallback(async () => {
    if (!api || !replyBody.trim()) return;
    setReplyLoading(true);
    setReplyError(null);
    try {
      await api.replyToReviewComment(owner, repo, comment.id, replyBody.trim());
      setReplyBody("");
      setReplying(false);
      onRefresh();
    } catch (e) {
      setReplyError(e instanceof Error ? e.message : "Failed to post reply");
    } finally {
      setReplyLoading(false);
    }
  }, [api, owner, repo, comment.id, replyBody, onRefresh]);

  const handleReaction = useCallback(
    async (content: string) => {
      if (!api) return;
      setReactionLoading(content);
      try {
        await api.addReviewCommentReaction(
          owner,
          repo,
          comment.id,
          content as Parameters<typeof api.addReviewCommentReaction>[3]
        );
        setShowReactions(false);
      } catch (e) {
        setReactionError(e instanceof Error ? e.message : "Failed to add reaction");
      } finally {
        setReactionLoading(null);
      }
    },
    [api, owner, repo, comment.id]
  );

  return (
    <div
      className={`border border-border rounded p-2.5 bg-muted/10 space-y-1.5 ${isReply ? "ml-5 border-l-2 border-l-primary/30" : ""}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <UserAvatar src={comment.user.avatar_url} alt={comment.user.login} size={16} />
          <span className="text-xs font-medium text-foreground truncate">{comment.user.login}</span>
          {isOutdated && (
            <span className="text-[9px] px-1 py-0.5 rounded bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 font-medium flex-shrink-0">
              outdated
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          <span className="text-[10px] text-muted-foreground">
            {formatDate(comment.created_at)}
          </span>
          {/* Reaction picker toggle */}
          <button
            onClick={() => setShowReactions((v) => !v)}
            className="p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
            title="Add reaction"
          >
            <Smile className="w-3 h-3" />
          </button>
          {/* Edit */}
          <button
            onClick={() => {
              setEditing((v) => !v);
              setEditBody(comment.body);
            }}
            className="p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
            title="Edit comment"
          >
            <Pencil className="w-3 h-3" />
          </button>
          {/* Delete */}
          <button
            onClick={() => setConfirmDelete(true)}
            className="p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-destructive"
            title="Delete comment"
          >
            <Trash2 className="w-3 h-3" />
          </button>
          {/* Open in GitHub */}
          <a
            href={comment.html_url}
            target="_blank"
            rel="noopener noreferrer"
            className="p-0.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
            title="Open in GitHub"
          >
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>

      {/* Reaction picker */}
      {showReactions && (
        <div className="flex flex-wrap gap-1 p-1.5 border border-border rounded bg-popover">
          {Object.entries(REACTION_EMOJIS).map(([content, emoji]) => (
            <button
              key={content}
              onClick={() => handleReaction(content)}
              disabled={reactionLoading !== null}
              className="text-sm px-1.5 py-0.5 rounded hover:bg-muted disabled:opacity-50"
              title={content}
            >
              {reactionLoading === content ? (
                <Loader2 className="w-3 h-3 animate-spin inline" />
              ) : (
                emoji
              )}
            </button>
          ))}
          {reactionError && (
            <div className="w-full text-xs text-destructive flex items-center gap-1 mt-1">
              <AlertCircle className="w-3 h-3 flex-shrink-0" />
              {reactionError}
            </div>
          )}
        </div>
      )}

      {/* Delete confirmation */}
      {confirmDelete && (
        <div className="flex items-center gap-2 p-1.5 bg-destructive/10 border border-destructive/20 rounded text-xs">
          <span className="text-destructive flex-1">Delete this comment?</span>
          <button
            onClick={handleDelete}
            disabled={deleteLoading}
            className="flex items-center gap-1 px-2 py-0.5 rounded bg-destructive text-destructive-foreground hover:bg-destructive/80 disabled:opacity-50"
          >
            {deleteLoading ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Check className="w-3 h-3" />
            )}
            Yes
          </button>
          <button
            onClick={() => setConfirmDelete(false)}
            className="flex items-center gap-1 px-2 py-0.5 rounded bg-muted hover:bg-muted/80"
          >
            <X className="w-3 h-3" />
            No
          </button>
        </div>
      )}
      {deleteError && (
        <div className="text-xs text-destructive flex items-center gap-1">
          <AlertCircle className="w-3 h-3" />
          {deleteError}
        </div>
      )}

      {/* Body / Edit form */}
      {editing ? (
        <div className="space-y-1.5">
          <textarea
            value={editBody}
            onChange={(e) => setEditBody(e.target.value)}
            rows={4}
            className="w-full text-xs border border-border rounded p-1.5 bg-background resize-y font-mono"
          />
          {editError && (
            <div className="text-xs text-destructive flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              {editError}
            </div>
          )}
          <div className="flex gap-1.5">
            <button
              onClick={handleEdit}
              disabled={editLoading || !editBody.trim()}
              className="flex items-center gap-1 px-2 py-1 rounded bg-primary text-primary-foreground text-xs hover:bg-primary/80 disabled:opacity-50"
            >
              {editLoading ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Check className="w-3 h-3" />
              )}
              Save
            </button>
            <button
              onClick={() => setEditing(false)}
              className="flex items-center gap-1 px-2 py-1 rounded bg-muted text-xs hover:bg-muted/80"
            >
              <X className="w-3 h-3" />
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="markdown-content break-words select-text max-w-none text-xs">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{comment.body}</ReactMarkdown>
        </div>
      )}

      {/* Reply button / form */}
      {!isReply && (
        <>
          {!replying ? (
            <button
              onClick={() => setReplying(true)}
              className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground"
            >
              <MessageSquare className="w-3 h-3" />
              Reply
            </button>
          ) : (
            <div className="space-y-1.5 mt-1">
              <textarea
                value={replyBody}
                onChange={(e) => setReplyBody(e.target.value)}
                placeholder="Write a reply…"
                rows={3}
                className="w-full text-xs border border-border rounded p-1.5 bg-background resize-y"
                autoFocus
              />
              {replyError && (
                <div className="text-xs text-destructive flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {replyError}
                </div>
              )}
              <div className="flex gap-1.5">
                <button
                  onClick={handleReply}
                  disabled={replyLoading || !replyBody.trim()}
                  className="flex items-center gap-1 px-2 py-1 rounded bg-primary text-primary-foreground text-xs hover:bg-primary/80 disabled:opacity-50"
                >
                  {replyLoading ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Send className="w-3 h-3" />
                  )}
                  Reply
                </button>
                <button
                  onClick={() => {
                    setReplying(false);
                    setReplyBody("");
                  }}
                  className="flex items-center gap-1 px-2 py-1 rounded bg-muted text-xs hover:bg-muted/80"
                >
                  <X className="w-3 h-3" />
                  Cancel
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

interface ThreadGroupProps {
  thread: Thread;
  owner: string;
  repo: string;
  prNumber: number;
  onRefresh: () => void;
}

function ThreadGroup({ thread, owner, repo, prNumber, onRefresh }: ThreadGroupProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="space-y-1">
      {/* Diff hunk */}
      {thread.root.diff_hunk && !collapsed && (
        <DiffHunk hunk={thread.root.diff_hunk} />
      )}

      <CommentCard
        comment={thread.root}
        owner={owner}
        repo={repo}
        prNumber={prNumber}
        onRefresh={onRefresh}
      />

      {thread.replies.length > 0 && (
        <button
          onClick={() => setCollapsed((v) => !v)}
          className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground ml-2"
        >
          {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          {thread.replies.length} {thread.replies.length === 1 ? "reply" : "replies"}
        </button>
      )}

      {!collapsed &&
        thread.replies.map((reply) => (
          <CommentCard
            key={reply.id}
            comment={reply}
            owner={owner}
            repo={repo}
            prNumber={prNumber}
            onRefresh={onRefresh}
            isReply
          />
        ))}
    </div>
  );
}

interface FileGroupProps {
  file: GitHubPRFile;
  filePath: string;
  threads: Thread[];
  owner: string;
  repo: string;
  prNumber: number;
  onRefresh: () => void;
}

function FileGroup({ file, filePath, threads, owner, repo, prNumber, onRefresh }: FileGroupProps) {
  const [collapsed, setCollapsed] = useState(false);
  const outdatedCount = threads.filter(
    (t) => t.root.position === null || t.root.position === undefined
  ).length;
  const totalComments = threads.reduce((sum, t) => sum + 1 + t.replies.length, 0);

  return (
    <div className="border border-border rounded overflow-hidden">
      <button
        onClick={() => setCollapsed((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-2 bg-muted/30 hover:bg-muted/50 text-left"
      >
        {collapsed ? (
          <ChevronRight className="w-3.5 h-3.5 flex-shrink-0 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-3.5 h-3.5 flex-shrink-0 text-muted-foreground" />
        )}
        <span className="font-mono text-xs text-foreground truncate flex-1">{filePath}</span>
        <span className="text-[9px] px-1 py-0.5 rounded bg-muted text-muted-foreground uppercase tracking-wide flex-shrink-0">
          {file.status}
        </span>
        <span className="text-[10px] text-muted-foreground flex-shrink-0">
          +{file.additions} -{file.deletions}
        </span>
        <span className="text-[10px] text-muted-foreground flex-shrink-0">
          {threads.length} {threads.length === 1 ? "thread" : "threads"}
          {totalComments > 0 ? ` · ${totalComments} comments` : ""}
        </span>
        {outdatedCount > 0 && (
          <span className="text-[9px] px-1 py-0.5 rounded bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 font-medium flex-shrink-0">
            {outdatedCount} outdated
          </span>
        )}
      </button>

      {!collapsed && (
        <div className="p-3 space-y-3">
          {file.patch ? (
            <pre className="text-[10px] font-mono bg-muted/30 border border-border rounded p-2 overflow-x-auto whitespace-pre-wrap leading-4 max-h-64">
              {file.patch}
            </pre>
          ) : (
            <div className="text-xs text-muted-foreground">
              No patch preview available for this file.
            </div>
          )}

          {threads.length === 0 && (
            <div className="text-xs text-muted-foreground">No review comments on this file.</div>
          )}

          {threads.map((thread) => (
            <ThreadGroup
              key={thread.root.id}
              thread={thread}
              owner={owner}
              repo={repo}
              prNumber={prNumber}
              onRefresh={onRefresh}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface GitHubPrReviewCommentsPanelProps extends ExtensionPanelProps {
  owner?: string;
  repo?: string;
  number?: number;
  contextPanelId?: string;
  back?: PanelBackNavigation;
}

export function GitHubPrReviewCommentsPanel({
  owner,
  repo,
  number,
  contextPanelId,
  back,
}: GitHubPrReviewCommentsPanelProps) {
  const { replacePanel } = usePanels();
  const extensionContext = useOptionalExtensions();
  const isExtensionContextLoading = extensionContext?.isLoading ?? false;
  const isGitHubEnabled = extensionContext?.isExtensionEnabled("github") ?? false;

  const [files, setFiles] = useState<GitHubPRFile[]>([]);
  const [comments, setComments] = useState<GitHubReviewComment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fetchTick, setFetchTick] = useState(0);

  // Filters
  const [filterFile, setFilterFile] = useState("");
  const [filterAuthor, setFilterAuthor] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "outdated">("all");
  const [filterText, setFilterText] = useState("");

  // Pagination: how many file groups are visible
  const [visibleFiles, setVisibleFiles] = useState(PAGE_SIZE);

  const triggerRefresh = useCallback(() => setFetchTick((n) => n + 1), []);

  // Fetch changed files and review comments
  useEffect(() => {
    if (isExtensionContextLoading || !isGitHubEnabled) return;
    if (!owner || !repo || !number) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    const api = getApiInstance();
    Promise.all([api.getPRFiles(owner, repo, number), api.getPRReviewComments(owner, repo, number)])
      .then(([prFiles, reviewComments]) => {
        if (!cancelled) setFiles(prFiles);
        if (!cancelled) setComments(reviewComments);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load PR changes");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [owner, repo, number, isGitHubEnabled, isExtensionContextLoading, fetchTick]);

  const filteredThreadsByFile = useMemo(() => {
    let filtered = comments;

    if (filterAuthor.trim()) {
      const q = filterAuthor.trim().toLowerCase();
      filtered = filtered.filter((c) => c.user.login.toLowerCase().includes(q));
    }
    if (filterStatus === "active") {
      filtered = filtered.filter((c) => c.position !== null && c.position !== undefined);
    } else if (filterStatus === "outdated") {
      filtered = filtered.filter((c) => c.position === null || c.position === undefined);
    }
    if (filterText.trim()) {
      const q = filterText.trim().toLowerCase();
      filtered = filtered.filter((c) => c.body.toLowerCase().includes(q));
    }

    return groupThreadsByFile(filtered);
  }, [comments, filterAuthor, filterStatus, filterText]);

  // Build visible file entries, preserving PR file order
  const fileEntries = useMemo(() => {
    const hasCommentFilters =
      filterAuthor.trim().length > 0 || filterText.trim().length > 0 || filterStatus !== "all";
    const fileQuery = filterFile.trim().toLowerCase();

    return files
      .filter((file) => (fileQuery ? file.filename.toLowerCase().includes(fileQuery) : true))
      .map(
        (file) =>
          [
            file.filename,
            { file, threads: filteredThreadsByFile.get(file.filename) ?? [] },
          ] as const
      )
      .filter(([, group]) => (!hasCommentFilters ? true : group.threads.length > 0));
  }, [files, filteredThreadsByFile, filterFile, filterAuthor, filterText, filterStatus]);

  const visibleEntries = fileEntries.slice(0, visibleFiles);
  const hasMore = visibleFiles < fileEntries.length;

  const totalThreads = useMemo(
    () => fileEntries.reduce((sum, [, group]) => sum + group.threads.length, 0),
    [fileEntries]
  );

  const totalComments = useMemo(
    () =>
      fileEntries.reduce(
        (sum, [, group]) =>
          sum +
          group.threads.reduce((threadSum, thread) => threadSum + 1 + thread.replies.length, 0),
        0
      ),
    [fileEntries]
  );

  if (isExtensionContextLoading) {
    return (
      <div className="flex items-center justify-center h-32 text-xs text-muted-foreground gap-2">
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading…
      </div>
    );
  }

  if (!owner || !repo || !number) {
    return (
      <div className="flex items-center justify-center h-32 text-xs text-muted-foreground">
        No pull request selected.
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-background sticky top-0 z-10">
        {back && contextPanelId && (
          <button
            onClick={() => replacePanel(contextPanelId, back.type, back.data)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back
          </button>
        )}
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          <MessageSquare className="w-3.5 h-3.5 flex-shrink-0 text-muted-foreground" />
          <span className="text-xs font-medium truncate">
            Changes — PR #{number}
            {repo ? ` (${repo})` : ""}
          </span>
          {files.length > 0 && (
            <span className="text-[10px] text-muted-foreground flex-shrink-0">
              {fileEntries.length} {fileEntries.length === 1 ? "file" : "files"}
              {totalThreads > 0
                ? ` · ${totalThreads} ${totalThreads === 1 ? "thread" : "threads"}`
                : ""}
              {totalComments > 0 ? ` · ${totalComments} comments` : ""}
            </span>
          )}
        </div>
        <button
          onClick={triggerRefresh}
          disabled={loading}
          className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground disabled:opacity-50"
          title="Refresh"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      <div className="px-3 py-2 border-b border-border bg-background space-y-1.5">
        <div className="flex gap-1.5 flex-wrap">
          <input
            type="text"
            placeholder="Filter by file…"
            value={filterFile}
            onChange={(e) => {
              setFilterFile(e.target.value);
              setVisibleFiles(PAGE_SIZE);
            }}
            className="flex-1 min-w-[120px] text-xs border border-border rounded px-2 py-1 bg-background"
          />
          <input
            type="text"
            placeholder="Filter by author…"
            value={filterAuthor}
            onChange={(e) => {
              setFilterAuthor(e.target.value);
              setVisibleFiles(PAGE_SIZE);
            }}
            className="flex-1 min-w-[120px] text-xs border border-border rounded px-2 py-1 bg-background"
          />
          <select
            value={filterStatus}
            onChange={(e) => {
              setFilterStatus(e.target.value as "all" | "active" | "outdated");
              setVisibleFiles(PAGE_SIZE);
            }}
            className="text-xs border border-border rounded px-2 py-1 bg-background"
          >
            <option value="all">All comments</option>
            <option value="active">Active comments</option>
            <option value="outdated">Outdated comments</option>
          </select>
        </div>
        <input
          type="text"
          placeholder="Search comment text…"
          value={filterText}
          onChange={(e) => {
            setFilterText(e.target.value);
            setVisibleFiles(PAGE_SIZE);
          }}
          className="w-full text-xs border border-border rounded px-2 py-1 bg-background"
        />
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
        {loading && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground py-4">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Loading PR changes…
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 p-2 text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {!loading && !error && files.length === 0 && (
          <p className="text-xs text-muted-foreground py-4">
            No changed files in this pull request.
          </p>
        )}

        {!loading && !error && files.length > 0 && fileEntries.length === 0 && (
          <p className="text-xs text-muted-foreground py-4">No files match the current filters.</p>
        )}

        {visibleEntries.map(([filePath, group]) => (
          <FileGroup
            key={filePath}
            file={group.file}
            filePath={filePath}
            threads={group.threads}
            owner={owner}
            repo={repo}
            prNumber={number}
            onRefresh={triggerRefresh}
          />
        ))}

        {hasMore && (
          <button
            onClick={() => setVisibleFiles((n) => n + PAGE_SIZE)}
            className="w-full text-xs text-primary hover:underline py-1"
          >
            Load more files ({fileEntries.length - visibleFiles} remaining)
          </button>
        )}
      </div>
    </div>
  );
}
