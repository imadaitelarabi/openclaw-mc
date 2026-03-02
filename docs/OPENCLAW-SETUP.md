# `oclawmc openclaw` — Gateway Integration Setup

The `oclawmc openclaw` command group configures the **OpenClaw Gateway** for
Mission Control communication without manual config-file editing.

Config is mutated via `openclaw config get/set/unset` when the `openclaw` CLI
is available; otherwise the command falls back to direct JSON edits of
`~/.openclaw/openclaw.json` using Python 3's standard `json` module (no extra
dependencies required).

---

## Subcommands

| Subcommand | Description |
| ---------- | ----------- |
| `setup`    | Configure `gateway.controlUi.*` settings |
| `status`   | Print current Gateway configuration |
| `doctor`   | Run health checks; `--fix` auto-remediates known issues |

---

## `setup` — Flag reference

### Origin allowlist

```bash
# Append one or more origins (idempotent — duplicates are silently skipped)
oclawmc openclaw setup --origin https://mc.example.com
oclawmc openclaw setup --origin https://a.example.com --origin https://b.example.com

# Clear the entire list (prompts for confirmation unless --yes is passed)
oclawmc openclaw setup --clear-origins
oclawmc openclaw setup --clear-origins --yes
```

Origins must start with `http://` or `https://`. Trailing slashes are stripped
automatically. The flag is repeatable and can be combined with other flags.

### Base path

```bash
# Set gateway.controlUi.basePath (must start with /)
oclawmc openclaw setup --base-path /mc
oclawmc openclaw setup --base-path /control
```

Trailing slashes are stripped (bare `/` is left unchanged). An invalid path
(not starting with `/`) exits with a non-zero code.

### Tailscale integration

```bash
# Expose via Tailscale Serve on the default path (/)
oclawmc openclaw setup --tailscale serve

# Expose via Tailscale Funnel with a path prefix mirroring --base-path
oclawmc openclaw setup --tailscale funnel --tailscale-set-path /mc

# Override the local target URL (advanced)
oclawmc openclaw setup --tailscale serve \
  --tailscale-set-path /mc \
  --tailscale-target http://localhost:4000

# Disable / remove current Tailscale serve config
oclawmc openclaw setup --tailscale off
```

See [`TAILSCALE-PATH-MAPPING.md`](TAILSCALE-PATH-MAPPING.md) for full details.

### Restart gateway after changes

```bash
oclawmc openclaw setup --origin https://mc.example.com --restart-gateway
```

Calls `openclaw gateway restart` when the `openclaw` CLI is on `PATH`.

### Headless / non-interactive mode

| Flag                | Effect |
| ------------------- | ------ |
| `--non-interactive` | Disable all interactive prompts; use defaults |
| `--yes` / `-y`      | Auto-confirm any confirmation prompts |
| `--json`            | Emit a JSON object to stdout instead of human-readable output |

See [`HEADLESS-AUTOMATION.md`](HEADLESS-AUTOMATION.md) for complete examples.

---

## `status`

```bash
oclawmc openclaw status
oclawmc openclaw status --json   # machine-readable
```

Prints `gateway.controlUi.allowedOrigins` and `gateway.controlUi.basePath`
from the Gateway config.

---

## `doctor`

```bash
oclawmc openclaw doctor          # report only
oclawmc openclaw doctor --fix    # attempt auto-remediation
oclawmc openclaw doctor --json   # JSON output
```

Checks performed:

| Check | Fix available? |
| ----- | -------------- |
| `openclaw` CLI present | No (informational) |
| `openclaw.json` config file found | No (displays guidance) |
| Tailscale connected | No (informational) |
| `python3` available | No (displays guidance) |

---

## Config access order

When mutating or reading config, the command:

1. Calls `openclaw config get/set/unset <key>` if the `openclaw` CLI is available (preferred).
2. Falls back to direct JSON edits of `openclaw.json` when the CLI is absent.

### Config file detection (fallback only)

1. `$OPENCLAW_CONFIG_PATH` environment variable (override)
2. `~/.openclaw/openclaw.json`
3. `$XDG_CONFIG_HOME/openclaw/openclaw.json` (or `~/.config/openclaw/openclaw.json`)
4. `/etc/openclaw/openclaw.json`

Set `OPENCLAW_CONFIG_PATH` to point at a non-standard location:

```bash
export OPENCLAW_CONFIG_PATH=/opt/myapp/openclaw.json
oclawmc openclaw setup --origin https://mc.example.com
```

---

## Requirements

- **openclaw CLI** (preferred) — `openclaw config get/set/unset` and `openclaw gateway restart`
- **python3** (stdlib only, no extra packages) — required for the JSON-file fallback path
- **tailscale** CLI — only required when using `--tailscale`

