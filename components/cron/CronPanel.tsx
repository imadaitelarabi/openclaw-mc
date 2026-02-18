/**
 * Cron Panel
 * Read-only transcript viewer for cron job runs with control actions
 */

"use client";

import { memo, useState, useRef, useEffect } from 'react';
import { PlayCircle, Edit, Trash2, Calendar, Clock } from 'lucide-react';
import { ChatMessageItem } from '@/components/chat';
import { ConfirmationModal } from '@/components/modals';
import { useCronRuns, useToast } from '@/hooks';
import type { ChatMessage, CronJob } from '@/types';
import { formatDistanceToNow } from 'date-fns';
import { getCronScheduleLabel } from '@/lib/cron-schedule';

interface CronPanelProps {
  job: CronJob;
  sendMessage: (msg: any) => void;
  onReschedule?: (jobId: string) => void;
  onEdit?: (jobId: string) => void;
  onDelete?: (jobId: string) => void;
  wsRef: React.RefObject<WebSocket | null>;
}

function normalizeTextContent(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value == null) return '';

  if (Array.isArray(value)) {
    return value.map((item) => normalizeTextContent(item)).filter(Boolean).join('\n');
  }

  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;

    if (typeof record.text === 'string') return record.text;
    if (typeof record.content === 'string') return record.content;
    if (typeof record.message === 'string') return record.message;

    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  }

  return String(value);
}

function normalizeChatMessage(raw: any, fallbackRunId?: string): ChatMessage | null {
  if (!raw || typeof raw !== 'object') return null;

  const role: ChatMessage['role'] = raw.role === 'user'
    ? 'user'
    : raw.role === 'reasoning'
      ? 'reasoning'
      : raw.role === 'tool'
        ? 'tool'
        : 'assistant';

  const runId = typeof raw.runId === 'string' ? raw.runId : fallbackRunId;
  const timestamp = typeof raw.timestamp === 'number' ? raw.timestamp : Date.now();
  const content = normalizeTextContent(raw.content ?? raw.text ?? raw.message ?? '');
  const id = typeof raw.id === 'string'
    ? raw.id
    : `${runId || 'cron'}-${role}-${timestamp}-${Math.random().toString(36).slice(2, 7)}`;

  const normalized: ChatMessage = {
    id,
    role,
    content,
    timestamp,
    runId,
  };

  if (role === 'tool') {
    normalized.tool = {
      name: raw.tool?.name || raw.toolName || 'tool',
      args: raw.tool?.args,
      result: raw.tool?.result,
      error: raw.tool?.error,
      status: raw.tool?.status || 'start',
      duration: raw.tool?.duration,
      exitCode: raw.tool?.exitCode,
    };
  }

  if (raw.stopReason) normalized.stopReason = raw.stopReason;
  if (raw.errorMessage) normalized.errorMessage = raw.errorMessage;

  return normalized;
}

function stripAssistantEnvelope(text: string): string {
  const finalMatch = text.match(/<final>([\s\S]*?)<\/final>/i);
  const withoutFinal = finalMatch ? finalMatch[1] : text;
  const withoutThink = withoutFinal.replace(/<think>[\s\S]*?<\/think>/gi, '');
  return withoutThink.replace(/\[\[reply_to_current\]\]/g, '').trim();
}

function toContentParts(content: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(content)) {
    return content.filter((part): part is Record<string, unknown> => typeof part === 'object' && part !== null);
  }

  if (typeof content === 'string') {
    return [{ type: 'text', text: content }];
  }

  if (content && typeof content === 'object') {
    return [content as Record<string, unknown>];
  }

  return [];
}

