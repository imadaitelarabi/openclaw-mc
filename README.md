# Mission Control

Mission Control is the real-time control UI for OpenClaw Gateway.
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

Mission Control runs on `http://localhost:3000` by default.

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

### 5) Cron jobs
- List/create/update/delete cron jobs
- Trigger jobs manually (force run)
- View run history and transcript inside panels
- Status-bar visibility for upcoming/running jobs

### 6) Notes system (built in)
- Persistent notes stored locally (`~/.oc-mission-control/notes.json`)
- Groups + tags + custom tag colors
- Image upload/paste support
- Quick filtering and copy actions

### 7) Extensions framework
- Pluggable extension architecture (status bar, chat tagging, onboarding hooks)
- Built-in GitHub extension:
  - PR/issue status in status bar
  - `@PR` / `@issue` tagging in chat input

### 8) UX and resilience
- Desktop + mobile-optimized controls
- Multi-panel workspace with persisted state
- Stream state recovery across refreshes
- Activity history persisted across restarts

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
- Reload Mission Control (stream recovery is supported)
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
- Community: https://discord.com/invite/clawd
