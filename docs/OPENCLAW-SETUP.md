# `oclawmc openclaw` — Gateway Integration Setup

The `oclawmc openclaw` command group configures the **OpenClaw Gateway** for
Mission Control communication without manual config-file editing.

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

If the `openclaw` CLI is on `PATH`, it calls `openclaw restart`; otherwise a
warning is printed.

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
from the detected Gateway config file.

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
| Gateway config file found | Runs `openclaw config init` if CLI is available |
| Tailscale connected | No (informational) |
| `python3` + PyYAML available | Runs `pip3 install pyyaml` with `--fix` |

---

## Config file detection

The command searches for the Gateway config file in this order:

1. `$OPENCLAW_CONFIG_PATH` environment variable (override)
2. `openclaw config path` CLI output
3. `~/.openclaw/config.yaml`
4. `$XDG_CONFIG_HOME/openclaw/config.yaml` (or `~/.config/openclaw/config.yaml`)
5. `/etc/openclaw/config.yaml`

Set `OPENCLAW_CONFIG_PATH` to point at a non-standard location:

```bash
export OPENCLAW_CONFIG_PATH=/opt/myapp/openclaw.yaml
oclawmc openclaw setup --origin https://mc.example.com
```

---

## Requirements

- **python3** with **PyYAML** (`pip3 install pyyaml`) — required for config editing
- **tailscale** CLI — only required when using `--tailscale`
- **openclaw** CLI — optional; used for `doctor --fix` and `--restart-gateway`
