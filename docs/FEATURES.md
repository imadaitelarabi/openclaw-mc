# Feature Highlights (February 22, 2026)

## GitHub extension: issue & PR detail panels

- The GitHub extension now ships with dedicated **issue** and **pull-request detail panels**. They show the title, status badge, author, assignees, labels, timestamps, and the markdown body with an expandable/scrollable preview. Each panel also loads the latest conversation and review comments (with a "Load more" control), and offers a direct link to open the resource in GitHub.
- These panels can surface from the status bar dropdown (Open Panel entries) or anywhere in the app that wants an in-app view of a specific GitHub URL.
- The extension now exposes a richer `GitHubAPI` client that centralizes all of the REST calls behind the new panels (repo listing, issue/PR details, issue comments, review comments, and search helpers).

## Intercepting GitHub links in chat

- Chat messages no longer just open GitHub issue/PR links in a browser tab. A new `chatLinkMatcherRegistry` lets extensions register URL matchers so clicks can open in-app panels instead. The GitHub extension registers a matcher that parses `https://github.com/{owner}/{repo}/issues/{#}` and `/pull/{#}` URLs and routes them to the new detail panels.
- The registry is extension-agnostic and can host multiple matchers (ordered by priority), enabling future integrations to intercept links as well.

## Installer script: detect & update existing clones

- The `scripts/install-and-run.sh` helper now scans common install directories, avoids re-cloning when a valid checkout already exists, and updates it in place instead. It also warns when the existing installation lives outside the default directory and reuses that path.
- The script still installs or upgrades prerequisites (git/curl, Node.js) but now reuses the existing repo state whenever possible, simplifying repeat runs on a machine that already has OpenClaw MC installed.

## GitHub extension: write actions in detail panels

- The GitHub extension's issue and PR detail panels now support write actions, allowing users to comment, edit, or perform actions directly from the panels without leaving the app.

## GitHub API caching mechanism

- Added caching for GitHub API requests to improve performance and reduce rate limiting issues. The cache stores responses for a configurable duration, speeding up repeated requests for the same data.
