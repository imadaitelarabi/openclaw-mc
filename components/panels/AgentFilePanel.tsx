"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { v4 as uuidv4 } from "uuid";

const WORKSPACE_FILES = [
  "AGENTS.md",
  "SOUL.md",
  "USER.md",
  "IDENTITY.md",
  "TOOLS.md",
  "HEARTBEAT.md",
  "BOOTSTRAP.md",
];

interface AgentFilePanelProps {
  agentId: string;
  agentName: string;
  fileName: string;
  wsRef: React.RefObject<WebSocket | null>;
  onClose?: () => void;
}

export function AgentFilePanel({
  agentId,
  agentName,
  fileName,
  wsRef,
  onClose,
}: AgentFilePanelProps) {
  const [content, setContent] = useState("");
  const [savedContent, setSavedContent] = useState("");
  const [exists, setExists] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState(false);
  const pendingRef = useRef<Map<string, { resolve: (v: any) => void; reject: (e: Error) => void }>>(
    new Map()
  );

  const isDirty = content !== savedContent;

  const sendRequest = useCallback(
    (type: string, extra: Record<string, unknown>) => {
      return new Promise<any>((resolve, reject) => {
        const ws = wsRef.current;
        if (!ws || ws.readyState !== WebSocket.OPEN) {
          reject(new Error("Not connected"));
          return;
        }
        const requestId = uuidv4();
        const timeoutId = setTimeout(() => {
          pendingRef.current.delete(requestId);
          reject(new Error("Request timed out"));
        }, 30000);
        pendingRef.current.set(requestId, {
          resolve: (v) => {
            clearTimeout(timeoutId);
            resolve(v);
          },
          reject: (e) => {
            clearTimeout(timeoutId);
            reject(e);
          },
        });
        ws.send(JSON.stringify({ type, requestId, ...extra }));
      });
    },
    [wsRef]
  );

  // Listen for responses
  useEffect(() => {
    const ws = wsRef.current;
    if (!ws) return;

    const handleMessage = (event: MessageEvent) => {
      try {
        const msg = JSON.parse(event.data);
        const pending = msg.requestId ? pendingRef.current.get(msg.requestId) : undefined;
        if (!pending) return;

        if (
          msg.type === "agents.files.get.response" ||
          msg.type === "agents.files.set.response"
        ) {
          pendingRef.current.delete(msg.requestId);
          pending.resolve(msg);
        } else if (
          msg.type === "agents.files.get.error" ||
          msg.type === "agents.files.set.error"
        ) {
          pendingRef.current.delete(msg.requestId);
          pending.reject(new Error(msg.error || "Unknown error"));
        }
      } catch {
        // ignore parse errors
      }
    };

    ws.addEventListener("message", handleMessage);
    return () => ws.removeEventListener("message", handleMessage);
  }, [wsRef]);

  // Load file on mount
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    sendRequest("agents.files.get", { agentId, name: fileName })
      .then((msg) => {
        if (cancelled) return;
        setContent(msg.content ?? "");
        setSavedContent(msg.content ?? "");
        setExists(msg.exists !== false);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Failed to load file");
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [agentId, fileName, sendRequest]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSavedMessage(false);
    try {
      await sendRequest("agents.files.set", { agentId, name: fileName, content });
      setSavedContent(content);
      setExists(true);
      setSavedMessage(true);
      setTimeout(() => setSavedMessage(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save file");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="flex-1 flex flex-col min-h-0 p-6">
        <div className="max-w-4xl mx-auto w-full flex flex-col flex-1 min-h-0 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">{fileName}</h2>
              <p className="text-sm text-muted-foreground">{agentName}</p>
            </div>
            {isDirty && !loading && (
              <span className="text-xs text-muted-foreground italic">Unsaved changes</span>
            )}
          </div>

          {loading ? (
            <div className="flex items-center justify-center flex-1 text-muted-foreground">
              Loading…
            </div>
          ) : (
            <>
              {!exists && (
                <div className="p-3 bg-muted border border-border rounded-lg text-sm text-muted-foreground">
                  This file does not exist yet. Add content below and save to create it.
                </div>
              )}

              <textarea
                className="flex-1 w-full min-h-0 px-4 py-3 bg-secondary border border-border rounded-lg font-mono text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder={`Enter ${fileName} content…`}
                spellCheck={false}
              />

              {savedMessage && (
                <div className="p-3 bg-primary/10 border border-primary rounded-lg text-primary text-sm">
                  File saved successfully.
                </div>
              )}

              {error && (
                <div className="p-3 bg-destructive/10 border border-destructive rounded-lg text-destructive text-sm">
                  {error}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving || !isDirty}
                  className="flex-1 px-6 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
                >
                  {saving ? "Saving…" : exists ? "Save" : "Create File"}
                </button>
                {onClose && (
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={saving}
                    className="px-6 py-3 bg-secondary text-foreground rounded-lg font-medium hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Close
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export { WORKSPACE_FILES };
