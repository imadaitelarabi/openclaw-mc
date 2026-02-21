/**
 * Cron Jobs Hook
 * Manages cron jobs state and provides operations for job management
 */

import { useState, useEffect, useCallback, useRef } from "react";
import type { CronJob, CronStatus, CronEvent } from "@/types";
import { v4 as uuidv4 } from "uuid";

interface UseCronJobsProps {
  wsRef: React.RefObject<WebSocket | null>;
  connectionStatus?: string;
  onEvent?: (event: CronEvent) => void;
}

export function useCronJobs({ wsRef, connectionStatus, onEvent }: UseCronJobsProps) {
  const [jobs, setJobs] = useState<CronJob[]>([]);
  const [status, setStatus] = useState<CronStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const pendingRequestsRef = useRef<
    Map<string, { resolve: (value: any) => void; reject: (error: any) => void }>
  >(new Map());

  const socket = wsRef.current;

  const isValidCronJob = useCallback((value: unknown): value is CronJob => {
    return Boolean(value && typeof value === "object" && "id" in value);
  }, []);

  const sanitizeJobs = useCallback(
    (value: unknown): CronJob[] => {
      if (!Array.isArray(value)) return [];
      return value.filter(isValidCronJob);
    },
    [isValidCronJob]
  );

  // Handle incoming WebSocket messages
  useEffect(() => {
    if (!socket) return;

    const handleMessage = (event: MessageEvent) => {
      try {
        const msg = JSON.parse(event.data);

        // Handle cron list responses
        if (msg.type === "cron.list.response") {
          const normalizedJobs = sanitizeJobs(msg.jobs);
          setJobs(normalizedJobs);
          const pending = pendingRequestsRef.current.get(msg.requestId);
          if (pending) {
            pending.resolve(normalizedJobs);
            pendingRequestsRef.current.delete(msg.requestId);
          }
        } else if (msg.type === "cron.list.error") {
          const pending = pendingRequestsRef.current.get(msg.requestId);
          if (pending) {
            pending.reject(new Error(msg.error));
            pendingRequestsRef.current.delete(msg.requestId);
          }
        }

        // Handle cron status responses
        if (msg.type === "cron.status.response") {
          setStatus(msg.status);
          const pending = pendingRequestsRef.current.get(msg.requestId);
          if (pending) {
            pending.resolve(msg.status);
            pendingRequestsRef.current.delete(msg.requestId);
          }
        }

        // Handle add/update/delete responses
        if (msg.type === "cron.add.response") {
          const createdJob = isValidCronJob(msg.job) ? msg.job : null;
          const pending = pendingRequestsRef.current.get(msg.requestId);

          if (createdJob) {
            setJobs((prev) => [...prev, createdJob]);
            if (pending) {
              pending.resolve(createdJob);
              pendingRequestsRef.current.delete(msg.requestId);
            }
          } else if (pending) {
            pending.reject(new Error("Invalid cron.add.response payload"));
            pendingRequestsRef.current.delete(msg.requestId);
          }
        } else if (msg.type === "cron.update.response") {
          const updatedJob = isValidCronJob(msg.job) ? msg.job : null;
          const pending = pendingRequestsRef.current.get(msg.requestId);

          if (updatedJob) {
            setJobs((prev) => prev.map((j) => (j.id === updatedJob.id ? updatedJob : j)));
            if (pending) {
              pending.resolve(updatedJob);
              pendingRequestsRef.current.delete(msg.requestId);
            }
          } else if (pending) {
            pending.reject(new Error("Invalid cron.update.response payload"));
            pendingRequestsRef.current.delete(msg.requestId);
          }
        } else if (msg.type === "cron.delete.response") {
          setJobs((prev) => prev.filter((j) => j.id !== msg.jobId));
          const pending = pendingRequestsRef.current.get(msg.requestId);
          if (pending) {
            pending.resolve(true);
            pendingRequestsRef.current.delete(msg.requestId);
          }
        }

        // Handle error responses
        if (msg.type?.endsWith(".error") && msg.requestId) {
          const pending = pendingRequestsRef.current.get(msg.requestId);
          if (pending) {
            pending.reject(new Error(msg.error));
            pendingRequestsRef.current.delete(msg.requestId);
          }
        }

        // Handle cron events from gateway
        if (msg.type === "event" && msg.event === "cron") {
          const cronEvent = msg.payload as CronEvent;

          if (cronEvent.action === "added" && isValidCronJob(cronEvent.job)) {
            setJobs((prev) => [...prev, cronEvent.job!]);
          } else if (cronEvent.action === "updated" && isValidCronJob(cronEvent.job)) {
            setJobs((prev) => prev.map((j) => (j.id === cronEvent.job!.id ? cronEvent.job! : j)));
          } else if (cronEvent.action === "deleted" && cronEvent.jobId) {
            setJobs((prev) => prev.filter((j) => j.id !== cronEvent.jobId));
          } else if (cronEvent.action === "status_changed" && cronEvent.status) {
            setStatus(cronEvent.status);
          }

          // Call custom event handler if provided
          if (onEvent) {
            onEvent(cronEvent);
          }
        }
      } catch (err) {
        console.error("[useCronJobs] Failed to parse message:", err);
      }
    };

    socket.addEventListener("message", handleMessage);
    return () => {
      socket.removeEventListener("message", handleMessage);
    };
  }, [socket, onEvent, isValidCronJob, sanitizeJobs]);

  const sendRequest = useCallback(
    (type: string, data: any = {}): Promise<any> => {
      return new Promise((resolve, reject) => {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
          reject(new Error("WebSocket not connected"));
          return;
        }

        const requestId = uuidv4();
        pendingRequestsRef.current.set(requestId, { resolve, reject });

        wsRef.current.send(
          JSON.stringify({
            type,
            requestId,
            ...data,
          })
        );

        // Timeout after 30 seconds
        setTimeout(() => {
          if (pendingRequestsRef.current.has(requestId)) {
            pendingRequestsRef.current.delete(requestId);
            reject(new Error("Request timeout"));
          }
        }, 30000);
      });
    },
    [wsRef]
  );

  const loadJobs = useCallback(async () => {
    try {
      setLoading(true);
      await sendRequest("cron.list");
    } catch (err) {
      console.error("[useCronJobs] Failed to load jobs:", err);
    } finally {
      setLoading(false);
    }
  }, [sendRequest]);

  const loadStatus = useCallback(async () => {
    try {
      await sendRequest("cron.status");
    } catch (err) {
      console.error("[useCronJobs] Failed to load status:", err);
    }
  }, [sendRequest]);

  // Load initial cron data when websocket is ready, and refresh after reconnects
  useEffect(() => {
    if (connectionStatus && connectionStatus !== "connected") {
      setLoading(false);
      return;
    }

    loadJobs();
    loadStatus();
  }, [connectionStatus, loadJobs, loadStatus]);

  const addJob = useCallback(
    async (job: Omit<CronJob, "id" | "createdAtMs" | "updatedAtMs">): Promise<CronJob> => {
      return sendRequest("cron.add", { job });
    },
    [sendRequest]
  );

  const updateJob = useCallback(
    async (jobId: string, updates: Partial<CronJob>): Promise<CronJob> => {
      return sendRequest("cron.update", { jobId, updates });
    },
    [sendRequest]
  );

  const deleteJob = useCallback(
    async (jobId: string): Promise<boolean> => {
      return sendRequest("cron.delete", { jobId });
    },
    [sendRequest]
  );

  const refreshJobs = useCallback(() => {
    loadJobs();
    loadStatus();
  }, [loadJobs, loadStatus]);

  return {
    jobs,
    status,
    loading,
    addJob,
    updateJob,
    deleteJob,
    refreshJobs,
  };
}
