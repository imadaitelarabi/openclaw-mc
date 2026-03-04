# Feature Highlights (March 3, 2026)

## GitHub Extension Enhancements
- **GitHub Asset Proxy:** Implemented a secure proxy for fetching GitHub assets (images, attachments) using server-side token management. This protects personal access tokens by keeping them off the client side while enabling authenticated asset retrieval.
- **Rich Comment Support:** Users can now view and attach images in comments within the GitHub issue and PR details panels, supporting a more visual and expressive communication workflow.
- **Workflow Reruns:** Added direct support for rerunning GitHub Actions workflow runs from the PR details panel, streamlining the iteration loop between development and CI.

## VSCode Integration
- **Enhanced Path & Folder Management:** Improved the "Open in VSCode" service with better folder selection and local path management for repository clones, particularly useful in multi-project or remote development setups.

## UI Polish & Documentation
- **Readability Enhancements:** Improved code formatting and visual presentation in the issue and PR detail panels for better readability and a more native GitHub feel.
- **Daily Documentation Sync:** Updated the changelog and supporting documentation to match the latest platform capabilities.

---

# Feature Highlights (March 2, 2026)

## GitHub Extension Enhancements
- **Advanced PR & Issue Details:** New features in the details panels include branch display, workflow check status, and support for reactions. Timeline events now track renames, "ready for review" status, and user mentions.
- **Internal Navigation:** GitHub links for cross-referenced issues and PRs now navigate directly within the Mission Control panels instead of opening external browser tabs.
- **Smart Polling & Customizable Intervals:** Introduced per-extension polling settings. Users can now toggle background polling on/off and customize refresh intervals directly from the extension settings. Smart polling also includes a searchable repository dropdown for faster navigation.
- **Onboarding & Connection Improvements:** Enhanced the GitHub onboarding flow with support for updating personal access tokens and clearer connection status messaging.

## VSCode Integration
- **Open in VSCode:** Added a new action to the PR details panel that allows users to open the PR's branch directly in VSCode. This is backed by a new server-side service that handles remote environment detection and local clone management.

## Core UI & Performance
- **Enhanced Action Bar:** The `ExtensionActionBar` now supports split-button patterns (primary action + dropdown) and icon-based buttons for a cleaner, more intuitive interface.
- **Visibility-Aware Polling:** Optimized background updates by implementing visibility-aware polling, ensuring extensions only refresh when active or visible in the UI.

## Windows Support
- **Robust Service Setup:** Improved the Windows installation process with automated `nssm` (Non-Sucking Service Manager) checks and enhanced error handling for the `oclawmc` PowerShell service manager.

---

# Feature Highlights (March 1, 2026)

## Enhanced GitHub Issue & PR Details UX
- **Searchable Assignees & Reviewers:** Both Issue and PR detail panels now feature searchable dropdowns for managing assignees and reviewers.
- **Unified Timeline & Activity:** A new unified timeline view integrates comments, commits, and PR review summaries into a single cohesive feed.
- **Avatars & UI Polish:** Improved visual feedback with user avatars, status badges, and an updated "Extension Action Bar" for common tasks like refreshing, opening in GitHub, or marking PRs as ready for review.
- **Draft PR Support:** Added merge guards and "Ready for review" actions specifically for draft pull requests.

## Dedicated PR Review Comments Panel
- **Threaded Conversations:** A specialized panel for viewing and replying to PR review comments with GitHub-like threading.
- **Inline Actions:** Support for reactions and direct replies within the review threads.
- **Diff Highlighting:** Built-in diff coloring for code snippets within review comments.

## New `oclawmc` CLI & Interactive Installer
- **One-Liner Installation:** Added a new interactive one-liner installer for both Bash and PowerShell.
- **OCLawMC CLI:** A dedicated `oclawmc` command-line tool (available for Linux/macOS and Windows) to manage the OpenClaw Mission Control environment, handling installation, service setup, and common operations.
- **Administrator/Policy Checks:** Improved installer robustness with automatic administrator checks for Windows service setup and execution-policy handling.

## UX Improvements & Bug Fixes
- **Notes Tag Filters:** Added ability to filter notes by tags in the UI.
- **Async Selection Fixes:** Resolved issues where mention dropdowns would reset during asynchronous reloads.
- **Timeline Auto-Refresh:** Fixed a bug where PR timelines wouldn't refresh correctly after merge or close actions.
- **Error Handling:** Enhanced error logging and handling for npm commands and process output across the application.

---

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
