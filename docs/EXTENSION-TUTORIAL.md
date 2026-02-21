# Extension Development Tutorial

## Building Your First Extension in Under 1 Hour

This tutorial will guide you through creating a simple extension that displays GitHub repository stars in the status bar and enables @ tagging for repositories.

## Prerequisites

- Basic TypeScript/React knowledge
- GitHub Personal Access Token
- OpenClaw MC running locally

## Step 1: Set Up Extension Structure (5 minutes)

1. **Copy the template:**

   ```bash
   cd extensions
   cp -r _template github-stars
   cd github-stars
   ```

2. **Update `manifest.json`:**
   ```json
   {
     "name": "github-stars",
     "version": "1.0.0",
     "description": "Show GitHub repository stars",
     "permissions": ["github:read"],
     "hooks": ["status-bar", "chat-input", "onboarding"],
     "taggers": [
       {
         "prefix": "repo",
         "description": "GitHub repositories",
         "returnFields": ["tag", "value"]
       }
     ],
     "statusBar": {
       "icon": "Star",
       "actions": ["copy", "open"]
     }
   }
   ```

## Step 2: Define Configuration (5 minutes)

**File: `config.ts`**

```typescript
export interface GitHubStarsConfig {
  token?: string;
  username?: string;
  refreshInterval?: number;
}

export const defaultConfig: GitHubStarsConfig = {
  refreshInterval: 300000, // 5 minutes
};
```

## Step 3: Create API Client (15 minutes)

**File: `api.ts`**

```typescript
import type { GitHubStarsConfig } from "./config";

export interface Repository {
  id: number;
  name: string;
  full_name: string;
  stargazers_count: number;
  html_url: string;
  description: string;
}

export class GitHubStarsAPI {
  private config: GitHubStarsConfig;
  private baseURL = "https://api.github.com";

  constructor(config: GitHubStarsConfig) {
    this.config = config;
  }

  private async request<T>(endpoint: string): Promise<T> {
    const { token } = this.config;

    if (!token) {
      throw new Error("GitHub token not configured");
    }

    const response = await fetch(`${this.baseURL}${endpoint}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github.v3+json",
      },
    });

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.statusText}`);
    }

    return response.json();
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.request("/user");
      return true;
    } catch (error) {
      console.error("[GitHubStarsAPI] Connection failed:", error);
      return false;
    }
  }

  async getUserRepos(): Promise<Repository[]> {
    const { username } = this.config;

    if (!username) {
      return [];
    }

    try {
      return await this.request<Repository[]>(`/users/${username}/repos?sort=stars&per_page=10`);
    } catch (error) {
      console.error("[GitHubStarsAPI] Failed to fetch repos:", error);
      return [];
    }
  }

  async searchRepos(query: string): Promise<Repository[]> {
    try {
      const result = await this.request<{ items: Repository[] }>(
        `/search/repositories?q=${encodeURIComponent(query)}&per_page=5`
      );
      return result.items;
    } catch (error) {
      console.error("[GitHubStarsAPI] Search failed:", error);
      return [];
    }
  }

  updateConfig(newConfig: Partial<GitHubStarsConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
}
```

## Step 4: Implement Setup Logic (10 minutes)

**File: `setup.ts`**

```typescript
import { SecureStorage } from "@/lib/secure-storage";
import { uiStateStore } from "@/lib/ui-state-db";
import type { GitHubStarsConfig } from "./config";
import { defaultConfig } from "./config";
import { GitHubStarsAPI } from "./api";

const EXTENSION_NAME = "github-stars";

export async function isSetupComplete(): Promise<boolean> {
  try {
    const config = await uiStateStore.getExtensionConfig(EXTENSION_NAME);
    const token = await SecureStorage.getItem(EXTENSION_NAME, "token");
    return !!(config?.username && token);
  } catch (error) {
    console.error("[Setup] Check failed:", error);
    return false;
  }
}

export async function saveConfig(config: GitHubStarsConfig, token: string): Promise<void> {
  await uiStateStore.saveExtensionConfig(EXTENSION_NAME, config);
  await SecureStorage.setItem(EXTENSION_NAME, "token", token);
}

export async function loadConfig(): Promise<GitHubStarsConfig> {
  const config = await uiStateStore.getExtensionConfig(EXTENSION_NAME);
  return { ...defaultConfig, ...config };
}

export async function getToken(): Promise<string | null> {
  return await SecureStorage.getItem(EXTENSION_NAME, "token");
}

export async function initialize(): Promise<GitHubStarsAPI | null> {
  const config = await loadConfig();
  const token = await getToken();

  if (!token || !config.username) {
    return null;
  }

  const api = new GitHubStarsAPI({ ...config, token });

  if (!(await api.testConnection())) {
    return null;
  }

  return api;
}

export async function cleanup(): Promise<void> {
  console.log("[Setup] Cleaned up");
}
```