function normalizeHistoryMessages(rawMessages: any[], fallbackRunId?: string): ChatMessage[] {
  const normalized: ChatMessage[] = [];

  const upsertMessage = (incoming: ChatMessage) => {
    const existingIndex = normalized.findIndex((item) => item.id === incoming.id);
    if (existingIndex === -1) {
      normalized.push(incoming);
      return;
    }

    const existing = normalized[existingIndex];
    const merged: ChatMessage = {
      ...existing,
      ...incoming,
      timestamp: Math.max(existing.timestamp || 0, incoming.timestamp || 0),
      content: incoming.content || existing.content,
      tool: incoming.tool
        ? {
            ...(existing.tool || {}),
            ...incoming.tool,
          }
        : existing.tool,
    };

    normalized[existingIndex] = merged;
  };

  rawMessages.forEach((raw, messageIndex) => {
    if (!raw || typeof raw !== 'object') return;

    const timestamp = typeof raw.timestamp === 'number' ? raw.timestamp : Date.now();
    const runId = typeof raw.runId === 'string' ? raw.runId : fallbackRunId;
    const baseId = typeof raw.id === 'string'
      ? raw.id
      : `${runId || 'cron'}-${timestamp}-${messageIndex}`;

    if (raw.role === 'toolResult') {
      const details = (raw.details && typeof raw.details === 'object') ? raw.details : {};
      const isError = Boolean(raw.isError);
      const toolName = normalizeTextContent(raw.toolName || 'tool');
      const toolCallId = normalizeTextContent(raw.toolCallId || `${baseId}-tool-result`);
      const resultText = normalizeTextContent((details as any).aggregated || raw.content || (details as any).result);
      const errorText = normalizeTextContent((details as any).error || raw.content || 'Tool execution failed');

      upsertMessage({
        id: toolCallId,
        role: 'tool',
        content: toolName,
        timestamp,
        runId,
        tool: {
          name: toolName,
          status: isError ? 'error' : 'end',
          result: isError ? undefined : (resultText || undefined),
          error: isError ? errorText : undefined,
          duration: typeof (details as any).durationMs === 'number' ? (details as any).durationMs : undefined,
          exitCode: typeof (details as any).exitCode === 'number' ? (details as any).exitCode : undefined,
        },
      });
      return;
    }

    const parts = toContentParts(raw.content);
    const textParts: string[] = [];
    let hasStructuredParts = false;

    parts.forEach((part, partIndex) => {
      const partType = normalizeTextContent(part.type).toLowerCase();

      if (partType === 'thinking') {
        hasStructuredParts = true;
        const thinkingText = normalizeTextContent(part.thinking ?? part.text).trim();
        if (!thinkingText) return;

        upsertMessage({
          id: `${baseId}-reasoning-${partIndex}`,
          role: 'reasoning',
          content: thinkingText,
          timestamp,
          runId,
        });
        return;
      }

      if (partType === 'toolcall') {
        hasStructuredParts = true;
        const toolName = normalizeTextContent(part.name || 'tool');
        const toolCallId = normalizeTextContent(part.id || `${baseId}-tool-${partIndex}`);

        upsertMessage({
          id: toolCallId,
          role: 'tool',
          content: toolName,
          timestamp,
          runId,
          tool: {
            name: toolName,
            args: part.arguments,
            status: 'start',
          },
        });
        return;
      }

      if (partType === 'toolresult') {
        hasStructuredParts = true;
        const toolName = normalizeTextContent(part.name || part.toolName || 'tool');
        const toolCallId = normalizeTextContent(part.id || part.toolCallId || `${baseId}-tool-result-${partIndex}`);
        const resultText = normalizeTextContent(part.result ?? part.content ?? part.output);
        const errorText = normalizeTextContent(part.error);

        upsertMessage({
          id: toolCallId,
          role: 'tool',
          content: toolName,
          timestamp,
          runId,
          tool: {
            name: toolName,
            status: errorText ? 'error' : 'end',
            result: errorText ? undefined : (resultText || undefined),
            error: errorText || undefined,
          },
        });
        return;
      }

      if (partType === 'text' || partType === 'output_text') {
        const text = stripAssistantEnvelope(normalizeTextContent(part.text));
        if (text) textParts.push(text);
        return;
      }

      const fallbackText = normalizeTextContent(part).trim();
      if (fallbackText) textParts.push(stripAssistantEnvelope(fallbackText));
    });

    const role: ChatMessage['role'] = raw.role === 'user'
      ? 'user'
      : raw.role === 'reasoning'
        ? 'reasoning'
        : raw.role === 'tool'
          ? 'tool'
          : 'assistant';

    const textContent = textParts.join('\n\n').trim();
    const fallbackContent = stripAssistantEnvelope(normalizeTextContent(raw.content ?? raw.text ?? raw.message ?? '').trim());
    const shouldUseFallbackContent = parts.length === 0;
    const content = textContent || (shouldUseFallbackContent ? fallbackContent : '');

    if (!content && role !== 'tool') {
      return;
    }

    if (role === 'assistant' && hasStructuredParts && !textContent) {
      return;
    }

    const normalizedMessage = normalizeChatMessage({
      ...raw,
      id: String(baseId),
      role,
      content,
      timestamp,
      runId,
    }, fallbackRunId);

    if (normalizedMessage) {
      upsertMessage(normalizedMessage);
    }
  });

  return normalized.sort((a, b) => a.timestamp - b.timestamp);
}

