export type PanelType = 'chat' | 'create-agent' | 'update-agent' | 'agent-list';

export interface Panel {
  id: string;                  // Unique panel ID (UUID)
  type: PanelType;
  title: string;
  agentId?: string;            // For chat/update-agent panels
  data?: Record<string, any>;  // Panel-specific data
  isActive: boolean;           // Currently focused panel
}

export interface PanelLayout {
  panels: Panel[];
  maxPanels: number;           // Initially 2
  activePanel: string | null;  // Active panel ID
}
