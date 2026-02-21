"use client";

import type { SkillStatusReport, SkillStatusEntry } from '@/types';

interface SkillsPanelProps {
  report: SkillStatusReport | null;
  loading: boolean;
  error?: string | null;
  filter: string;
  onFilterChange: (next: string) => void;
  onRefresh: () => void;
}

const statusStyles: Record<string, string> = {
  ready: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30',
  disabled: 'bg-zinc-500/10 text-zinc-300 border-zinc-500/30',
  missing: 'bg-amber-500/10 text-amber-300 border-amber-500/30',
};

function resolveStatus(skill: SkillStatusEntry): { label: string; tone: string } {
  if (skill.disabled) {
    return { label: 'Disabled', tone: 'disabled' };
  }
  if (skill.eligible) {
    return { label: 'Ready', tone: 'ready' };
  }
  return { label: 'Needs setup', tone: 'missing' };
}

export function SkillsPanel({
  report,
  loading,
  error,
  filter,
  onFilterChange,
  onRefresh,
}: SkillsPanelProps) {
  const skills = report?.skills ?? [];
  const normalizedFilter = filter.trim().toLowerCase();
  const filtered = normalizedFilter
    ? skills.filter((skill) =>
        [skill.name, skill.description, skill.source]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(normalizedFilter)
      )
    : skills;

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-border flex items-center justify-between gap-3">
        <div>
          <div className="text-base font-semibold">Skills</div>
          <div className="text-xs text-muted-foreground">Gateway skills status snapshot</div>
        </div>
        <button
          onClick={onRefresh}
          disabled={loading}
          className="px-3 py-1.5 text-xs rounded bg-secondary hover:bg-accent disabled:opacity-60"
        >
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      <div className="p-4 border-b border-border flex items-center gap-3">
        <input
          value={filter}
          onChange={(event) => onFilterChange(event.target.value)}
          placeholder="Filter skills"
          className="flex-1 bg-transparent border border-border rounded px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <div className="text-xs text-muted-foreground">{filtered.length} shown</div>
      </div>

      <div className="flex-1 overflow-auto p-4">
        {error && (
          <div className="mb-3 text-xs text-red-400 border border-red-400/30 bg-red-500/10 px-3 py-2 rounded">
            {error}
          </div>
        )}

        {filtered.length === 0 ? (
          <div className="text-xs text-muted-foreground">No skills found.</div>
        ) : (
          <div className="space-y-3">
            {filtered.map((skill) => {
              const status = resolveStatus(skill);
              const source = skill.source ? `${skill.source}${skill.bundled ? ' · bundled' : ''}` : undefined;
              return (
                <div
                  key={skill.skillKey}
                  className="border border-border rounded-md p-3 bg-card/50"
                >
                  <div className="flex items-center gap-2">
                    {skill.emoji && <span>{skill.emoji}</span>}
                    <div className="font-medium text-sm">{skill.name}</div>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded border ${statusStyles[status.tone]}`}
                    >
                      {status.label}
                    </span>
                  </div>
                  {skill.description && (
                    <div className="text-xs text-muted-foreground mt-1">
                      {skill.description}
                    </div>
                  )}
                  {source && (
                    <div className="text-[10px] text-muted-foreground mt-2">{source}</div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
