"use client";

import { useEffect, useMemo, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Loader2, Sparkles } from "lucide-react";
import type {
  ExtensionModalProps,
} from "@/types/extension";
import { getApiInstance } from "../../api-instance";
import type { GitHubCopilotAgentAssignmentOptions } from "../../api";

export interface AssignCopilotModalPayload {
  owner: string;
  repo: string;
  number: number;
}

export interface AssignCopilotModalResult {
  confirmed: boolean;
  options: GitHubCopilotAgentAssignmentOptions;
}

export function AssignCopilotModal({
  isOpen,
  onClose,
  onResolve,
  payload,
}: ExtensionModalProps<AssignCopilotModalPayload, AssignCopilotModalResult>) {
  const [customInstructions, setCustomInstructions] = useState("");
  const [branch, setBranch] = useState("");
  const [agentMode, setAgentMode] = useState<"default" | "copilot" | "custom">("default");
  const [customAgent, setCustomAgent] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [branches, setBranches] = useState<string[]>([]);

  const targetRepo = `${payload.owner}/${payload.repo}`;

  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;
    const api = getApiInstance();
    if (!api) {
      setError("GitHub API not initialized");
      return;
    }

    setLoading(true);
    setError(null);

    Promise.all([
      api.getRepository(payload.owner, payload.repo),
      api.getRepositoryBranches(payload.owner, payload.repo),
    ])
      .then(([repository, branchItems]) => {
        if (cancelled) return;

        const names = branchItems.map((b) => b.name).filter(Boolean);
        setBranches(names);

        const initialBranch = repository.default_branch || names[0] || "";
        setBranch(initialBranch);
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load branch options");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, payload.owner, payload.repo]);

  const resolvedCustomAgent = useMemo(() => {
    if (agentMode === "custom") return customAgent.trim();
    if (agentMode === "copilot") return "copilot-swe-agent";
    return "";
  }, [agentMode, customAgent]);

  const canSubmit = !loading && (agentMode !== "custom" || resolvedCustomAgent.length > 0);

  const handleSubmit = () => {
    if (!canSubmit) return;

    onResolve({
      confirmed: true,
      options: {
        targetRepo,
        baseBranch: branch || undefined,
        customInstructions: customInstructions.trim() || undefined,
        customAgent: resolvedCustomAgent || undefined,
      },
    });
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 animate-in fade-in" />
        <Dialog.Content className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-lg bg-background border border-border rounded-lg shadow-lg p-4 space-y-3">
          <Dialog.Title className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Sparkles className="w-4 h-4" />
            Assign to Copilot
          </Dialog.Title>

          <Dialog.Description className="text-xs text-muted-foreground">
            Configure optional coding-agent settings before assigning this issue.
          </Dialog.Description>

          {error && <p className="text-xs text-destructive">{error}</p>}

          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Target repository</label>
            <input
              value={targetRepo}
              disabled
              className="w-full px-2 py-1.5 text-xs bg-muted border border-border rounded"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="copilot-base-branch" className="text-xs text-muted-foreground">
              Base branch
            </label>
            <select
              id="copilot-base-branch"
              value={branch}
              onChange={(e) => setBranch(e.target.value)}
              disabled={loading || branches.length === 0}
              className="w-full px-2 py-1.5 text-xs bg-background border border-border rounded"
            >
              {branches.length === 0 && <option value="">Default branch</option>}
              {branches.map((branchName) => (
                <option key={branchName} value={branchName}>
                  {branchName}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label htmlFor="copilot-agent" className="text-xs text-muted-foreground">
              Agent
            </label>
            <select
              id="copilot-agent"
              value={agentMode}
              onChange={(e) => setAgentMode(e.target.value as "default" | "copilot" | "custom")}
              className="w-full px-2 py-1.5 text-xs bg-background border border-border rounded"
            >
              <option value="default">Default agent</option>
              <option value="copilot">Copilot SWE agent</option>
              <option value="custom">Custom agent…</option>
            </select>
            {agentMode === "custom" && (
              <input
                value={customAgent}
                onChange={(e) => setCustomAgent(e.target.value)}
                placeholder="organization/agent-name"
                className="w-full mt-1 px-2 py-1.5 text-xs bg-background border border-border rounded"
              />
            )}
          </div>

          <div className="space-y-1">
            <label htmlFor="copilot-instructions" className="text-xs text-muted-foreground">
              Optional prompt
            </label>
            <textarea
              id="copilot-instructions"
              value={customInstructions}
              onChange={(e) => setCustomInstructions(e.target.value)}
              placeholder="Add guidance, constraints, or files to prioritize…"
              className="w-full px-2 py-1.5 text-xs bg-background border border-border rounded resize-none h-24"
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs bg-muted text-foreground rounded hover:bg-muted/80"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs bg-primary text-primary-foreground rounded hover:opacity-90 disabled:opacity-50"
            >
              {loading && <Loader2 className="w-3 h-3 animate-spin" />}
              Assign to Copilot
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
