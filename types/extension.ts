/**
 * Extension System Types
 *
 * Core type definitions for the modular extensions system.
 * Extensions are read-only plugins that provide data to OpenClaw MC.
 */

/**
 * Extension manifest schema
 */
export interface ExtensionManifest {
  /** Unique extension identifier (e.g., "github", "dockploy") */
  name: string;

  /** Semantic version */
  version: string;

  /** Human-readable description */
  description: string;

  /** Required permissions (read-only scope) */
  permissions: string[];

  /** Enabled hooks */
  hooks: ExtensionHook[];

  /** Chat input taggers configuration */
  taggers?: TaggerConfig[];

  /** Status bar configuration */
  statusBar?: StatusBarConfig;
}

/**
 * Available extension hooks
 */
export type ExtensionHook = "status-bar" | "chat-input" | "onboarding";

/**
 * Tagger configuration for chat input
 */
export interface TaggerConfig {
  /** Tag prefix (e.g., "PR", "issue") */
  prefix: string;

  /** Human-readable description */
  description: string;

  /** Fields returned when item is selected */
  returnFields: ("tag" | "value")[];
}

/**
 * Status bar configuration
 */
export interface StatusBarConfig {
  /** Icon identifier (lucide-react icon name) */
  icon: string;

  /** Available actions for dropdown items */
  actions: ("copy" | "open")[];
}

/**
 * Extension state
 */
export interface ExtensionState {
  /** Extension identifier */
  name: string;

  /** Whether extension is enabled */
  enabled: boolean;

  /** Whether onboarding is complete */
  onboarded: boolean;

  /** Last error message, if any */
  error?: string;

  /** Timestamp of last update */
  lastUpdated: number;
}

/**
 * Extension configuration interface
 */
export interface ExtensionConfig {
  /** Extension-specific settings */
  [key: string]: any;
}

/**
 * Status bar item data structure
 */
export interface StatusBarItem {
  /** Display label */
  label: string;

  /** Optional value to display */
  value?: string | number;

  /** Icon to display (lucide-react icon name) */
  icon?: string;

  /** Nested items for dropdown */
  items?: StatusBarDropdownItem[];
}

/**
 * Status bar dropdown item
 */
export interface StatusBarDropdownItem {
  /** Item identifier */
  id: string;

  /** Display text */
  text: string;

  /** Optional secondary text */
  subtext?: string;

  /** Value for copy action */
  copyValue?: string;

  /** URL for open action */
  openUrl?: string;

  /** Nested dropdown items */
  children?: StatusBarDropdownItem[];
}

/**
 * Chat input tag option
 */
export interface ChatInputTagOption {
  /** Option identifier */
  id: string;

  /** Display text in dropdown */
  label: string;

  /** Tag to insert in input (e.g., "PR-123") */
  tag: string;

  /** Full value/reference (e.g., URL) */
  value: string;

  /** Optional description */
  description?: string;

  /** Optional metadata for custom selection behavior */
  meta?: {
    kind?: string;
    [key: string]: unknown;
  };

  /** Source metadata for aggregated global search results */
  source?: {
    /** Extension or provider name (e.g., "GitHub", "Notes") */
    name: string;
    /** Sub-level label (e.g., "Issues", "Pull Requests") */
    subLevel?: string;
    /** Icon identifier (lucide-react icon name) */
    icon?: string;
  };

  /** Nested options */
  children?: ChatInputTagOption[];
}

/**
 * Extension hook implementations
 */
export interface ExtensionHooks {
  /** Status bar hook - provides status bar data */
  statusBar?: () => Promise<StatusBarItem | null>;

  /** Chat input hook - provides tag options based on query */
  chatInput?: (query: string) => Promise<ChatInputTagOption[]>;

  /** Onboarding hook - checks if setup is complete */
  onboarding?: {
    /** Check if onboarding is needed */
    isRequired: () => Promise<boolean>;

    /** Check connection status (optional) */
    checkStatus?: () => Promise<ExtensionConnectionStatus>;

    /** React component for onboarding UI */
    component: React.ComponentType<OnboardingProps>;
  };
}

/**
 * Extension connection status
 */
export interface ExtensionConnectionStatus {
  /** Whether the extension is connected */
  isConnected: boolean;

  /** Username or identifier if connected */
  username?: string;

  /** Error message if connection failed */
  error?: string;
}

/**
 * Onboarding component props
 */
export interface OnboardingProps {
  /** Extension name */
  extensionName: string;

  /** Callback when onboarding is complete */
  onComplete: () => void;

  /** Callback to cancel onboarding */
  onCancel: () => void;

  /** Current connection status (if available) */
  connectionStatus?: ExtensionConnectionStatus;
}

/**
 * Extension instance
 */
export interface Extension {
  /** Extension manifest */
  manifest: ExtensionManifest;

  /** Extension state */
  state: ExtensionState;

  /** Extension hooks implementation */
  hooks: ExtensionHooks;

  /** Setup function - called when extension is enabled */
  setup?: () => Promise<void>;

  /** Cleanup function - called when extension is disabled */
  cleanup?: () => Promise<void>;
}

/**
 * Extension registry entry
 */
export interface ExtensionRegistryEntry {
  /** Extension instance */
  extension: Extension;

  /** Whether extension is currently loaded */
  loaded: boolean;

  /** Load timestamp */
  loadedAt?: number;
}
