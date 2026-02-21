export interface SkillInstallOption {
  id: string;
  kind: string;
  label: string;
  bins?: string[];
}

export interface SkillStatusEntry {
  name: string;
  description?: string;
  source?: string;
  bundled?: boolean;
  filePath?: string;
  baseDir?: string;
  skillKey: string;
  primaryEnv?: string;
  emoji?: string;
  homepage?: string;
  always?: boolean;
  disabled?: boolean;
  blockedByAllowlist?: boolean;
  eligible?: boolean;
  requirements?: Record<string, unknown>;
  missing?: Record<string, unknown>;
  configChecks?: Record<string, unknown>;
  install?: SkillInstallOption[];
}

export interface SkillStatusReport {
  workspaceDir?: string;
  managedSkillsDir?: string;
  skills: SkillStatusEntry[];
}
