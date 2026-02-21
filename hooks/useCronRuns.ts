/**
 * Cron Runs Hook
 * Manages cron run history for a specific job
 */

import { useState, useEffect, useCallback, useRef } from "react";
import type { CronRun } from "@/types";
import { v4 as uuidv4 } from "uuid";

interface UseCronRunsProps {
  jobId: string;
  wsRef: React.RefObject<WebSocket | null>;
  limit?: number;
  connectionStatus?: string;
}

function normalizeCronRun(entry: any): CronRun {
  const startedAtMs = Number(entry?.startedAtMs ?? entry?.runAtMs ?? entry?.ts ?? Date.now());
  const durationMs = Number(entry?.durationMs ?? 0);
  const finishedAtMs =
    Number.isFinite(durationMs) && durationMs > 0
      ? startedAtMs + durationMs
      : typeof entry?.finishedAtMs === "number"
        ? entry.finishedAtMs
        : undefined;

  const id = String(
    entry?.id ?? entry?.runId ?? entry?.sessionId ?? `${entry?.jobId || "cron"}:${startedAtMs}`
  );

  const hasTerminalSignal =
    entry?.status === "ok" ||
    entry?.status === "error" ||
    entry?.action === "finished" ||
    Boolean(finishedAtMs) ||
    typeof entry?.error === "string";

  const status: CronRun["status"] =
    entry?.status === "error"
      ? "error"
      : entry?.status === "ok"
        ? "ok"
        : hasTerminalSignal
          ? "ok"
          : "running";

  return {
    id,
    jobId: String(entry?.jobId || ""),
    status,
    startedAtMs,
    finishedAtMs,
    sessionKey: String(entry?.sessionKey || ""),
    output:
      typeof entry?.output === "string"
        ? entry.output
        : typeof entry?.summary === "string"
          ? entry.summary
          : undefined,
    error: typeof entry?.error === "string" ? entry.error : undefined,
  };
}

function normalizeCronRuns(entries: any[] = []): CronRun[] {
  return entries
    .map((entry) => normalizeCronRun(entry))
    .filter((entry) => Boolean(entry.id) && Boolean(entry.jobId))
    .sort((a, b) => b.startedAtMs - a.startedAtMs);
}

