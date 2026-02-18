export type PanelType = 'chat' | 'create-agent' | 'update-agent' | 'agent-list' | 'extension-onboarding' | 'cron' | 'create-cron' | 'update-cron';

export interface PanelSettings {
  showTools: boolean;      // Verbose mode: show/hide tool calls
  showReasoning: boolean;  // Show/hide reasoning blocks
}

export interface Panel {
  id: string;                  // Unique panel ID (UUID)
  type: PanelType;
  title: string;
  agentId?: string;            // For chat/update-agent panels
  data?: Record<string, any>;  // Panel-specific data
  isActive: boolean;           // Currently focused panel
  settings?: PanelSettings;    // Per-panel settings
}

export interface PanelLayout {
  panels: Panel[];
  maxPanels: number;           // Initially 2
  activePanel: string | null;  // Active panel ID
}
