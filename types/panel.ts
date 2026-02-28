export type PanelType =
  | "chat"
  | "create-agent"
  | "update-agent"
  | "agent-file"
  | "agent-list"
  | "extension-onboarding"
  | "extension-panel"
  | "cron"
  | "create-cron"
  | "update-cron"
  | "notes"
  | "skills"
  | "tags-settings"
  | "github-pr-details"
  | "github-issue-details"
  | "github-pr-review-comments";

/** Describes where to navigate back to when a detail panel is closed. */
export interface PanelBackNavigation {
  type: PanelType;
  data?: Record<string, any>;
}

export interface PanelSettings {
  showTools: boolean; // Verbose mode: show/hide tool calls
  showReasoning: boolean; // Show/hide reasoning blocks
}

export interface Panel {
  id: string; // Unique panel ID (UUID)
  type: PanelType;
  title: string;
  agentId?: string; // For chat/update-agent panels
  data?: Record<string, any>; // Panel-specific data
  isActive: boolean; // Currently focused panel
  settings?: PanelSettings; // Per-panel settings
  // Per-panel session settings (for chat panels)
  sessionKey?: string; // Session key for this panel (e.g., "agent:xyz:main")
  model?: string; // Model ID for this panel
  modelProvider?: string; // Model provider for this panel
  thinking?: "off" | "low" | "medium" | "high"; // Thinking level for this panel
}

export interface PanelLayout {
  panels: Panel[];
  maxPanels: number; // Initially 2
  activePanel: string | null; // Active panel ID
}