function upsertChatMessage(prev: ChatMessage[], incoming: ChatMessage, appendContent = false): ChatMessage[] {
  const existingIndex = prev.findIndex((message) => message.id === incoming.id);

  if (existingIndex === -1) {
    return [...prev, incoming].sort((a, b) => a.timestamp - b.timestamp);
  }

  const existing = prev[existingIndex];
  const merged: ChatMessage = {
    ...existing,
    ...incoming,
    timestamp: Math.max(existing.timestamp || 0, incoming.timestamp || 0),
    content: appendContent
      ? `${existing.content || ''}${incoming.content || ''}`
      : (incoming.content || existing.content || ''),
  };

  const next = [...prev];
  next[existingIndex] = merged;
  return next.sort((a, b) => a.timestamp - b.timestamp);
}

function extractAgentIdFromSessionKey(sessionKey?: string): string | null {
  if (!sessionKey || typeof sessionKey !== 'string') return null;
  const parts = sessionKey.split(':');
  if (parts[0] !== 'agent' || !parts[1]) return null;
  return parts[1];
}

function getSessionRoot(sessionKey?: string): string {
  if (!sessionKey) return '';
  const [root] = sessionKey.split(':run:');
  return root || sessionKey;
}

function isMatchingSession(payloadSessionKey?: string, selectedSessionKey?: string): boolean {
  if (!payloadSessionKey || !selectedSessionKey) return false;
  if (payloadSessionKey === selectedSessionKey) return true;

  const payloadRoot = getSessionRoot(payloadSessionKey);
  const selectedRoot = getSessionRoot(selectedSessionKey);

  return payloadRoot === selectedRoot;
}

