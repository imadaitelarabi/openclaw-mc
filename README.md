# OpenClaw MC

<p align="center">
  <img src="public/images/logos/openclawmc-logo-black.png#gh-light-mode-only" alt="OpenClaw MC" width="120" />
  <img src="public/images/logos/openclawmc-logo-white.png#gh-dark-mode-only" alt="OpenClaw MC" width="120" />
</p>

OpenClaw MC is the real-time control UI for OpenClaw Gateway.
It gives you a single place to monitor agents, run chats, manage sessions, and operate automation features.

---

<img width="1512" height="949" alt="image" src="https://github.com/user-attachments/assets/9aabed21-9882-4fa5-bb75-eae358bfd8f7" />

## Quick Start

### Requirements

- Node.js **18+**
- npm
- A running **OpenClaw Gateway** + token

### Option A: One-liner install (interactive, with Tailscale + `oclawmc` CLI)

**Linux / macOS**

```bash
curl -fsSL https://raw.githubusercontent.com/imadaitelarabi/openclaw-mc/master/scripts/install.sh | bash
```

**Windows (PowerShell)**

```powershell
powershell -ExecutionPolicy Bypass -c "irm https://raw.githubusercontent.com/imadaitelarabi/openclaw-mc/master/scripts/install.ps1 | iex"
```

The interactive installer will:

- Prompt for install directory, port, and service options
- Detect or install **Node.js** and **git**
- Optionally detect/install and configure **Tailscale**
- Detect the **OpenClaw** CLI or guide you through remote gateway setup
- Clone the repo, run `npm ci` + `npm run build`, and write `.env.local`
- Register a background service (systemd / launchd / Windows Service) and install the `oclawmc` CLI on PATH

#### `oclawmc` CLI

After install, use the `oclawmc` command to manage the server:

| Command                                | Description                                      |
| -------------------------------------- | ------------------------------------------------ |
| `oclawmc start`                        | Start in foreground                              |
| `oclawmc daemon`                       | Start in background                              |
| `oclawmc stop`                         | Stop the server                                  |
| `oclawmc restart`                      | Restart the server                               |
| `oclawmc status`                       | Show service + Tailscale status                  |
| `oclawmc logs [N]`                     | Tail last N log lines (default 100)              |
| `oclawmc update`                       | Pull latest, rebuild, and restart                |
| `oclawmc tailscale <status\|up\|down>` | Manage Tailscale connection                      |
| `oclawmc openclaw <setup\|status\|doctor>` | Configure OpenClaw Gateway integration       |
| `oclawmc doctor`                       | Preflight health checks (port, token, Tailscale) |
| `oclawmc uninstall`                    | Remove service, CLI, and optionally data         |

Config is stored in `~/.oclawmc/config.json` (Unix) or `%USERPROFILE%\.oclawmc\config.json` (Windows).

#### `oclawmc openclaw` — Gateway integration setup

The `openclaw` subcommand configures the OpenClaw **Gateway** (not the MC server itself) for secure Mission Control communication.

```bash
# Add a trusted origin to gateway.controlUi.allowedOrigins (idempotent)
oclawmc openclaw setup --origin https://mc.example.com

# Set a custom UI base path
oclawmc openclaw setup --base-path /mc

# Expose via Tailscale Serve with matching path prefix
oclawmc openclaw setup --tailscale serve --tailscale-set-path /mc

# Full headless / CI-friendly invocation (no prompts, JSON output)
oclawmc openclaw setup \
  --origin https://mc.example.com \
  --base-path /mc \
  --restart-gateway \
  --non-interactive --yes --json

# Show current Gateway configuration
oclawmc openclaw status

# Run health checks and auto-fix where possible
oclawmc openclaw doctor --fix
```

See [`docs/OPENCLAW-SETUP.md`](docs/OPENCLAW-SETUP.md) for full flag reference, Tailscale path-mapping details, and headless automation examples.

> **Legacy installer** (no Tailscale/CLI, runs in foreground):
>
> ```bash
> curl -fsSL https://raw.githubusercontent.com/imadaitelarabi/openclaw-mc/master/scripts/install-and-run.sh | bash
> ```

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
OPENCLAW_GATEWAY_ORIGIN=http://localhost:3000
```

`OPENCLAW_GATEWAY_ORIGIN` is optional; if omitted, Mission Control uses `http://localhost:${PORT}` (`3000` by default).

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
