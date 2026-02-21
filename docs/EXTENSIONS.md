# Extensions System Developer Guide

## Overview

OpenClaw MC's extensions system enables modular, read-only integrations with external services. Extensions can provide:

- **Status Bar Items**: Display real-time data with dropdown actions
- **Chat Input Tagging**: Enable @ mentions for external resources
- **Onboarding Panels**: Configure extension settings

## Core Principles

### 1. Modularity
Extensions are self-contained packages with no tight coupling to OpenClaw MC's core.

### 2. No Side Effects
Extensions only provide data and output. They cannot:
- Trigger actions or mutations
- Write to external systems
- Modify OpenClaw MC state directly

### 3. Read-Only Focus
Fetch and display information. Let users or agents decide next steps.

### 4. Security First
- Encrypted credential storage
- Permission declarations
- Input sanitization
- Read-only API access

### 5. UX Excellence
- Seamless onboarding
- Intuitive interactions
- Fast, responsive UI
- Helpful error messages

## Extension Lifecycle

```
1. Discovery/Install → User enables via UI
2. Onboarding → Configure credentials/settings
3. Activation → Register hooks, provide data
4. Usage → Respond to user interactions
5. Uninstall → Clean up state/config
```

## Architecture

### Extension Registry
Central registry managing all extensions:
- **Location**: `lib/extension-registry.ts`
- **Responsibilities**:
  - Extension registration
  - Lifecycle management (load/unload)
  - State persistence
  - Hook access

### Extension Context
React Context for extension state:
- **Location**: `contexts/ExtensionContext.tsx`
- **Provides**:
  - List of enabled extensions
  - Enable/disable functions
  - Onboarding status
  - Hook access methods

### Secure Storage
Encrypted storage for sensitive data:
- **Location**: `lib/secure-storage.ts`
- **Uses**: Web Crypto API (AES-GCM)
- **Storage**: localStorage with encryption
- **Methods**: `setItem()`, `getItem()`, `removeItem()`

### State Persistence
IndexedDB for extension state:
- **Location**: `lib/ui-state-db.ts`
- **Stores**:
  - Extension states (enabled, onboarded)
  - Extension configs (non-sensitive)
- **Version**: DB v4 (extension stores)

## Creating an Extension

### 1. Directory Structure

```
extensions/{name}/
├── manifest.json          # Metadata, permissions, hooks
├── config.ts              # TypeScript config interface
├── api.ts                 # Read-only API client
├── setup.ts               # Onboarding logic
├── ui/
│   ├── status-bar.tsx     # Status bar component
│   ├── chat-input.tsx     # Chat input component
│   └── onboarding.tsx     # Onboarding panel
├── index.ts               # Main entry point
└── README.md              # Documentation
```

### 2. Start from Template

```bash
cp -r extensions/_template extensions/my-extension
cd extensions/my-extension
```

### 3. Update Manifest

```json
{
  "name": "my-extension",
  "version": "1.0.0",
  "description": "Brief description",
  "permissions": ["service:read"],
  "hooks": ["status-bar", "chat-input", "onboarding"],
  "taggers": [
    {
      "prefix": "TAG",
      "description": "Tag description",
      "returnFields": ["tag", "value"]
    }
  ],
  "statusBar": {
    "icon": "Box",
    "actions": ["copy", "open"]
  }
}
```

### 4. Implement Configuration

```typescript
// config.ts
export interface MyExtensionConfig {
  apiToken?: string;
  apiUrl?: string;
  refreshInterval?: number;
}

export const defaultConfig: MyExtensionConfig = {
  apiUrl: 'https://api.example.com',
  refreshInterval: 60000,
};
```

### 5. Implement API Client

```typescript
// api.ts
export class MyAPI {
  private config: MyExtensionConfig;
  
  constructor(config: MyExtensionConfig) {
    this.config = config;
  }
  
  async testConnection(): Promise<boolean> {
    // Test API connectivity
    return true;
  }
  
  async fetchData(): Promise<any> {
    // Fetch data from API
    return [];
  }
}
```

### 6. Implement Setup Logic

```typescript
// setup.ts
import { SecureStorage } from '@/lib/secure-storage';
import { uiStateStore } from '@/lib/ui-state-db';

export async function isSetupComplete(): Promise<boolean> {
  const config = await uiStateStore.getExtensionConfig('my-extension');
  const token = await SecureStorage.getItem('my-extension', 'apiToken');
  return !!(config && token);
}

export async function saveConfig(config: MyExtensionConfig, token: string) {
  await uiStateStore.saveExtensionConfig('my-extension', config);
  await SecureStorage.setItem('my-extension', 'apiToken', token);
}
```

### 7. Implement UI Components

