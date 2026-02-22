/**
 * GitHub Issue Details Panel
 *
 * Shows full details for a single issue: title, status, author,
 * labels, body excerpt, timestamps, and a link to open in GitHub.
 */

"use client";

import { useState, useEffect } from "react";
import {
  ExternalLink,
  AlertCircle,
  Loader2,
  CircleDot,
  CircleCheck,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { ExtensionPanelProps } from "@/types/extension";
import { getApiInstance } from "../../api-instance";
import type { GitHubIssue } from "../../api";

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
}

export function GitHubIssueDetailsPanel({
  owner,
  repo,
  number,
  htmlUrl,
}: GitHubIssueDetailsPanelProps) {
  const [issue, setIssue] = useState<GitHubIssue | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!owner || !repo || !number) return;

    const api = getApiInstance();
    if (!api) {
      setError("GitHub extension is not initialized. Please complete onboarding.");
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

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

    return () => {
      cancelled = true;
    };
  }, [owner, repo, number]);

  const fallbackUrl =
    htmlUrl ||
    (owner && repo && number
      ? `https://github.com/${owner}/${repo}/issues/${number}`
      : undefined);

  if (!owner || !repo || !number) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
        No issue selected.
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

  return (
    <div className="flex flex-col h-full overflow-auto p-4 space-y-4">
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
        </div>
        <h2 className="text-base font-semibold text-foreground leading-snug">{issue.title}</h2>
      </div>

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
        <div className="border border-border rounded p-3 max-h-96 overflow-auto bg-muted/20">
          <div className="markdown-content break-words select-text max-w-none text-xs">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{issue.body}</ReactMarkdown>
          </div>
        </div>
      )}

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
    </div>
  );
}
