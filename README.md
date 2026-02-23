# OpenClaw MC

<p align="center">
  <img src="public/images/logos/openclawmc-logo-black.png#gh-light-mode-only" alt="OpenClaw MC" width="120" />
  <img src="public/images/logos/openclawmc-logo-white.png#gh-dark-mode-only" alt="OpenClaw MC" width="120" />
</p>

OpenClaw MC is the real-time control UI for OpenClaw Gateway.
It gives you a single place to monitor agents, run chats, manage sessions, and operate automation features.

---

## Quick Start

### Requirements

- Node.js **18+**
- npm
- A running **OpenClaw Gateway** + token

### Option A: One-liner install + run (production)

```bash
curl -fsSL https://raw.githubusercontent.com/imadaitelarabi/openclaw-mc/master/scripts/install-and-run.sh | bash
```

> The installer now detects common openclaw-mc clones, reuses an existing checkout, and pulls updates instead of forcing a fresh clone. See [docs/FEATURES.md](./docs/FEATURES.md) for details.

### Option B: Manual install

```bash
git clone https://github.com/imadaitelarabi/openclaw-mc.git
cd openclaw-mc
npm install --legacy-peer-deps
```

Run in production:

```bash
npm run build
npm start
```

Run in development:

```bash
npm run dev
```

OpenClaw MC runs on `http://localhost:3000` by default.

### Gateway setup

You can configure the gateway from the in-app setup flow (recommended), or via `.env.local`:

```env
OPENCLAW_GATEWAY_URL=http://127.0.0.1:18789
OPENCLAW_GATEWAY_TOKEN=your_gateway_token_here
```

---

## General Features

### 1) Real-time agent operations

- Live chat with OpenClaw agents
- Streaming assistant output
- Streaming reasoning and tool-event visualization
- Stop active runs and reset sessions

### 2) Multi-gateway management

- Add/switch between local and remote gateways
- Persistent gateway config in `~/.oc-mission-control/config.json`
- Reconnect + status tracking built in

### 3) Agent lifecycle management

- Create, rename, and delete agents from UI
- Agent creation can apply model/tools/sandbox settings
- Auto-bootstrap of core workspace files for new agents

### 4) Session controls

- Per-session model selection (searchable)
- Thinking level controls (`off`, `low`, `medium`, `high`)
- Tool visibility toggle (verbose)
- Reasoning visibility toggle
- Panel-aware tool/reasoning toggles (applies to the panel you click/focus)
- Token usage indicator above chat input (`used/context`, color-coded) with unlimited-context awareness

### 5) Cron jobs

- List/create/update/delete cron jobs
- Trigger jobs manually (force run)
- View run history and transcript inside panels
- Status-bar visibility for upcoming/running jobs

### 6) Notes system (built in)

- Persistent notes stored locally (`~/.oc-mission-control/notes.json`)
- Groups + tags + custom tag colors
- Image upload/paste support
- Native `#` mentions in chat (`#notes ...`) to browse groups/notes and insert note content
- Inserted note content is wrapped in `<note>...</note>` for cleaner context
- Selecting a note can auto-attach its note image to the outgoing message
- Quick filtering and copy actions

### 7) Extensions framework

- Pluggable extension architecture (status bar, chat tagging, onboarding hooks)
- Built-in GitHub extension:
  - PR/issue status in status bar
  - `@PR` / `@issue` tagging in chat input

### 8) UX and resilience

- Desktop + mobile-optimized controls
- Multi-panel workspace with persisted state
- Scrollable dropdowns for long Agent/Cron lists
- Stream state recovery across refreshes
- Activity history persisted across restarts

### 9) GitHub issue & PR detail panels

- Dedicated GitHub issue and pull request panels surface title, status, metadata, markdown bodies, and the latest conversation/review comments alongside a fast "Open in GitHub" link.
- Chat links pointing to `github.com/.../issues/...` or `/pull/...` now open those panels in-place thanks to the new [chat link matcher registry](./docs/FEATURES.md).
- See [docs/FEATURES.md](./docs/FEATURES.md) for the full rundown on these GitHub extension enhancements.

---

## Troubleshooting

### “No Gateway” on startup

No active gateway is configured.

- Use the setup screen to add one, or
- set `OPENCLAW_GATEWAY_URL` + `OPENCLAW_GATEWAY_TOKEN`.

### Gateway stays disconnected

- Check gateway health/status:
  ```bash
  openclaw gateway status
  ```
- Verify URL/token are correct
- Check firewall/network access to gateway port

### Agents list is empty

- Confirm gateway auth is successful
- Confirm token has required operator scopes
- Reconnect gateway from the switcher/menu

### Chat not updating or partial streams

- Ensure WebSocket connection is stable
- Reload OpenClaw MC (stream recovery is supported)
- Verify gateway is receiving `chat.send` and emitting agent events

### Build fails

- Verify Node.js 18+
- Clean install and rebuild:
  ```bash
  rm -rf node_modules package-lock.json
  npm install --legacy-peer-deps
  npm run build
  ```

### Port 3000 already in use

Use a different port:

```bash
PORT=3001 npm start
```

---

## Links

- OpenClaw Docs: https://docs.openclaw.ai
- OpenClaw GitHub: https://github.com/openclaw/openclaw
- Changelog: [CHANGELOG.md](./CHANGELOG.md)