#### Status Bar
```typescript
// ui/status-bar.tsx
export async function getStatusBarData(api: MyAPI): Promise<StatusBarItem | null> {
  const data = await api.fetchData();
  
  return {
    label: 'My Extension',
    value: data.count,
    icon: 'Box',
    items: data.items.map(item => ({
      id: item.id,
      text: item.title,
      copyValue: item.url,
      openUrl: item.url,
    })),
  };
}
```

#### Chat Input
```typescript
// ui/chat-input.tsx
export async function getChatInputOptions(
  api: MyAPI,
  query: string
): Promise<ChatInputTagOption[]> {
  const items = await api.search(query);
  
  return items.map(item => ({
    id: item.id,
    label: item.title,
    tag: `@TAG-${item.id}`,
    value: item.url,
    description: item.description,
  }));
}
```

#### Onboarding
```tsx
// ui/onboarding.tsx
export function OnboardingPanel({ onComplete, onCancel }: OnboardingProps) {
  const [token, setToken] = useState('');
  
  const handleSave = async () => {
    // Validate and save
    await saveConfig({ apiUrl: '...' }, token);
    onComplete();
  };
  
  return (
    <div>
      <input value={token} onChange={e => setToken(e.target.value)} />
      <button onClick={handleSave}>Save</button>
    </div>
  );
}
```

### 8. Wire Up Extension

```typescript
// index.ts
import type { Extension } from '@/types/extension';
import manifest from './manifest.json';

let apiInstance: MyAPI | null = null;

const hooks = {
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

export const myExtension: Extension = {
  manifest,
  state: {
    name: manifest.name,
    enabled: false,
    onboarded: false,
    lastUpdated: Date.now(),
  },
  hooks,
  setup: async () => {
    apiInstance = await initialize();
  },
  cleanup: async () => {
    apiInstance = null;
  },
};

export default myExtension;
```

### 9. Register Extension

In your app initialization:

```typescript
// app/page.tsx or similar
import { extensionRegistry } from '@/lib/extension-registry';
import myExtension from '@/extensions/my-extension';

// Initialize registry
await extensionRegistry.initialize();

// Register extension
await extensionRegistry.register(myExtension);
```

## Available Hooks

### Status Bar Hook

**Purpose**: Display real-time data in the status bar

**Interface**:
```typescript
statusBar?: () => Promise<StatusBarItem | null>
```

**Returns**:
```typescript
{
  label: string;          // Display label
  value?: string | number; // Badge value (e.g., count)
  icon?: string;          // Lucide icon name
  items?: StatusBarDropdownItem[]; // Dropdown items
}
```

**Dropdown Item**:
```typescript
{
  id: string;
  text: string;           // Primary text
  subtext?: string;       // Secondary text
  copyValue?: string;     // Value to copy
  openUrl?: string;       // URL to open
  children?: StatusBarDropdownItem[]; // Nested items
}
```

**Example**:
```typescript
statusBar: async () => ({
  label: 'GitHub',
  value: 5,
  icon: 'Github',
  items: [
    {
      id: 'pr-123',
      text: 'PR #123: Fix bug',
      subtext: 'by @user',
      copyValue: 'https://github.com/...',
      openUrl: 'https://github.com/...',
    }
  ]
})
```

### Chat Input Hook

**Purpose**: Provide @ tagging options in chat

**Interface**:
```typescript
chatInput?: (query: string) => Promise<ChatInputTagOption[]>
```

**Parameters**:
- `query`: Search string (without @ prefix)

**Returns**:
```typescript
{
  id: string;
  label: string;          // Display text in dropdown
  tag: string;            // Tag to insert (e.g., "@PR-123")
  value: string;          // Full reference (e.g., URL)
  description?: string;   // Optional description
  children?: ChatInputTagOption[]; // Nested options
}
```

