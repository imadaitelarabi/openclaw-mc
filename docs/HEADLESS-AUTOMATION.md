# Headless Automation for AI Agents and CI

`oclawmc openclaw setup` supports a fully non-interactive mode suitable for
AI coding agents (e.g. Copilot, Cursor, Devin) and CI pipelines.

---

## Key flags

| Flag | Effect |
| ---- | ------ |
| `--non-interactive` | Never prompt for input; use safe defaults |
| `--yes` / `-y` | Auto-confirm any destructive prompts (e.g. `--clear-origins`) |
| `--json` | Emit a single JSON object to stdout; suppress human-readable output |

All three can be combined. Exit codes follow Unix conventions (`0` = success,
`1` = error).

---

## JSON output schema

### `setup`

```json
{ "status": "ok", "config": "/home/user/.openclaw/config.yaml", "changed": true }
```

On error:

```json
{ "status": "error", "error": "OpenClaw Gateway config not found." }
```

### `status --json`

```json
{
  "status": "ok",
  "config": "/home/user/.openclaw/config.yaml",
  "allowedOrigins": ["https://mc.example.com"],
  "basePath": "/mc"
}
```

### `doctor --json`

```json
{
  "checks": [
    { "label": "openclaw CLI", "status": "warn", "detail": "not found (optional)" },
    { "label": "Config file",  "status": "ok",   "detail": "/home/user/.openclaw/config.yaml" },
    { "label": "Tailscale",    "status": "ok",   "detail": "connected" },
    { "label": "python3+PyYAML","status": "ok",  "detail": "available" }
  ],
  "ok_count": 3,
  "fail_count": 0
}
```

Status values: `"ok"` | `"warn"` | `"fail"`.

---

## Examples

### CI pipeline (GitHub Actions)

```yaml
- name: Configure OpenClaw MC Gateway
  env:
    OPENCLAW_CONFIG_PATH: /etc/openclaw/config.yaml
  run: |
    oclawmc openclaw setup \
      --origin https://mc.${{ secrets.DOMAIN }} \
      --base-path /mc \
      --restart-gateway \
      --non-interactive --yes --json
```

### AI agent (shell snippet)

```bash
# Run setup and capture JSON for further processing
result=$(oclawmc openclaw setup \
  --origin https://mc.example.com \
  --non-interactive --yes --json)

status=$(python3 -c "import sys,json; print(json.loads(sys.argv[1])['status'])" "$result")
if [[ "$status" != "ok" ]]; then
  echo "Setup failed: $result" >&2
  exit 1
fi
```

### Doctor check in CI

```bash
# Exit non-zero if any required check fails
oclawmc openclaw doctor --json | tee /tmp/doctor.json
python3 -c "
import json, sys
d = json.load(open('/tmp/doctor.json'))
if d['fail_count'] > 0:
    print('Doctor found failures:', [c for c in d['checks'] if c['status']=='fail'])
    sys.exit(1)
"
```

### Windows PowerShell (CI)

```powershell
$result = oclawmc openclaw setup `
  --origin https://mc.example.com `
  --non-interactive --yes --json | ConvertFrom-Json

if ($result.status -ne 'ok') {
  Write-Error "Setup failed: $($result.error)"
  exit 1
}
```

---

## Environment variables

| Variable | Purpose |
| -------- | ------- |
| `OPENCLAW_CONFIG_PATH` | Override Gateway config file path |

---

## Deterministic exit codes

| Code | Meaning |
| ---- | ------- |
| `0`  | Success (or `status` check passed) |
| `1`  | General error (invalid flag, config not found, patch failed) |
| `2`  | PyYAML not installed |
