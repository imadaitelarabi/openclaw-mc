/**
 * Cron Status Bar Item
 * Shows next scheduled job and running state, with dropdown menu for job selection
 */

import { Clock, ChevronDown, Play } from 'lucide-react';
import type { CronJob, CronStatus } from '@/types';
import { formatDistanceToNow } from 'date-fns';
import { getCronScheduleLabel } from '@/lib/cron-schedule';

interface CronStatusBarItemProps {
  jobs: CronJob[];
  status: CronStatus | null;
  isOpen: boolean;
  onToggle: () => void;
  onSelectJob: (jobId: string) => void;
  onCreateJob?: () => void;
}

export function CronStatusBarItem({
  jobs,
  status,
  isOpen,
  onToggle,
  onSelectJob,
  onCreateJob,
}: CronStatusBarItemProps) {
  // Find next scheduled job and running jobs
  const nextJob = jobs
    .filter(j => j.enabled && j.state?.nextRunAtMs)
    .sort((a, b) => (a.state?.nextRunAtMs || 0) - (b.state?.nextRunAtMs || 0))[0];

  const runningJobs = jobs.filter(j => j.enabled && j.state?.nextRunAtMs === 0);
  const isRunning = runningJobs.length > 0;

  // Format next run time
  const nextRunText = nextJob?.state?.nextRunAtMs
    ? formatDistanceToNow(nextJob.state.nextRunAtMs, { addSuffix: true })
    : 'None';

  // Sort jobs: running first, then by nextWake
  const sortedJobs = [...jobs].sort((a, b) => {
    const aRunning = a.enabled && a.state?.nextRunAtMs === 0 ? 1 : 0;
    const bRunning = b.enabled && b.state?.nextRunAtMs === 0 ? 1 : 0;
    
    if (aRunning !== bRunning) return bRunning - aRunning;
    
    const aNext = a.state?.nextRunAtMs || Infinity;
    const bNext = b.state?.nextRunAtMs || Infinity;
    return aNext - bNext;
  });

  if (!status?.enabled && jobs.length === 0) {
    return null;
  }

  return (
    <div className="relative">
      <button
        onClick={onToggle}
        className="flex items-center gap-2 hover:bg-white/10 px-2 py-1 rounded cursor-pointer transition-colors"
      >
        <Clock className={`w-3 h-3 ${isRunning ? 'text-green-500 animate-pulse' : 'text-muted-foreground'}`} />
        {isRunning ? (
          <span className="font-medium text-green-500">
            ● Running: {runningJobs[0].name}
          </span>
        ) : nextJob ? (
          <span className="font-medium">
            ⏰ {nextJob.name} {nextRunText}
          </span>
        ) : (
          <span className="font-medium text-muted-foreground">No scheduled jobs</span>
        )}
        <ChevronDown className="w-3 h-3 opacity-50" />
      </button>

      {isOpen && (
        <div className="absolute bottom-full right-0 mb-2 w-64 bg-popover border border-border rounded shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-100 z-50">
          <div className="p-2 border-b border-border bg-muted/50 flex items-center justify-between gap-2">
            <span className="text-muted-foreground font-medium">Cron Jobs ({jobs.length})</span>
            {onCreateJob && (
              <button
                onClick={onCreateJob}
                className="px-2 py-1 text-xs rounded bg-primary text-primary-foreground hover:bg-primary/90"
              >
                New
              </button>
            )}
          </div>
          <div className="max-h-64 overflow-y-auto py-1">
            {sortedJobs.length === 0 ? (
              <div className="px-3 py-2 text-muted-foreground text-center">
                No cron jobs configured
              </div>
            ) : (
              sortedJobs.map(job => {
                const isJobRunning = job.enabled && job.state?.nextRunAtMs === 0;
                const nextRun = job.state?.nextRunAtMs;
                const nextRunLabel = nextRun && nextRun > 0
                  ? formatDistanceToNow(nextRun, { addSuffix: true })
                  : isJobRunning
                  ? 'Running now'
                  : 'Not scheduled';

                return (
                  <button
                    key={job.id}
                    onClick={() => {
                      onSelectJob(job.id);
                      onToggle();
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-accent hover:text-accent-foreground transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        {isJobRunning && (
                          <Play className="w-3 h-3 text-green-500 flex-shrink-0 animate-pulse" />
                        )}
                        <span className={`font-medium truncate ${!job.enabled ? 'text-muted-foreground' : ''}`}>
                          {job.name}
                        </span>
                      </div>
                      {!job.enabled && (
                        <span className="text-xs text-muted-foreground ml-2">Disabled</span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {nextRunLabel}
                      {job.schedule.expr && ` • ${getCronScheduleLabel(job.schedule.expr)}`}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
