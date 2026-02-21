"use client";

import { useState } from "react";
import type { CronJob } from "@/types";
import { CRON_SCHEDULE_PRESETS } from "@/lib/cron-schedule";
import { ModelSelector } from "@/components/statusbar/ModelSelector";

type SupportedSessionTarget = "isolated" | "shared";

interface Model {
  id: string;
  alias?: string;
  provider?: string;
}

function normalizeSessionTarget(
  target: CronJob["sessionTarget"] | string | undefined
): SupportedSessionTarget {
  if (target === "isolated") return "isolated";
  return "shared";
}

interface UpdateCronPanelProps {
  job: CronJob;
  onUpdateCronJob: (payload: { jobId: string; updates: Partial<CronJob> }) => Promise<CronJob>;
  onClose?: () => void;
  models?: Model[];
  defaultModel?: string;
}

export function UpdateCronPanel({ job, onUpdateCronJob, onClose, models = [], defaultModel }: UpdateCronPanelProps) {
  const hasKnownPreset = CRON_SCHEDULE_PRESETS.some(
    (preset) => preset.expr === (job.schedule.expr || "")
  );
  const [formData, setFormData] = useState({
    name: job.name,
    expr: job.schedule.expr || "",
    tz: job.schedule.tz || "UTC",
    message: job.payload.message,
    enabled: job.enabled,
    sessionTarget: normalizeSessionTarget(job.sessionTarget),
    deliveryMode: job.delivery.mode,
    model: job.payload.model || defaultModel || models[0]?.id || "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSaved(false);

    const name = formData.name.trim();
    const expr = formData.expr.trim();
    const message = formData.message.trim();

    if (!name || !expr || !message) {
      setError("Name, schedule, and message are required.");
      return;
    }

    if (!formData.model) {
      setError("Model is required.");
      return;
    }

    try {
      setIsSubmitting(true);
      await onUpdateCronJob({
        jobId: job.id,
        updates: {
          name,
          enabled: formData.enabled,
          schedule: {
            kind: "cron",
            expr,
            tz: formData.tz.trim() || "UTC",
          },
          sessionTarget: formData.sessionTarget,
          payload: {
            kind: "agentTurn",
            message,
            agentId: job.payload.agentId,
            model: formData.model,
          },
          delivery: {
            mode: formData.deliveryMode,
            channel: job.delivery.channel || "last",
          },
        },
      });
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update cron job");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-2xl font-bold mb-6">Edit Cron Job</h2>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium mb-2">Job ID</label>
              <input
                type="text"
                value={job.id}
                readOnly
                className="w-full px-4 py-2 bg-secondary border border-border rounded-lg opacity-70"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-2 bg-secondary border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
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
                {!hasKnownPreset && formData.expr && (
                  <option value={formData.expr}>{`Custom existing (${formData.expr})`}</option>
                )}
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
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Model</label>
              {models.length === 0 ? (
                <div className="px-4 py-2 bg-destructive/10 border border-destructive rounded-lg text-destructive text-sm">
                  No models available. Cannot submit.
                </div>
              ) : (
                <div className="w-full px-4 py-2 bg-secondary border border-border rounded-lg">
                  <ModelSelector
                    models={models}
                    currentModel={formData.model}
                    onChange={(modelId) => setFormData({ ...formData, model: modelId })}
                  />
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-2">Session Target</label>
                <select
                  value={formData.sessionTarget}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      sessionTarget: e.target.value as SupportedSessionTarget,
                    })
                  }
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
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      deliveryMode: e.target.value as CronJob["delivery"]["mode"],
                    })
                  }
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

            {saved && (
              <div className="p-4 bg-primary/10 border border-primary rounded-lg text-primary text-sm">
                Cron job updated successfully.
              </div>
            )}

            {error && (
              <div className="p-4 bg-destructive/10 border border-destructive rounded-lg text-destructive text-sm">
                {error}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={isSubmitting || models.length === 0}
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
        </div>
      </div>
    </div>
  );
}
