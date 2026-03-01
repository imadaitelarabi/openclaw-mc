/**
 * GitHub Extension Entry Point
 */

import type { Extension, ExtensionHooks, ExtensionManifest } from "@/types/extension";
import manifest from "./manifest.json";
import { initialize, cleanup, isSetupComplete, checkConnectionStatus } from "./setup";
import { getStatusBarData } from "./ui/status-bar";
import { getChatInputOptions } from "./ui/chat-input";
import { OnboardingPanel } from "./ui/onboarding";
import { IssuesPanel } from "./ui/panels/issues";
import { PullRequestsPanel } from "./ui/panels/pull-requests";
import { AssignCopilotModal } from "./ui/modals/assign-copilot";
import { GitHubAPI } from "./api";
import { setApiInstance } from "./api-instance";
import { parseGitHubUrl } from "./url";
import { chatLinkMatcherRegistry } from "@/lib/chat-link-matcher-registry";
import { defaultConfig } from "./config";

// API instance (initialized on setup)
let apiInstance: GitHubAPI | null = null;

/**
 * Extension setup function
 */
async function setup(): Promise<void> {
  console.log("[GitHub] Setting up extension...");

  apiInstance = await initialize();
  setApiInstance(apiInstance);

  if (!apiInstance) {
    throw new Error("Failed to initialize GitHub extension");
  }

  // Register the GitHub URL matcher so chat links open in-app panels.
  chatLinkMatcherRegistry.register({
    id: "github",
    match(url) {
      const info = parseGitHubUrl(url);
      if (!info) return null;
      return {
        panelType: info.type === "issue" ? "github-issue-details" : "github-pr-details",
        panelData: {
          owner: info.owner,
          repo: info.repo,
          number: info.number,
          htmlUrl: info.htmlUrl,
        },
      };
    },
  });
}

/**
 * Extension cleanup function
 */
async function cleanupExtension(): Promise<void> {
  console.log("[GitHub] Cleaning up extension...");

  // Remove the GitHub URL matcher when the extension is disabled.
  chatLinkMatcherRegistry.unregister("github");

  await cleanup();
  apiInstance = null;
  setApiInstance(null);
}

/**
 * Extension hooks implementation
 */
const hooks: ExtensionHooks = {
  // Status bar hook - show PR count, refreshed at the configured cadence (~5 min)
  statusBar: async () => {
    if (!apiInstance) {
      return null;
    }
    const item = await getStatusBarData(apiInstance);
    return { item, refreshIntervalMs: defaultConfig.refreshInterval };
  },

  // Chat input hook - provide PR/issue tagging
  chatInput: async (query: string) => {
    if (!apiInstance) {
      return [];
    }
    return getChatInputOptions(apiInstance, query);
  },

  // Onboarding hook - setup wizard
  onboarding: {
    isRequired: async () => !(await isSetupComplete()),
    checkStatus: checkConnectionStatus,
    component: OnboardingPanel,
  },

  // Panel hook - Issues and Pull Requests panels
  panel: {
    issues: IssuesPanel,
    "pull-requests": PullRequestsPanel,
  },

  // Modal hook - Extension-owned modals callable from panel code
  modal: {
    "assign-copilot": AssignCopilotModal,
  },
};

/**
 * GitHub Extension instance
 */
export const githubExtension: Extension = {
  manifest: manifest as ExtensionManifest,
  state: {
    name: manifest.name,
    enabled: false,
    onboarded: false,
    lastUpdated: Date.now(),
  },
  hooks,
  setup,
  cleanup: cleanupExtension,
};

// Default export
export default githubExtension;
