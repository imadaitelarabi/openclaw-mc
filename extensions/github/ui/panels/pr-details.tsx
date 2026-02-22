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
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { ExtensionPanelProps } from "@/types/extension";
import { useOptionalExtensions } from "@/contexts/ExtensionContext";
import { getApiInstance } from "../../api-instance";
import type { GitHubPR } from "../../api";

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
}

export function GitHubPrDetailsPanel({ owner, repo, number, htmlUrl }: GitHubPrDetailsPanelProps) {
  const extensionContext = useOptionalExtensions();
  const isExtensionContextLoading = extensionContext?.isLoading ?? false;
  const isGitHubEnabled = extensionContext?.isExtensionEnabled("github") ?? false;

  const [pr, setPr] = useState<GitHubPR | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <div className="flex flex-col h-full overflow-auto p-4 space-y-4">
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
        <div className="border border-border rounded p-3 max-h-96 overflow-auto bg-muted/20">
          <div className="markdown-content break-words select-text max-w-none text-xs">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{pr.body}</ReactMarkdown>
          </div>
        </div>
      )}

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
    </div>
  );
}
