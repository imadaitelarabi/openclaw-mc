# GitHub Extension

GitHub integration for OpenClaw MC - quick access to pull requests and issues.

## Features

### Status Bar Integration

- Shows count of open PRs across your organizations/repositories
- Click to browse nested Organization → Repository → PRs
- Copy PR URL or open in browser

### Chat Input Tagging

- Type `@PR` to search and tag pull requests
- Type `@issue` to search and tag issues
- Type `@` to see grouped PR and issue options
- Inserted tags include full GitHub URL

### Quick Actions

- **Copy**: Copy PR/issue URL to clipboard
- **Open**: Open PR/issue in browser

### Write Actions

- **Pull Requests**:
  - Merge PR (choose merge, squash, or rebase strategy)
  - Close PR
  - Add comments

- **Issues**:
  - Close issue
  - Assign to user (including Copilot)
  - Remove assignees
  - Add comments

## Setup

1. **Enable the extension** in OpenClaw MC
2. **Create a GitHub Personal Access Token**:
   - Go to [GitHub Settings → Tokens](https://github.com/settings/tokens/new)
   - Add description: "OpenClaw MC"
   - Select scope: `repo` (Full control of private repositories)
   - Generate token
3. **Configure the extension**:
   - Enter your GitHub token
   - Click "Validate & Save"

## Requirements

- GitHub Personal Access Token with `repo` scope
- Access to organizations/repositories you want to monitor

## Usage Examples

### Status Bar

The status bar shows:

```
[GitHub icon] 5
```

Click to see dropdown:

```
org-name
  repo-a
    #123: Fix authentication bug
      by @username
  repo-b
    #122: Add new feature
      by @contributor
```

### Chat Tagging

In chat input:

```
Check out @PR-123 for the authentication fix
Check out @PR-org/repo#123 for the authentication fix
```

Search for PRs:

```
@PR authentication    → Shows PRs matching "authentication"
```

Search for issues:

```
@issue bug           → Shows issues matching "bug"
```

Browse all:

```
@                    → Shows grouped list of recent PRs and issues
@                    → Shows nested organization/repository PR+issue options
```

## Configuration

Stored in IndexedDB:

- Refresh interval (default: 5 minutes)
- Max results per repository (default: 5)
- Max organizations and repositories per org

Encrypted in localStorage:

- GitHub Personal Access Token

## Permissions

- `github:read` - Read access to GitHub API
- `github:write` - Write access for merge, close, comment, and assign operations

> **Note**: The existing `repo` token scope already includes write permissions. No changes to your token are needed.

## API Rate Limits

GitHub API has rate limits:

- Authenticated: 5,000 requests/hour
- Search API: 30 requests/minute

The extension caches results and debounces requests to stay within limits.

## Security

- Token is encrypted using Web Crypto API
- Token never leaves your browser
- Write operations require the existing `repo` scope (no additional permissions needed)

## Troubleshooting

### "Failed to validate token"

- Check token is valid and not expired
- Ensure token has `repo` scope
- Try regenerating the token

### "Failed to access repository"

- Ensure token has access to organizations and repositories
- For private org resources, include `read:org` + `repo` scopes

### No PRs/issues showing

- Check your organizations/repositories actually have open PRs/issues
- Verify internet connection
- Check browser console for errors

## Development

To customize this extension:

1. Modify `api.ts` to add more API methods
2. Update `ui/status-bar.tsx` to change status bar display
3. Update `ui/chat-input.tsx` to change tag options
4. Adjust `config.ts` for more settings

See the [Extension Template](../_template/README.md) for more details.