export const CronPanel = memo(function CronPanel({
  job,
  sendMessage,
  onReschedule,
  onEdit,
  onDelete,
  wsRef,
}: CronPanelProps) {
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const pendingForceSelectRef = useRef(false);
  const { toast } = useToast();

  // Load runs for this job
  const { runs, loading: runsLoading, triggerRun } = useCronRuns({
    jobId: job.id,
    wsRef,
    limit: 20,
  });
  const selectedRun = runs.find(r => r.id === selectedRunId);
  const selectedSessionKey = selectedRun?.sessionKey;
  const selectedSessionRoot = getSessionRoot(selectedSessionKey);
  const selectedAgentId = extractAgentIdFromSessionKey(selectedSessionKey);

  // Select the latest run by default
  useEffect(() => {
    if (runs.length > 0 && !selectedRunId) {
      setSelectedRunId(runs[0].id);
    }
  }, [runs, selectedRunId]);

  useEffect(() => {
    if (!pendingForceSelectRef.current || runs.length === 0) {
      return;
    }

    setSelectedRunId(runs[0].id);
    pendingForceSelectRef.current = false;
  }, [runs]);

  useEffect(() => {
    if (!selectedRunId || !selectedSessionKey || !selectedAgentId) return;

    setChatHistory([]);
    setHistoryLoading(true);

    const historySessionKey = selectedRun?.status === 'running' ? selectedSessionRoot : selectedSessionKey;

    sendMessage({
      type: 'chat.history.load',
      agentId: selectedAgentId,
      params: {
        sessionKey: historySessionKey,
        limit: 100,
      },
    });
  }, [selectedRunId, selectedRun?.status, selectedSessionKey, selectedSessionRoot, selectedAgentId, sendMessage]);

  // Handle cron event messages to update chat history
  useEffect(() => {
    if (!wsRef.current || !selectedSessionKey) return;

    const handleMessage = (event: MessageEvent) => {
      try {
        const msg = JSON.parse(event.data);

        if (msg.type === 'chat.history' && isMatchingSession(msg.sessionKey, selectedSessionKey)) {
          const messages = Array.isArray(msg.messages)
            ? normalizeHistoryMessages(msg.messages, selectedRun?.id)
            : [];

          setChatHistory(messages);
          setHistoryLoading(false);
          return;
        }

        if (msg.type === 'chat_history_more' && selectedAgentId && msg.agentId === selectedAgentId) {
          if (msg.sessionKey && !isMatchingSession(msg.sessionKey, selectedSessionKey)) {
            return;
          }

          const messages = Array.isArray(msg.messages)
            ? normalizeHistoryMessages(msg.messages, selectedRun?.id)
            : [];

          setChatHistory(messages);
          setHistoryLoading(false);
          return;
        }

        if (msg.type !== 'event' || (msg.event !== 'agent' && msg.event !== 'chat')) {
          return;
        }

        const payload = msg.payload || {};

        if (!isMatchingSession(payload.sessionKey, selectedSessionKey)) {
          return;
        }

        if (payload.stream === 'lifecycle' && payload.data?.phase === 'start') {
          setHistoryLoading(false);
        }

        if (msg.event === 'chat') {
          const normalized = normalizeChatMessage(payload.message, payload.runId);
          if (normalized) {
            const shouldAppend = payload.state === 'delta' && normalized.role !== 'user';
            setChatHistory(prev => upsertChatMessage(prev, normalized, shouldAppend));
          }
          return;
        }

        const stream = payload.stream;
        const data = payload.data || {};
        const runId = payload.runId;
        const seq = payload.seq;

        if (stream === 'assistant' || stream === 'reasoning') {
          const role: ChatMessage['role'] = stream === 'reasoning' ? 'reasoning' : 'assistant';
          const streamContent = normalizeTextContent(data.text ?? data.delta ?? data.content ?? data.message ?? data);
          if (!streamContent) return;

          const messageId = `${runId || selectedRunId || 'cron'}-${role}-stream`;
          setChatHistory(prev => upsertChatMessage(prev, {
            id: messageId,
            role,
            content: streamContent,
            timestamp: Date.now(),
            runId,
          }, true));
          return;
        }

        if (stream === 'tool') {
          const toolName = payload.tool || data.name || 'tool';
          const toolCallId = data.toolCallId || `${runId || selectedRunId || 'cron'}-${toolName}-${seq || 0}`;
          const phase = data.phase;

          setChatHistory(prev => upsertChatMessage(prev, {
            id: toolCallId,
            role: 'tool',
            content: toolName,
            timestamp: Date.now(),
            runId,
            tool: {
              name: toolName,
              args: data.args,
              result: data.result ?? data.meta?.result ?? data.meta,
              error: data.error,
              status: phase === 'error' ? 'error' : (phase === 'result' || phase === 'end' ? 'end' : 'start'),
            },
          }));
          return;
        }

        if (stream === 'lifecycle' && data.phase === 'error') {
          const errorMessage = normalizeTextContent(data.error || 'Run failed');
          setChatHistory(prev => upsertChatMessage(prev, {
            id: `${runId || selectedRunId || 'cron'}-assistant-error`,
            role: 'assistant',
            content: errorMessage,
            errorMessage,
            stopReason: 'error',
            timestamp: Date.now(),
            runId,
          }));
        }
      } catch (err) {
        console.error('[CronPanel] Failed to parse message:', err);
        setHistoryLoading(false);
      }
    };

    wsRef.current.addEventListener('message', handleMessage);
    return () => {
      wsRef.current?.removeEventListener('message', handleMessage);
    };
  }, [wsRef, selectedRunId, selectedRun, selectedSessionKey, selectedAgentId]);

  // Auto-scroll to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

  const handleForceRun = async () => {
    if (!wsRef.current) {
      return;
    }

    try {
      setIsRunning(true);
      pendingForceSelectRef.current = true;
      setHistoryLoading(true);
      toast({
        title: 'Triggering run',
        description: 'Starting cron job execution...',
      });

      const newRun = await triggerRun('force');

      // Select the new run that was just triggered
      if (newRun && newRun.id) {
        setSelectedRunId(newRun.id);
      }
    } catch (err) {
      console.error('[CronPanel] Failed to trigger run:', err);
      toast({
        title: 'Failed to trigger run',
        description: err instanceof Error ? err.message : 'Unable to force run cron job.',
        variant: 'destructive',
      });
    } finally {
      setIsRunning(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!onDelete) {
      return;
    }

    try {
      await onDelete(job.id);
    } finally {
      setShowDeleteConfirm(false);
    }
  };

  const nextRun = job.state?.nextRunAtMs;

  return (
    <div className="flex flex-col h-full">
      {/* Job Info Header */}
      <div className="border-b border-border p-4 bg-muted/30">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold truncate">{job.name}</h3>
            <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
              {job.schedule.expr && (
                <div className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  <span>{getCronScheduleLabel(job.schedule.expr)}</span>
                </div>
              )}
              {nextRun && nextRun > 0 && (
                <div className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  <span>Next: {formatDistanceToNow(nextRun, { addSuffix: true })}</span>
                </div>
              )}
              {!job.enabled && (
                <span className="text-yellow-500">Disabled</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Run Picker */}
      {runs.length > 0 && (
        <div className="border-b border-border p-2 bg-muted/20">
          <select
            value={selectedRunId || ''}
            onChange={(e) => setSelectedRunId(e.target.value)}
            className="w-full px-3 py-2 bg-background border border-border rounded text-sm"
          >
            {runs.map((run, idx) => (
              <option key={run.id} value={run.id}>
                Run #{runs.length - idx} - {new Date(Number(run.startedAtMs)).toLocaleString()} ({run.status})
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Transcript Viewer */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-6"
      >
        {runsLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-muted-foreground">Loading runs...</div>
          </div>
        ) : runs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <p>No runs yet</p>
            <p className="text-sm mt-2">This job has not been executed</p>
          </div>
        ) : chatHistory.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-muted-foreground">
              {historyLoading ? 'Loading transcript...' : 'No messages in this run'}
            </div>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto space-y-6 pb-4">
            {chatHistory.map((message, idx) => (
              <ChatMessageItem
                key={message.id || idx}
                message={message}
                showTools={true}
              />
            ))}
            <div ref={chatEndRef} />
          </div>
        )}
      </div>

      {/* Control Strip */}
      <div className="border-t border-border p-3 bg-muted/30">
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={handleForceRun}
            disabled={!job.enabled || isRunning}
            className="flex items-center gap-2 px-3 py-1.5 bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
          >
            <PlayCircle className={`w-4 h-4 ${isRunning ? 'animate-spin' : ''}`} />
            {isRunning ? 'Running...' : 'Force Run'}
          </button>
          
          {onReschedule && (
            <button
              onClick={() => onReschedule(job.id)}
              className="flex items-center gap-2 px-3 py-1.5 bg-secondary text-secondary-foreground rounded hover:bg-secondary/80 text-sm"
            >
              <Calendar className="w-4 h-4" />
              Reschedule
            </button>
          )}
          
          {onEdit && (
            <button
              onClick={() => onEdit(job.id)}
              className="flex items-center gap-2 px-3 py-1.5 bg-secondary text-secondary-foreground rounded hover:bg-secondary/80 text-sm"
            >
              <Edit className="w-4 h-4" />
              Edit
            </button>
          )}
          
          {onDelete && (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="flex items-center gap-2 px-3 py-1.5 bg-destructive text-destructive-foreground rounded hover:bg-destructive/90 text-sm"
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </button>
          )}
        </div>
      </div>

      <ConfirmationModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleConfirmDelete}
        title="Delete Cron Job"
        message={`Are you sure you want to delete "${job.name}"? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
      />
    </div>
  );
});
