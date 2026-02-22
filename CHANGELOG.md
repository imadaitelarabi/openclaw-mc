# Changelog

## [0.3.0] - 2026-02-22

### Meta

- Bump: minor (score: 124)
- Range: 30dab58afd3628004c5188249358986fc0a767b7..174a5614e2266b7015d4403e5dec7a6e3afb77b4

### Features

- add gateway skills fetch (00331f0)
- add skills filters and persistence (7c84e9c)
- add skills to native # mentions (d232b22)
- support global search for @ extensions and # native mentions (a4a97a6)
- require model selection in cron create/edit panels and send payload.model (38e93cc)
- replace model selection dropdown with ModelSelector component in Create and Update Cron panels (c9fdfcb)

### Fixes

- avoid passing click event to skills refresh (dd7efd7)
- flatten hierarchical extension results to leaves in global search (a33175e)
- filter and sort global search leaf results by relevance score (91c06ef)

### Refactors

- format function parameters for CreateCronPanel and UpdateCronPanel components (2ba5eb2)

### Docs

- linkify PRs and commit SHAs (d29f7d3)

### Chores

- daily changelog 2026-02-21 (4283585)

### Other

- Merge pull request #95 from imadaitelarabi/changelog/daily-2026-02-21 (ec733f7)
- Merge pull request #96 from imadaitelarabi/chore/linkify-changelog (2d28316)
- Initial plan (4e35d3f)
- Rename Mission Control to OpenClaw MC + add keyboard navigation/scrolling in menus (9a0c959)
- Merge pull request #99 from imadaitelarabi/feature/gateway-skills (9d8c656)
- Merge pull request #98 from imadaitelarabi/copilot/rename-mission-control-to-openclaw-mc (51a337f)
- Initial plan (1d84221)
- Merge pull request #103 from imadaitelarabi/copilot/support-global-search-extensions-mentions (e1c9a2b)
- Initial plan (a000ec5)
- README cleanup + tag creation feature in Tags Settings panel (f68e216)
- Merge pull request #105 from imadaitelarabi/copilot/update-readme-and-tag-settings (b90b447)
- Initial plan (68afa99)
- Add oxlint + prettier formatting and CI quality workflow (f270cf8)
- Merge pull request #107 from imadaitelarabi/copilot/add-oxlint-prettier-formatting (572b012)
- Initial plan (221fbb2)
- Merge pull request #109 from imadaitelarabi/copilot/require-model-selection-cron (174a561)

## [0.2.0] - 2026-02-21

### Meta

- Bump: minor (score: 134)
- Range: since 24 hours

### Features

