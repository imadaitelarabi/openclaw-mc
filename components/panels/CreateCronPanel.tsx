"use client";

import { useState } from 'react';
import type { CronJob } from '@/types';
import { CRON_SCHEDULE_PRESETS } from '@/lib/cron-schedule';

type SupportedSessionTarget = 'isolated' | 'shared';

interface CreateCronPanelProps {
  onCreateCronJob: (payload: Omit<CronJob, 'id' | 'createdAtMs' | 'updatedAtMs'>) => Promise<CronJob>;
  onClose?: () => void;
}

export function CreateCronPanel({ onCreateCronJob, onClose }: CreateCronPanelProps) {
  const [formData, setFormData] = useState({
    name: 'Daily Brief',
    expr: CRON_SCHEDULE_PRESETS[2].expr,
    tz: 'UTC',
    message: 'Summarize today\'s key updates.',
    enabled: true,
    sessionTarget: 'shared' as SupportedSessionTarget,
    deliveryMode: 'announce' as 'announce' | 'silent',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdJob, setCreatedJob] = useState<CronJob | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    const name = formData.name.trim();
    const expr = formData.expr.trim();
    const message = formData.message.trim();

    if (!name || !expr || !message) {
      setError('Name, schedule, and message are required.');
      return;
    }

    try {
      setIsSubmitting(true);
      const job = await onCreateCronJob({
        name,
        enabled: formData.enabled,
        schedule: {
          kind: 'cron',
          expr,
          tz: formData.tz.trim() || 'UTC',
        },
        sessionTarget: formData.sessionTarget,
        wakeMode: 'schedule',
        payload: {
          kind: 'agentTurn',
          message,
        },
        delivery: {
          mode: formData.deliveryMode,
          channel: 'last',
        },
      });

      setCreatedJob(job);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create cron job');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (createdJob) {
    return (
      <div className="flex flex-col h-full bg-background">
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-2xl mx-auto space-y-4">
            <h2 className="text-2xl font-bold">Cron Job Created</h2>
            <div className="p-4 bg-primary/10 border border-primary rounded-lg text-primary text-sm">
              {createdJob.name} was created successfully.
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setCreatedJob(null);
                  setError(null);
                }}
                className="flex-1 px-6 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 transition-opacity"
              >
                Create Another Job
              </button>
              {onClose && (
                <button
                  type="button"
                  onClick={onClose}
                  className="px-6 py-3 bg-secondary text-foreground rounded-lg font-medium hover:bg-muted transition-colors"
                >
                  Close
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-2xl font-bold mb-6">Create Cron Job</h2>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium mb-2">Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-2 bg-secondary border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Daily Brief"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Schedule</label>
              <select
                value={formData.expr}
                onChange={(e) => setFormData({ ...formData, expr: e.target.value })}
                className="w-full px-4 py-2 bg-secondary border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                required
              >
                {CRON_SCHEDULE_PRESETS.map((preset) => (
                  <option key={preset.expr} value={preset.expr}>
                    {preset.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Message</label>
              <textarea
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                rows={4}
                className="w-full px-4 py-2 bg-secondary border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Summarize today's key updates."
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-2">Session Target</label>
                <select
                  value={formData.sessionTarget}
                  onChange={(e) => setFormData({ ...formData, sessionTarget: e.target.value as SupportedSessionTarget })}
                  className="w-full px-4 py-2 bg-secondary border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="isolated">Isolated</option>
                  <option value="shared">Shared</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Delivery</label>
                <select
                  value={formData.deliveryMode}
                  onChange={(e) => setFormData({ ...formData, deliveryMode: e.target.value as 'announce' | 'silent' })}
                  className="w-full px-4 py-2 bg-secondary border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="announce">Announce</option>
                  <option value="silent">Silent</option>
                </select>
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={formData.enabled}
                onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
              />
              Enabled
            </label>

            {error && (
              <div className="p-4 bg-destructive/10 border border-destructive rounded-lg text-destructive text-sm">
                {error}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 px-6 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
              >
                {isSubmitting ? 'Creating...' : 'Create Cron Job'}
              </button>
              {onClose && (
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isSubmitting}
                  className="px-6 py-3 bg-secondary text-foreground rounded-lg font-medium hover:bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