**Example**:
```typescript
chatInput: async (query) => {
  const prs = await api.searchPRs(query);
  return prs.map(pr => ({
    id: pr.id,
    label: `PR #${pr.number}`,
    tag: `@PR-${pr.number}`,
    value: pr.url,
    description: pr.title,
  }));
}
```

### Onboarding Hook

**Purpose**: Setup wizard for first-time configuration

**Interface**:
```typescript
onboarding?: {
  isRequired: () => Promise<boolean>;
  component: React.ComponentType<OnboardingProps>;
}
```

**Component Props**:
```typescript
{
  extensionName: string;
  onComplete: () => void;
  onCancel: () => void;
}
```

**Example**:
```tsx
onboarding: {
  isRequired: async () => {
    const hasToken = await SecureStorage.hasItem('ext', 'token');
    return !hasToken;
  },
  component: OnboardingPanel,
}
```

## Security Guidelines

### Token Storage
✅ **DO**: Use `SecureStorage` for tokens
```typescript
await SecureStorage.setItem('my-ext', 'apiToken', token);
```

❌ **DON'T**: Store tokens in plain text
```typescript
localStorage.setItem('apiToken', token); // WRONG
```

### API Calls
✅ **DO**: Read-only operations
```typescript
async getPullRequests() {
  return this.request('/pulls'); // GET request
}
```

❌ **DON'T**: Write operations
```typescript
async closePullRequest(id) {
  return this.request('/pulls/' + id, { method: 'DELETE' }); // WRONG
}
```

### Input Validation
✅ **DO**: Validate all inputs
```typescript
if (!token.trim() || token.length < 10) {
  throw new Error('Invalid token');
}
```

❌ **DON'T**: Trust user input
```typescript
await saveConfig({ token }); // WRONG - no validation
```

### Error Handling
✅ **DO**: Catch and log errors
```typescript
try {
  const data = await api.fetch();
} catch (error) {
  console.error('[Extension] Fetch failed:', error);
  return null; // Graceful fallback
}
```

❌ **DON'T**: Let errors crash the app
```typescript
const data = await api.fetch(); // WRONG - unhandled error
```

## Performance Guidelines

### Caching
✅ **DO**: Cache frequently accessed data
```typescript
private cache: Map<string, any> = new Map();

async fetchData() {
  if (this.cache.has('data')) {
    return this.cache.get('data');
  }
  
  const data = await this.request('/data');
  this.cache.set('data', data);
  return data;
}
```

### Debouncing
✅ **DO**: Debounce search queries
```typescript
import { debounce } from '@/lib/utils';

const debouncedSearch = debounce(async (query) => {
  return await api.search(query);
}, 300);
```

### Rate Limiting
✅ **DO**: Respect API rate limits
```typescript
private lastRequest = 0;
private minInterval = 1000; // 1 request per second

async request(endpoint: string) {
  const now = Date.now();
  const elapsed = now - this.lastRequest;
  
  if (elapsed < this.minInterval) {
    await new Promise(r => setTimeout(r, this.minInterval - elapsed));
  }
  
  this.lastRequest = Date.now();
  return fetch(endpoint);
}
```

## Testing Extensions

### 1. Manual Testing

```typescript
// Test connection
const api = new MyAPI({ token: 'test-token' });
const connected = await api.testConnection();
console.log('Connected:', connected);

// Test data fetching
const data = await api.fetchData();
console.log('Data:', data);

// Test status bar
const statusItem = await getStatusBarData(api);
console.log('Status item:', statusItem);
```

### 2. Integration Testing

1. Register extension
2. Enable in UI
3. Complete onboarding
4. Verify status bar item appears
5. Test @ tagging in chat
6. Test copy/open actions

### 3. Error Scenarios

Test these cases:
- Invalid API token
- Network failures
- Rate limit exceeded
- Empty responses
- Malformed data

## Troubleshooting

### Extension Not Loading
- Check manifest.json syntax
- Verify all required files exist
- Check browser console for errors
- Ensure extension is registered

### Status Bar Not Updating
- Check if hook returns valid data
- Verify API calls succeed
- Check for JavaScript errors
- Ensure extension is enabled

### Onboarding Fails
- Validate API credentials
- Check network connectivity
- Verify API endpoint URLs
- Check for CORS issues

### Tags Not Appearing
- Verify chatInput hook is implemented
- Check query parameter is passed
- Ensure API search returns results
- Check for debouncing issues

## Best Practices

### Code Organization
- Keep files focused and single-purpose
- Use TypeScript for type safety
- Follow existing code patterns
- Add JSDoc comments

### Error Messages
- Be specific about what failed
- Provide actionable solutions
- Don't expose sensitive data
- Use user-friendly language

### Documentation
- Document all public functions
- Add usage examples
- Explain configuration options
- Include troubleshooting tips

### Versioning
- Follow semantic versioning
- Document breaking changes
- Maintain backwards compatibility
- Test upgrades thoroughly

## Examples

See these example extensions:
- [`extensions/github`](../extensions/github) - GitHub PR/issue integration
- [`extensions/_template`](../extensions/_template) - Template with examples

## Resources

- [Extension Types](../types/extension.ts)
- [Extension Registry](../lib/extension-registry.ts)
- [Secure Storage](../lib/secure-storage.ts)
- [UI State DB](../lib/ui-state-db.ts)
- [Extension Context](../contexts/ExtensionContext.tsx)

## Support

For questions or issues:
1. Check this documentation
2. Review example extensions
3. Check GitHub issues
4. Ask in Discord community
