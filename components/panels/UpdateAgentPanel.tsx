"use client";

import { useState } from "react";
import { WORKSPACE_FILES } from "./AgentFilePanel";

interface UpdateAgentPanelProps {
  agentId: string;
  initialName: string;
  onUpdateAgent: (payload: {
    agentId: string;
    name: string;
  }) => Promise<{ agentId: string; name: string }>;
  onOpenFile?: (fileName: string) => void;
  onClose?: () => void;
}

export function UpdateAgentPanel({
  agentId,
  initialName,
  onUpdateAgent,
  onOpenFile,
  onClose,
}: UpdateAgentPanelProps) {
  const [activeTab, setActiveTab] = useState<"details" | "files">("details");
  const [name, setName] = useState(initialName);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updatedName, setUpdatedName] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setUpdatedName(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Agent name is required");
      return;
    }

    try {
      setIsSubmitting(true);
      const updated = await onUpdateAgent({ agentId, name: trimmedName });
      setUpdatedName(updated.name);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update agent");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Tabs */}
      <div className="flex border-b border-border px-6 pt-6">
        <button
          type="button"
          onClick={() => setActiveTab("details")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "details"
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Details
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("files")}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === "files"
              ? "border-primary text-foreground"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Files
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl mx-auto">
          {activeTab === "details" && (
            <>
              <h2 className="text-2xl font-bold mb-6">Edit Agent</h2>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label className="block text-sm font-medium mb-2">Agent ID</label>
                  <input
                    type="text"
                    value={agentId}
                    readOnly
                    className="w-full px-4 py-2 bg-secondary border border-border rounded-lg opacity-70"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">Agent Name</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-4 py-2 bg-secondary border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="Agent name"
                    required
                  />
                </div>

                {updatedName && (
                  <div className="p-4 bg-primary/10 border border-primary rounded-lg text-primary text-sm">
                    Agent renamed to &quot;{updatedName}&quot; successfully.
                  </div>
                )}

                {error && (
                  <div className="p-4 bg-destructive/10 border border-destructive rounded-lg text-destructive text-sm">
                    {error}
                  </div>
                )}

                <div className="flex gap-3 pt-4">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 px-6 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
                  >
                    {isSubmitting ? "Saving..." : "Save Changes"}
                  </button>
                  {onClose && (
                    <button
                      type="button"
                      onClick={onClose}
                      disabled={isSubmitting}
                      className="px-6 py-3 bg-secondary text-foreground rounded-lg font-medium hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Close
                    </button>
                  )}
                </div>
              </form>
            </>
          )}

          {activeTab === "files" && (
            <>
              <h2 className="text-2xl font-bold mb-6">Workspace Files</h2>
              <ul className="space-y-2">
                {WORKSPACE_FILES.map((file) => (
                  <li key={file}>
                    <button
                      type="button"
                      onClick={() => onOpenFile?.(file)}
                      className="w-full text-left px-4 py-3 bg-secondary border border-border rounded-lg hover:bg-muted transition-colors font-mono text-sm flex items-center justify-between group"
                    >
                      <span>{file}</span>
                      <span className="text-muted-foreground text-xs group-hover:text-foreground transition-colors">
                        Open →
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