export function useCronRuns({ jobId, wsRef, limit = 10, connectionStatus }: UseCronRunsProps) {
  const [runs, setRuns] = useState<CronRun[]>([]);
  const [loading, setLoading] = useState(true);
  const pendingRequestsRef = useRef<
    Map<
      string,
      {
        resolve: (value: any) => void;
        reject: (error: any) => void;
        type: string;
        jobId?: string;
        timeoutId: ReturnType<typeof setTimeout>;
      }
    >
  >(new Map());

  const socket = wsRef.current;

  // Load run history
  useEffect(() => {
    if (!jobId || (connectionStatus && connectionStatus !== "connected")) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    const loadInitialRuns = async () => {
      try {
        setLoading(true);
        await sendRequest("cron.runs", { jobId, limit });
      } catch (err) {
        if (!cancelled) {
          console.error("[useCronRuns] Failed to load runs:", err);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadInitialRuns();

    return () => {
      cancelled = true;
    };
  }, [jobId, limit, connectionStatus, wsRef]);

  // Handle incoming WebSocket messages
  useEffect(() => {
    if (!socket) return;

    const handleMessage = (event: MessageEvent) => {
      try {
        const msg = JSON.parse(event.data);

        // Handle cron runs responses
        if (msg.type === "cron.runs.response") {
          setRuns(normalizeCronRuns(msg.entries || []));
          const pending = pendingRequestsRef.current.get(msg.requestId);
          if (pending) {
            clearTimeout(pending.timeoutId);
            pending.resolve(normalizeCronRuns(msg.entries || []));
            pendingRequestsRef.current.delete(msg.requestId);
          }
        } else if (msg.type === "cron.runs.error") {
          const pending = pendingRequestsRef.current.get(msg.requestId);
          if (pending) {
            clearTimeout(pending.timeoutId);
            pending.reject(new Error(msg.error));
            pendingRequestsRef.current.delete(msg.requestId);
          }
        }

        // Handle cron run trigger responses
        if (msg.type === "cron.run.response") {
          // Add the new run to the list (deduplicate by id)
          const normalizedRun = normalizeCronRun(msg.run);
          setRuns((prev) => {
            const exists = prev.some((r) => r.id === normalizedRun.id);
            if (exists) return prev;
            return [normalizedRun, ...prev].sort((a, b) => b.startedAtMs - a.startedAtMs);
          });
          const pending = pendingRequestsRef.current.get(msg.requestId);
          if (pending) {
            clearTimeout(pending.timeoutId);
            pending.resolve(normalizedRun);
            pendingRequestsRef.current.delete(msg.requestId);
          }
        } else if (msg.type === "cron.run.error") {
          const pending = pendingRequestsRef.current.get(msg.requestId);
          if (pending) {
            clearTimeout(pending.timeoutId);
            pending.reject(new Error(msg.error));
            pendingRequestsRef.current.delete(msg.requestId);
          }
        }

        // Fallback ack: sometimes cron.run.response is missing, but lifecycle start event arrives.
        if (msg.type === "event" && msg.event === "agent") {
          const payload = msg.payload || {};
          const sessionKey = typeof payload.sessionKey === "string" ? payload.sessionKey : "";
          const isLifecycleStart =
            payload.stream === "lifecycle" && payload.data?.phase === "start";
          const belongsToThisJob = sessionKey.includes(`:cron:${jobId}`);

          if (isLifecycleStart && belongsToThisJob && payload.runId) {
            const syntheticRun: CronRun = {
              id: String(payload.runId),
              jobId,
              status: "running",
              startedAtMs: Number(payload.data?.startedAt ?? payload.ts ?? Date.now()),
              sessionKey,
            };

            setRuns((prev) => {
              const exists = prev.some((r) => r.id === syntheticRun.id);
              if (exists) {
                return prev
                  .map((r) => (r.id === syntheticRun.id ? { ...r, ...syntheticRun } : r))
                  .sort((a, b) => b.startedAtMs - a.startedAtMs);
              }
              return [syntheticRun, ...prev].sort((a, b) => b.startedAtMs - a.startedAtMs);
            });

            for (const [requestId, pending] of pendingRequestsRef.current.entries()) {
              if (pending.type === "cron.run" && pending.jobId === jobId) {
                clearTimeout(pending.timeoutId);
                pending.resolve(syntheticRun);
                pendingRequestsRef.current.delete(requestId);
                break;
              }
            }
          }
        }

        // Handle cron events for job runs
        if (msg.type === "event" && msg.event === "cron") {
          const cronEvent = msg.payload || {};
          const action =
            cronEvent.action ||
            (cronEvent.type === "job_started"
              ? "started"
              : cronEvent.type === "job_finished"
                ? "finished"
                : undefined);
          const eventJobId = cronEvent.jobId || cronEvent.run?.jobId;

          if (!action || eventJobId !== jobId) {
            return;
          }

          if (action === "started") {
            if (cronEvent.run?.id) {
              const normalizedRun = normalizeCronRun(cronEvent.run);
              setRuns((prev) => {
                const exists = prev.some((r) => r.id === normalizedRun.id);
                if (exists) return prev;
                return [normalizedRun, ...prev].sort((a, b) => b.startedAtMs - a.startedAtMs);
              });
            } else {
              sendRequest("cron.runs", { jobId, limit }).catch((err) => {
                console.error("[useCronRuns] Failed to refresh runs after start event:", err);
              });
            }
          } else if (action === "finished") {
            if (cronEvent.run?.id) {
              const normalizedRun = normalizeCronRun(cronEvent.run);
              setRuns((prev) => prev.map((r) => (r.id === normalizedRun.id ? normalizedRun : r)));
            } else {
              sendRequest("cron.runs", { jobId, limit }).catch((err) => {
                console.error("[useCronRuns] Failed to refresh runs after finish event:", err);
              });
            }
          }
        }
      } catch (err) {
        console.error("[useCronRuns] Failed to parse message:", err);
      }
    };

    socket.addEventListener("message", handleMessage);
    return () => {
      socket.removeEventListener("message", handleMessage);
    };
  }, [socket, jobId, limit]);

  const sendRequest = useCallback(
    (type: string, data: any = {}): Promise<any> => {
      return new Promise((resolve, reject) => {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
          reject(new Error("WebSocket not connected"));
          return;
        }

        const requestId = uuidv4();
        const timeoutId = setTimeout(() => {
          const pending = pendingRequestsRef.current.get(requestId);
          if (pending) {
            pendingRequestsRef.current.delete(requestId);
            reject(new Error("Request timeout"));
          }
        }, 30000);

        pendingRequestsRef.current.set(requestId, {
          resolve,
          reject,
          type,
          jobId: data?.jobId,
          timeoutId,
        });

        wsRef.current.send(
          JSON.stringify({
            type,
            requestId,
            ...data,
          })
        );
      });
    },
    [wsRef]
  );

  const loadRuns = useCallback(async () => {
    if (!jobId) return;

    try {
      setLoading(true);
      await sendRequest("cron.runs", { jobId, limit });
    } catch (err) {
      console.error("[useCronRuns] Failed to load runs:", err);
    } finally {
      setLoading(false);
    }
  }, [sendRequest, jobId, limit]);

  const triggerRun = useCallback(
    async (mode: "force" | "schedule" = "force"): Promise<CronRun> => {
      return sendRequest("cron.run", { jobId, mode });
    },
    [sendRequest, jobId]
  );

  return {
    runs,
    loading,
    triggerRun,
    refreshRuns: loadRuns,
  };
}
