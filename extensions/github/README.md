# GitHub Extension

GitHub integration for Mission Control - quick access to pull requests and issues.

## Features

### Status Bar Integration
- Shows count of open PRs in the status bar
- Click to see list of recent PRs
- Copy PR URL or open in browser

### Chat Input Tagging
- Type `@PR` to search and tag pull requests
- Type `@issue` to search and tag issues
- Type `@` to see grouped PR and issue options
- Inserted tags include full GitHub URL

### Quick Actions
- **Copy**: Copy PR/issue URL to clipboard
- **Open**: Open PR/issue in browser

## Setup

1. **Enable the extension** in Mission Control
2. **Create a GitHub Personal Access Token**:
   - Go to [GitHub Settings → Tokens](https://github.com/settings/tokens/new)
   - Add description: "Mission Control"
   - Select scope: `repo` (Full control of private repositories)
   - Generate token
3. **Configure the extension**:
   - Enter your GitHub token
   - Enter repository owner (username or organization)
   - Enter repository name
   - Click "Validate & Save"

## Requirements

- GitHub Personal Access Token with `repo` scope
- Access to the repository you want to monitor

## Usage Examples

### Status Bar
The status bar shows:
```
[GitHub icon] 5
```
Click to see dropdown:
```
#123: Fix authentication bug
  by @username
  [Copy URL] [Open in GitHub]

#122: Add new feature
  by @contributor
  [Copy URL] [Open in GitHub]
```

### Chat Tagging
In chat input:
```
Check out @PR-123 for the authentication fix
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
```

## Configuration

Stored in IndexedDB:
- Repository owner
- Repository name
- Refresh interval (default: 5 minutes)
- Max results (default: 10)

Encrypted in localStorage:
- GitHub Personal Access Token

## Permissions

- `github:read` - Read-only access to GitHub API

## API Rate Limits

GitHub API has rate limits:
- Authenticated: 5,000 requests/hour
- Search API: 30 requests/minute

The extension caches results and debounces requests to stay within limits.

## Security

- Token is encrypted using Web Crypto API
- All API calls are read-only
- No write permissions required
- Token never leaves your browser

## Troubleshooting

### "Failed to validate token"
- Check token is valid and not expired
- Ensure token has `repo` scope
- Try regenerating the token

### "Failed to access repository"
- Verify owner and repo names are correct
- Ensure token has access to the repository
- For private repos, token must have full `repo` scope

### No PRs/issues showing
- Check repository actually has open PRs/issues
- Verify internet connection
- Check browser console for errors

## Development

To customize this extension:

1. Modify `api.ts` to add more API methods
2. Update `ui/status-bar.tsx` to change status bar display
3. Update `ui/chat-input.tsx` to change tag options
4. Adjust `config.ts` for more settings

See the [Extension Template](../_template/README.md) for more details.
