/**
 * Cron Panel
 * Read-only transcript viewer for cron job runs with control actions
 */

"use client";

import { memo, useState, useRef, useEffect } from 'react';
import { PlayCircle, Edit, Trash2, Calendar, Clock } from 'lucide-react';
import { ChatMessageItem, StreamingIndicator, ChatHistoryLoader } from '@/components/chat';
import { useCronRuns, useChatHistory, useToast } from '@/hooks';
import type { CronJob, CronRun } from '@/types';
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

export const CronPanel = memo(function CronPanel({
  job,
  sendMessage,
  onReschedule,
  onEdit,
  onDelete,
  wsRef,
}: CronPanelProps) {
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [chatHistory, setChatHistory] = useState<any[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Load runs for this job
  const { runs, loading: runsLoading, triggerRun } = useCronRuns({
    jobId: job.id,
    wsRef,
    limit: 20,
  });

  // Select the latest run by default
  useEffect(() => {
    if (runs.length > 0 && !selectedRunId) {
      setSelectedRunId(runs[0].id);
    }
  }, [runs, selectedRunId]);

  // Load chat history for selected run
  const { loading: historyLoading } = useChatHistory({ sendMessage });

  useEffect(() => {
    if (!selectedRunId) return;

    const selectedRun = runs.find(r => r.id === selectedRunId);
    if (!selectedRun) return;

    // Load session history for this cron run
    const sessionKey = selectedRun.sessionKey;
    sendMessage({
      type: 'chat.history.load',
      sessionKey,
      limit: 100,
    });
  }, [selectedRunId, runs, sendMessage]);

  // Handle cron event messages to update chat history
  useEffect(() => {
    if (!wsRef.current) return;

    const handleMessage = (event: MessageEvent) => {
      try {
        const msg = JSON.parse(event.data);

        // Handle chat history response
        if (msg.type === 'chat.history') {
          const selectedRun = runs.find(r => r.id === selectedRunId);
          if (selectedRun && msg.sessionKey === selectedRun.sessionKey) {
            setChatHistory(msg.messages || []);
          }
        }
      } catch (err) {
        console.error('[CronPanel] Failed to parse message:', err);
      }
    };

    wsRef.current.addEventListener('message', handleMessage);
    return () => {
      wsRef.current?.removeEventListener('message', handleMessage);
    };
  }, [wsRef, selectedRunId, runs]);

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

  const selectedRun = runs.find(r => r.id === selectedRunId);
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
                Run #{runs.length - idx} - {new Date(run.startedAtMs).toLocaleString()} ({run.status})
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Transcript Viewer */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto px-4 py-4"
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
          <>
            {chatHistory.map((message, idx) => (
              <ChatMessageItem
                key={message.id || idx}
                message={message}
                showTools={true}
                showReasoning={true}
              />
            ))}
            <div ref={chatEndRef} />
          </>
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
              onClick={() => onDelete(job.id)}
              className="flex items-center gap-2 px-3 py-1.5 bg-destructive text-destructive-foreground rounded hover:bg-destructive/90 text-sm"
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </button>
          )}
        </div>
      </div>
    </div>
  );
});
