# Changelog

## [0.4.0] - 2026-02-23

### Meta

- Bump: minor (score: 188)
- Range: 174a5614e2266b7015d4403e5dec7a6e3afb77b4..629894d4a7e5892ace043056bc7f32096f1626ec

### Features

- add in-app GitHub PR and issue detail panels ([c218832](https://github.com/imadaitelarabi/openclaw-mc/commit/c218832))
- use ReactMarkdown with remark-gfm for PR/issue body rendering ([17f357a](https://github.com/imadaitelarabi/openclaw-mc/commit/17f357a))
- enhance GitHub PR and issue detail panels with loading states and context checks ([187e60a](https://github.com/imadaitelarabi/openclaw-mc/commit/187e60a))
- detect existing openclaw-mc installs and update in place ([0a20065](https://github.com/imadaitelarabi/openclaw-mc/commit/0a20065))
- open GitHub Issue/PR links in chat directly in details panel ([3bcf2d1](https://github.com/imadaitelarabi/openclaw-mc/commit/3bcf2d1))
- persist GitHub extension panel filters across refresh (IndexedDB) ([79db715](https://github.com/imadaitelarabi/openclaw-mc/commit/79db715))

### Fixes

- use default panel flag ordering + de-dupe Open Panel injection ([495dcc9](https://github.com/imadaitelarabi/openclaw-mc/commit/495dcc9))

### Refactors

- update issue and PR panel search to use single repository selection and improve loading states ([36e3ca5](https://github.com/imadaitelarabi/openclaw-mc/commit/36e3ca5))
- simplify extension retrieval in onboarding and panel components; enhance loading state handling in Issues and Pull Requests panels ([9dc1247](https://github.com/imadaitelarabi/openclaw-mc/commit/9dc1247))
- format code for consistency and improve readability in various components and documentation ([7cbf64a](https://github.com/imadaitelarabi/openclaw-mc/commit/7cbf64a))
- address code review feedback ([d501096](https://github.com/imadaitelarabi/openclaw-mc/commit/d501096))
- streamline state initialization and error handling in GitHub PR details panel ([74a2215](https://github.com/imadaitelarabi/openclaw-mc/commit/74a2215))
- introduce ChatLinkMatcher registry to decouple chat from GitHub ([b579597](https://github.com/imadaitelarabi/openclaw-mc/commit/b579597))
- simplify regex matching for GitHub issue and PR URLs ([fbe77e7](https://github.com/imadaitelarabi/openclaw-mc/commit/fbe77e7))

### Docs

- cover cron model selection and tag creation ([e726565](https://github.com/imadaitelarabi/openclaw-mc/commit/e726565))
- highlight GitHub panels and installer update ([4dfce80](https://github.com/imadaitelarabi/openclaw-mc/commit/4dfce80))

### Chores

- daily changelog 2026-02-22 ([1ba88f8](https://github.com/imadaitelarabi/openclaw-mc/commit/1ba88f8))

### Other

- Initial plan ([bef6789](https://github.com/imadaitelarabi/openclaw-mc/commit/bef6789))
- Add Edit Agent Files tab + AgentFilePanel for workspace file editing ([4dd3a4c](https://github.com/imadaitelarabi/openclaw-mc/commit/4dd3a4c))
- Refactor handleAgentFilesGet to improve content and existence checks for response objects ([d51dc09](https://github.com/imadaitelarabi/openclaw-mc/commit/d51dc09))
- Refactor message handling imports for improved readability ([2c4d0e2](https://github.com/imadaitelarabi/openclaw-mc/commit/2c4d0e2))
- Merge pull request [#112](https://github.com/imadaitelarabi/openclaw-mc/pull/112) from imadaitelarabi/docs/daily-update-2026-02-22 ([46c1ccb](https://github.com/imadaitelarabi/openclaw-mc/commit/46c1ccb))
- Merge pull request [#113](https://github.com/imadaitelarabi/openclaw-mc/pull/113) from imadaitelarabi/changelog/daily-2026-02-22 ([df03528](https://github.com/imadaitelarabi/openclaw-mc/commit/df03528))
- Merge branch 'master' of https://github.com/imadaitelarabi/openclaw-mc into copilot/edit-agent-files-tab ([10f55f8](https://github.com/imadaitelarabi/openclaw-mc/commit/10f55f8))
- Refactor AgentFilePanel to improve WebSocket handling and cleanup logic; update Notes feature documentation for deleteTag method signature ([823d066](https://github.com/imadaitelarabi/openclaw-mc/commit/823d066))
- Merge pull request [#111](https://github.com/imadaitelarabi/openclaw-mc/pull/111) from imadaitelarabi/copilot/edit-agent-files-tab ([ae8c69c](https://github.com/imadaitelarabi/openclaw-mc/commit/ae8c69c))
- Initial plan ([779e064](https://github.com/imadaitelarabi/openclaw-mc/commit/779e064))
- Add Settings option in agent panel header dropdown to open Edit Agent panel ([c3143c3](https://github.com/imadaitelarabi/openclaw-mc/commit/c3143c3))
- Merge pull request [#116](https://github.com/imadaitelarabi/openclaw-mc/pull/116) from imadaitelarabi/copilot/add-settings-option-dropdown ([b4a2489](https://github.com/imadaitelarabi/openclaw-mc/commit/b4a2489))
- Initial plan ([c348d84](https://github.com/imadaitelarabi/openclaw-mc/commit/c348d84))
- Add extension panels via status bar + first-time write consent gate ([c88e4ff](https://github.com/imadaitelarabi/openclaw-mc/commit/c88e4ff))
- Add GitHub Issues and Pull Requests extension panels ([bd39cc8](https://github.com/imadaitelarabi/openclaw-mc/commit/bd39cc8))
- Enhance GitHub API and UI panels with multi-repo support for issue and PR searches ([dfe3ecd](https://github.com/imadaitelarabi/openclaw-mc/commit/dfe3ecd))
- Optimize GitHub API search by chunking repository queries and enhancing deduplication logic for accessible repositories ([6aeca64](https://github.com/imadaitelarabi/openclaw-mc/commit/6aeca64))
- Add FilterDropdown component and integrate it into Issues and Pull Requests panels ([fe98901](https://github.com/imadaitelarabi/openclaw-mc/commit/fe98901))
- Merge pull request [#118](https://github.com/imadaitelarabi/openclaw-mc/pull/118) from imadaitelarabi/copilot/add-extension-panels-status-bar ([6e73158](https://github.com/imadaitelarabi/openclaw-mc/commit/6e73158))
- Initial plan ([919950b](https://github.com/imadaitelarabi/openclaw-mc/commit/919950b))
- Merge pull request [#121](https://github.com/imadaitelarabi/openclaw-mc/pull/121) from imadaitelarabi/copilot/add-in-app-pr-issue-panels ([66a7488](https://github.com/imadaitelarabi/openclaw-mc/commit/66a7488))
- Initial plan ([48bd132](https://github.com/imadaitelarabi/openclaw-mc/commit/48bd132))
- Initial plan ([28d7533](https://github.com/imadaitelarabi/openclaw-mc/commit/28d7533))
- GitHub extension: update PR/Issue detail layout, add comments (GitHub-style) ([403fb38](https://github.com/imadaitelarabi/openclaw-mc/commit/403fb38))
- Merge pull request [#127](https://github.com/imadaitelarabi/openclaw-mc/pull/127) from imadaitelarabi/copilot/update-pr-issue-layout ([1a8322b](https://github.com/imadaitelarabi/openclaw-mc/commit/1a8322b))
- Merge pull request [#124](https://github.com/imadaitelarabi/openclaw-mc/pull/124) from imadaitelarabi/copilot/detect-existing-installs-update ([ac1c187](https://github.com/imadaitelarabi/openclaw-mc/commit/ac1c187))
- Initial plan ([b7c652c](https://github.com/imadaitelarabi/openclaw-mc/commit/b7c652c))
- Merge branch 'copilot/open-github-links-in-chat-panel' of https://github.com/imadaitelarabi/openclaw-mc into copilot/open-github-links-in-chat-panel ([a88ee1f](https://github.com/imadaitelarabi/openclaw-mc/commit/a88ee1f))
- Merge pull request [#128](https://github.com/imadaitelarabi/openclaw-mc/pull/128) from imadaitelarabi/copilot/open-github-links-in-chat-panel ([f24c750](https://github.com/imadaitelarabi/openclaw-mc/commit/f24c750))
- Initial plan ([dfac69c](https://github.com/imadaitelarabi/openclaw-mc/commit/dfac69c))
- Merge pull request [#129](https://github.com/imadaitelarabi/openclaw-mc/pull/129) from imadaitelarabi/copilot/persist-github-filters-across-refresh ([9d75d26](https://github.com/imadaitelarabi/openclaw-mc/commit/9d75d26))
- Merge pull request [#130](https://github.com/imadaitelarabi/openclaw-mc/pull/130) from imadaitelarabi/docs/github-panels-update ([629894d](https://github.com/imadaitelarabi/openclaw-mc/commit/629894d))

## [0.3.0] - 2026-02-22

### Meta

- Bump: minor (score: 124)
- Range: 30dab58afd3628004c5188249358986fc0a767b7..174a5614e2266b7015d4403e5dec7a6e3afb77b4

### Features

- add gateway skills fetch ([00331f0](https://github.com/imadaitelarabi/openclaw-mc/commit/00331f0))
- add skills filters and persistence ([7c84e9c](https://github.com/imadaitelarabi/openclaw-mc/commit/7c84e9c))
- add skills to native # mentions ([d232b22](https://github.com/imadaitelarabi/openclaw-mc/commit/d232b22))
- support global search for @ extensions and # native mentions ([a4a97a6](https://github.com/imadaitelarabi/openclaw-mc/commit/a4a97a6))
- require model selection in cron create/edit panels and send payload.model ([38e93cc](https://github.com/imadaitelarabi/openclaw-mc/commit/38e93cc))
- replace model selection dropdown with ModelSelector component in Create and Update Cron panels ([c9fdfcb](https://github.com/imadaitelarabi/openclaw-mc/commit/c9fdfcb))

### Fixes

- avoid passing click event to skills refresh ([dd7efd7](https://github.com/imadaitelarabi/openclaw-mc/commit/dd7efd7))
- flatten hierarchical extension results to leaves in global search ([a33175e](https://github.com/imadaitelarabi/openclaw-mc/commit/a33175e))
- filter and sort global search leaf results by relevance score ([91c06ef](https://github.com/imadaitelarabi/openclaw-mc/commit/91c06ef))

### Refactors

- format function parameters for CreateCronPanel and UpdateCronPanel components ([2ba5eb2](https://github.com/imadaitelarabi/openclaw-mc/commit/2ba5eb2))

### Docs

- linkify PRs and commit SHAs ([d29f7d3](https://github.com/imadaitelarabi/openclaw-mc/commit/d29f7d3))

### Chores

- daily changelog 2026-02-21 ([4283585](https://github.com/imadaitelarabi/openclaw-mc/commit/4283585))

### Other

- Merge pull request [#95](https://github.com/imadaitelarabi/openclaw-mc/pull/95) from imadaitelarabi/changelog/daily-2026-02-21 ([ec733f7](https://github.com/imadaitelarabi/openclaw-mc/commit/ec733f7))
- Merge pull request [#96](https://github.com/imadaitelarabi/openclaw-mc/pull/96) from imadaitelarabi/chore/linkify-changelog ([2d28316](https://github.com/imadaitelarabi/openclaw-mc/commit/2d28316))
- Initial plan ([4e35d3f](https://github.com/imadaitelarabi/openclaw-mc/commit/4e35d3f))
- Rename Mission Control to OpenClaw MC + add keyboard navigation/scrolling in menus ([9a0c959](https://github.com/imadaitelarabi/openclaw-mc/commit/9a0c959))
- Merge pull request [#99](https://github.com/imadaitelarabi/openclaw-mc/pull/99) from imadaitelarabi/feature/gateway-skills ([9d8c656](https://github.com/imadaitelarabi/openclaw-mc/commit/9d8c656))
- Merge pull request [#98](https://github.com/imadaitelarabi/openclaw-mc/pull/98) from imadaitelarabi/copilot/rename-mission-control-to-openclaw-mc ([51a337f](https://github.com/imadaitelarabi/openclaw-mc/commit/51a337f))
- Initial plan ([1d84221](https://github.com/imadaitelarabi/openclaw-mc/commit/1d84221))
- Merge pull request [#103](https://github.com/imadaitelarabi/openclaw-mc/pull/103) from imadaitelarabi/copilot/support-global-search-extensions-mentions ([e1c9a2b](https://github.com/imadaitelarabi/openclaw-mc/commit/e1c9a2b))
- Initial plan ([a000ec5](https://github.com/imadaitelarabi/openclaw-mc/commit/a000ec5))
- README cleanup + tag creation feature in Tags Settings panel ([f68e216](https://github.com/imadaitelarabi/openclaw-mc/commit/f68e216))
- Merge pull request [#105](https://github.com/imadaitelarabi/openclaw-mc/pull/105) from imadaitelarabi/copilot/update-readme-and-tag-settings ([b90b447](https://github.com/imadaitelarabi/openclaw-mc/commit/b90b447))
- Initial plan ([68afa99](https://github.com/imadaitelarabi/openclaw-mc/commit/68afa99))
- Add oxlint + prettier formatting and CI quality workflow ([f270cf8](https://github.com/imadaitelarabi/openclaw-mc/commit/f270cf8))
- Merge pull request [#107](https://github.com/imadaitelarabi/openclaw-mc/pull/107) from imadaitelarabi/copilot/add-oxlint-prettier-formatting ([572b012](https://github.com/imadaitelarabi/openclaw-mc/commit/572b012))
- Initial plan ([221fbb2](https://github.com/imadaitelarabi/openclaw-mc/commit/221fbb2))
- Merge pull request [#109](https://github.com/imadaitelarabi/openclaw-mc/pull/109) from imadaitelarabi/copilot/require-model-selection-cron ([174a561](https://github.com/imadaitelarabi/openclaw-mc/commit/174a561))

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