- make active Stop button red ([3580478](https://github.com/imadaitelarabi/openclaw-mc/commit/3580478))
- refactor agent session matching logic for improved accuracy and maintainability ([052a4fa](https://github.com/imadaitelarabi/openclaw-mc/commit/052a4fa))
- enhance token usage tracking with connection status and improve UI feedback ([f98c78a](https://github.com/imadaitelarabi/openclaw-mc/commit/f98c78a))
- wrap inserted note content in <note> tags ([8f1f4f7](https://github.com/imadaitelarabi/openclaw-mc/commit/8f1f4f7))
- add # native mentions for Notes with image auto-attach ([4b57304](https://github.com/imadaitelarabi/openclaw-mc/commit/4b57304))
- add one-liner installer for production run ([d78e07c](https://github.com/imadaitelarabi/openclaw-mc/commit/d78e07c))
- add scroll functionality to dropdown menus in AgentSelector and CronStatusBarItem ([47bbeca](https://github.com/imadaitelarabi/openclaw-mc/commit/47bbeca))

### Fixes

- avoid chat input tag option id collisions ([adf735e](https://github.com/imadaitelarabi/openclaw-mc/commit/adf735e))
- scope github chat input cache to api instance ([6d3d2eb](https://github.com/imadaitelarabi/openclaw-mc/commit/6d3d2eb))
- improve notes chat menu and caching ([7d721b4](https://github.com/imadaitelarabi/openclaw-mc/commit/7d721b4))
- auto-resize chat input after inserting mention content ([fa1bc68](https://github.com/imadaitelarabi/openclaw-mc/commit/fa1bc68))
- apply tool/reasoning toggles to clicked panel and focus it ([f20d9f1](https://github.com/imadaitelarabi/openclaw-mc/commit/f20d9f1))

### Docs

- reflect token usage indicator and native #notes mentions ([c4ef728](https://github.com/imadaitelarabi/openclaw-mc/commit/c4ef728))
- simplify README and highlight core mission control features ([960e502](https://github.com/imadaitelarabi/openclaw-mc/commit/960e502))

### Chores

- remove unused Convex code and dependency ([abb60a9](https://github.com/imadaitelarabi/openclaw-mc/commit/abb60a9))

### Other

- Merge pull request [#94](https://github.com/imadaitelarabi/openclaw-mc/pull/94) from imadaitelarabi/fix/notes-chatinput-tags ([30dab58](https://github.com/imadaitelarabi/openclaw-mc/commit/30dab58))
- Merge pull request [#93](https://github.com/imadaitelarabi/openclaw-mc/pull/93) from imadaitelarabi/copilot/fix-panel-header-session-update ([4af12a5](https://github.com/imadaitelarabi/openclaw-mc/commit/4af12a5))
- Fix panel header model/thinking dropdown updating the wrong session ([f91d24e](https://github.com/imadaitelarabi/openclaw-mc/commit/f91d24e))
- Merge pull request [#90](https://github.com/imadaitelarabi/openclaw-mc/pull/90) from imadaitelarabi/docs/daily-readme-update-2026-02-21 ([1bd4a22](https://github.com/imadaitelarabi/openclaw-mc/commit/1bd4a22))
- Initial plan ([f75f366](https://github.com/imadaitelarabi/openclaw-mc/commit/f75f366))
- Merge pull request [#91](https://github.com/imadaitelarabi/openclaw-mc/pull/91) from imadaitelarabi/feat/red-stop-run-button ([a6cd545](https://github.com/imadaitelarabi/openclaw-mc/commit/a6cd545))
- Merge pull request [#89](https://github.com/imadaitelarabi/openclaw-mc/pull/89) from imadaitelarabi/copilot/add-token-usage-indicator ([146cb26](https://github.com/imadaitelarabi/openclaw-mc/commit/146cb26))
- Improve useSessionUsage: protocol, session matching, error handling, unlimited context, UI polish ([0a3c9e9](https://github.com/imadaitelarabi/openclaw-mc/commit/0a3c9e9))
- Add token usage indicator above chat input ([0d24a1f](https://github.com/imadaitelarabi/openclaw-mc/commit/0d24a1f))
- Initial plan ([2b44fba](https://github.com/imadaitelarabi/openclaw-mc/commit/2b44fba))
- Merge pull request [#85](https://github.com/imadaitelarabi/openclaw-mc/pull/85) from imadaitelarabi/feat/hash-mentions-notes-provider ([4fd0959](https://github.com/imadaitelarabi/openclaw-mc/commit/4fd0959))
- Merge pull request [#84](https://github.com/imadaitelarabi/openclaw-mc/pull/84) from imadaitelarabi/fix/panel-focus-toggle-switch ([bfbdaa2](https://github.com/imadaitelarabi/openclaw-mc/commit/bfbdaa2))
- Merge pull request [#83](https://github.com/imadaitelarabi/openclaw-mc/pull/83) from imadaitelarabi/chore/remove-convex-unused ([bf6f5ae](https://github.com/imadaitelarabi/openclaw-mc/commit/bf6f5ae))
- Merge pull request [#82](https://github.com/imadaitelarabi/openclaw-mc/pull/82) from imadaitelarabi/docs/simplify-readme-core-sections ([8cb1176](https://github.com/imadaitelarabi/openclaw-mc/commit/8cb1176))
- Merge pull request [#80](https://github.com/imadaitelarabi/openclaw-mc/pull/80) from imadaitelarabi/docs/daily-update-2026-02-20 ([c57db9f](https://github.com/imadaitelarabi/openclaw-mc/commit/c57db9f))
- Merge pull request [#81](https://github.com/imadaitelarabi/openclaw-mc/pull/81) from imadaitelarabi:copilot/add-inline-note-editing ([9a20c7c](https://github.com/imadaitelarabi/openclaw-mc/commit/9a20c7c))
- Merge pull request [#79](https://github.com/imadaitelarabi/openclaw-mc/pull/79) from imadaitelarabi:copilot/add-inline-note-editing ([dd26e82](https://github.com/imadaitelarabi/openclaw-mc/commit/dd26e82))
