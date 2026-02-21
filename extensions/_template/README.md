# Extension Template

This is a template for creating OpenClaw MC extensions.

## Structure

```
extension-name/
├── manifest.json          # Extension metadata and configuration
├── config.ts              # TypeScript configuration interface
├── api.ts                 # Read-only API client
├── setup.ts               # Onboarding logic and initialization
├── ui/
│   ├── status-bar.tsx     # Status bar component
│   ├── chat-input.tsx     # Chat input tagging component
│   └── onboarding.tsx     # Onboarding panel
├── index.ts               # Main entry point
└── README.md              # Documentation
```

## Creating a New Extension

1. **Copy this template directory** to a new folder with your extension name:
   ```bash
   cp -r extensions/_template extensions/my-extension
   ```

2. **Update `manifest.json`**:
   - Change `name` to your extension identifier (e.g., "github", "dockploy")
   - Update `description`
   - Set appropriate `permissions` (read-only scope)
   - Configure `hooks` you'll implement
   - Define `taggers` for chat input
   - Configure `statusBar` icon and actions

3. **Implement `config.ts`**:
   - Define your extension's configuration interface
   - Add fields for API credentials, preferences, etc.
   - Set default values

4. **Implement `api.ts`**:
   - Create API client for external service
   - Implement read-only methods
   - Add connection testing
   - Add data fetching methods

5. **Implement `setup.ts`**:
   - Add setup validation logic
   - Implement config save/load
   - Add initialization function
   - Handle cleanup

6. **Implement UI components**:
   - `ui/status-bar.tsx`: Return status bar data
   - `ui/chat-input.tsx`: Provide tag options
   - `ui/onboarding.tsx`: Create setup form

7. **Update `index.ts`**:
   - Import your implementations
   - Wire up hooks
   - Export extension object

8. **Register the extension**:
   In your app initialization code:
   ```typescript
   import { extensionRegistry } from '@/lib/extension-registry';
   import myExtension from '@/extensions/my-extension';
   
   await extensionRegistry.initialize();
   await extensionRegistry.register(myExtension);
   ```

## Extension Rules

### Security
- **No side effects**: Extensions can only READ data, never WRITE
- **Encrypted storage**: Use `SecureStorage` for API tokens
- **Input sanitization**: Validate all user inputs
- **Permission declarations**: Declare all required permissions

### Performance
- **Debounce fetches**: Don't overwhelm APIs
- **Cache results**: Store frequently accessed data
- **Error handling**: Always catch and log errors
- **Graceful degradation**: Handle API failures gracefully

### UX
- **Clear onboarding**: Make setup easy and intuitive
- **Helpful errors**: Show actionable error messages
- **Fast responses**: Keep UI responsive
- **Loading states**: Show spinners for async operations

## Example: Status Bar Hook

```typescript
// ui/status-bar.tsx
export async function getStatusBarData(api: ExtensionAPI): Promise<StatusBarItem | null> {
  const data = await api.getStatusData();
  
  return {
    label: 'PRs',
    value: data.openPRs.length,
    icon: 'GitPullRequest',
    items: data.openPRs.map(pr => ({
      id: pr.id,
      text: `#${pr.number}: ${pr.title}`,
      subtext: pr.repository,
      copyValue: pr.url,
      openUrl: pr.url,
    })),
  };
}
```

## Example: Chat Input Hook

```typescript
// ui/chat-input.tsx
export async function getChatInputOptions(
  api: ExtensionAPI,
  query: string
): Promise<ChatInputTagOption[]> {
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

## Example: Onboarding

```typescript
// ui/onboarding.tsx
export function OnboardingPanel({ onComplete, onCancel }: OnboardingProps) {
  const [token, setToken] = useState('');
  
  const handleSave = async () => {
    // Validate token
    const api = new ExtensionAPI({ apiToken: token });
    const valid = await api.testConnection();
    
    if (valid) {
      await saveConfig({ enabled: true }, token);
      onComplete();
    }
  };
  
  return (
    <div>
      <input value={token} onChange={e => setToken(e.target.value)} />
      <button onClick={handleSave}>Save</button>
    </div>
  );
}
```

## Testing Your Extension

1. Register the extension in your app
2. Enable it via the UI
3. Complete onboarding
4. Check status bar for your item
5. Try @ tagging in chat input
6. Verify copy and open actions work

## Best Practices

- Keep API calls minimal
- Cache aggressively
- Handle errors gracefully
- Provide clear feedback
- Test with rate limits
- Document all features
- Follow TypeScript types strictly
- Use existing UI patterns

## Resources

- [Main Documentation](../../docs/EXTENSIONS.md)
- [Extension Registry](../../lib/extension-registry.ts)
- [Secure Storage](../../lib/secure-storage.ts)
- [Type Definitions](../../types/extension.ts)