## Step 5: Create Status Bar Component (10 minutes)

**File: `ui/status-bar.tsx`**

```typescript
import type { StatusBarItem, StatusBarDropdownItem } from "@/types/extension";
import { GitHubStarsAPI } from "../api";

export async function getStatusBarData(api: GitHubStarsAPI): Promise<StatusBarItem | null> {
  try {
    const repos = await api.getUserRepos();

    const totalStars = repos.reduce((sum, repo) => sum + repo.stargazers_count, 0);

    const items: StatusBarDropdownItem[] = repos.map((repo) => ({
      id: repo.id.toString(),
      text: repo.name,
      subtext: `⭐ ${repo.stargazers_count} stars`,
      copyValue: repo.html_url,
      openUrl: repo.html_url,
    }));

    return {
      label: "GitHub Stars",
      value: totalStars,
      icon: "Star",
      items,
    };
  } catch (error) {
    console.error("[StatusBar] Failed:", error);
    return null;
  }
}
```

## Step 6: Create Chat Input Component (10 minutes)

**File: `ui/chat-input.tsx`**

```typescript
import type { ChatInputTagOption } from "@/types/extension";
import { GitHubStarsAPI } from "../api";

export async function getChatInputOptions(
  api: GitHubStarsAPI,
  query: string
): Promise<ChatInputTagOption[]> {
  try {
    const repos = query ? await api.searchRepos(query) : await api.getUserRepos();

    return repos.map((repo) => ({
      id: repo.id.toString(),
      label: repo.full_name,
      tag: `@repo-${repo.name}`,
      value: repo.html_url,
      description: `⭐ ${repo.stargazers_count} - ${repo.description || "No description"}`,
    }));
  } catch (error) {
    console.error("[ChatInput] Failed:", error);
    return [];
  }
}
```

## Step 7: Create Onboarding Panel (15 minutes)

**File: `ui/onboarding.tsx`**

```tsx
"use client";

import { useState } from "react";
import type { OnboardingProps } from "@/types/extension";
import { saveConfig } from "../setup";
import { GitHubStarsAPI } from "../api";
import type { GitHubStarsConfig } from "../config";

export function OnboardingPanel({ extensionName, onComplete, onCancel }: OnboardingProps) {
  const [token, setToken] = useState("");
  const [username, setUsername] = useState("");
  const [isValidating, setIsValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!token.trim() || !username.trim()) {
      setError("All fields are required");
      return;
    }

    setIsValidating(true);
    setError(null);

    try {
      const api = new GitHubStarsAPI({ token, username });

      if (!(await api.testConnection())) {
        setError("Invalid GitHub token");
        return;
      }

      const config: GitHubStarsConfig = {
        username,
        refreshInterval: 300000,
      };

      await saveConfig(config, token);
      onComplete();
    } catch (err) {
      setError("Configuration failed. Please try again.");
    } finally {
      setIsValidating(false);
    }
  };

  return (
    <div className="p-6 max-w-md mx-auto">
      <h2 className="text-xl font-semibold mb-4">Setup GitHub Stars</h2>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">GitHub Token</label>
          <input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
            className="w-full px-3 py-2 border border-border rounded bg-background text-sm"
          />
          <p className="text-xs text-muted-foreground mt-1">
            <a
              href="https://github.com/settings/tokens/new"
              target="_blank"
              rel="noopener noreferrer"
              className="underline"
            >
              Create a token
            </a>
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">GitHub Username</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="your-username"
            className="w-full px-3 py-2 border border-border rounded bg-background text-sm"
          />
        </div>

        {error && (
          <div className="p-3 bg-destructive/10 text-destructive text-sm rounded">{error}</div>
        )}

        <div className="flex gap-2 justify-end">
          <button
            onClick={onCancel}
            disabled={isValidating}
            className="px-4 py-2 text-sm border border-border rounded hover:bg-accent"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isValidating}
            className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded hover:bg-primary/90"
          >
            {isValidating ? "Validating..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
```

## Step 8: Wire Up Extension (5 minutes)

