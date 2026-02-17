export interface CronSchedulePreset {
  label: string;
  expr: string;
}

export const CRON_SCHEDULE_PRESETS: CronSchedulePreset[] = [
  { label: 'Every 15 minutes', expr: '*/15 * * * *' },
  { label: 'Every hour', expr: '0 * * * *' },
  { label: 'Every day at 8:00 AM (UTC)', expr: '0 8 * * *' },
  { label: 'Every day at 6:00 PM (UTC)', expr: '0 18 * * *' },
  { label: 'Every weekday at 9:00 AM (UTC)', expr: '0 9 * * 1-5' },
  { label: 'Every Monday at 9:00 AM (UTC)', expr: '0 9 * * 1' },
  { label: 'First day of month at 9:00 AM (UTC)', expr: '0 9 1 * *' },
];

export function getCronScheduleLabel(expr?: string): string {
  if (!expr) return 'Not scheduled';
  const preset = CRON_SCHEDULE_PRESETS.find((item) => item.expr === expr);
  return preset ? preset.label : expr;
}