**File: `index.ts`**

```typescript
import type { Extension, ExtensionHooks } from "@/types/extension";
import manifest from "./manifest.json";
import { initialize, cleanup, isSetupComplete } from "./setup";
import { getStatusBarData } from "./ui/status-bar";
import { getChatInputOptions } from "./ui/chat-input";
import { OnboardingPanel } from "./ui/onboarding";
import { GitHubStarsAPI } from "./api";

let apiInstance: GitHubStarsAPI | null = null;

async function setup(): Promise<void> {
  apiInstance = await initialize();
  if (!apiInstance) {
    throw new Error("Failed to initialize");
  }
}

async function cleanupExtension(): Promise<void> {
  await cleanup();
  apiInstance = null;
}

const hooks: ExtensionHooks = {
  statusBar: async () => {
    if (!apiInstance) return null;
    return getStatusBarData(apiInstance);
  },

  chatInput: async (query: string) => {
    if (!apiInstance) return [];
    return getChatInputOptions(apiInstance, query);
  },

  onboarding: {
    isRequired: isSetupComplete,
    component: OnboardingPanel,
  },
};

export const githubStarsExtension: Extension = {
  manifest,
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

export default githubStarsExtension;
```

## Step 9: Register Extension (5 minutes)

**File: `app/page.tsx` (or wherever you initialize)**

```typescript
import { extensionRegistry } from "@/lib/extension-registry";
import githubStarsExtension from "@/extensions/github-stars";

// In your app initialization
useEffect(() => {
  const initExtensions = async () => {
    await extensionRegistry.initialize();
    await extensionRegistry.register(githubStarsExtension);
  };

  initExtensions();
}, []);
```

## Step 10: Test Your Extension (10 minutes)

1. **Start OpenClaw MC:**

   ```bash
   npm run dev
   ```

2. **Enable the extension:**
   - Look for extension settings in UI
   - Toggle "GitHub Stars" extension

3. **Complete onboarding:**
   - Enter GitHub token
   - Enter username
   - Click "Save"

4. **Verify status bar:**
   - Should show star count
   - Click to see repo dropdown
   - Test copy/open actions

5. **Test chat tagging:**
   - Type `@` in chat input
   - Should see repo suggestions
   - Select a repo
   - Tag should be inserted

## Troubleshooting

### Extension not appearing

- Check manifest.json syntax
- Verify all files are in correct locations
- Check browser console for errors

### Status bar not updating

- Verify API token is valid
- Check network tab for failed requests
- Look for errors in console

### Onboarding fails

- Test API token manually
- Verify username is correct
- Check CORS settings

## Next Steps

### Enhancements to Try

1. **Add caching:**

   ```typescript
   private cache = new Map<string, any>();
   private cacheTimeout = 5 * 60 * 1000; // 5 minutes
   ```

2. **Add error recovery:**

   ```typescript
   async getDataWithRetry(maxRetries = 3) {
     for (let i = 0; i < maxRetries; i++) {
       try {
         return await this.getData();
       } catch (error) {
         if (i === maxRetries - 1) throw error;
         await new Promise(r => setTimeout(r, 1000 * (i + 1)));
       }
     }
   }
   ```

3. **Add rate limiting:**

   ```typescript
   private lastRequest = 0;
   private minInterval = 1000;

   async throttledRequest(endpoint: string) {
     const now = Date.now();
     const wait = this.minInterval - (now - this.lastRequest);
     if (wait > 0) await new Promise(r => setTimeout(r, wait));
     this.lastRequest = Date.now();
     return this.request(endpoint);
   }
   ```

4. **Add loading states:**

   ```typescript
   const [isLoading, setIsLoading] = useState(false);

   // Show spinner while loading
   {isLoading && <Spinner />}
   ```

## Congratulations!

You've built a complete OpenClaw MC extension in under an hour! 🎉

### What You've Learned

- Extension structure and manifest
- TypeScript configuration
- API client implementation
- Setup and initialization
- UI component creation
- Hook integration
- Secure token storage

### Resources

- [Full Extension Guide](./EXTENSIONS.md)
- [Architecture Documentation](./ARCHITECTURE.md)
- [GitHub Extension Example](../extensions/github)
- [Template Extension](../extensions/_template)

### Share Your Extension

Consider sharing your extension:

1. Add comprehensive README
2. Test thoroughly
3. Document setup steps
4. Share in Discord community
5. Create a pull request

Happy coding! 🚀
