# Tailscale Path Mapping

This document explains how `oclawmc openclaw setup --tailscale` maps
Mission Control paths through Tailscale Serve and Funnel.

---

## Background

Tailscale Serve (local-network) and Funnel (internet-accessible) both support
**path-based routing** via `--set-path`. When you expose Mission Control at a
non-root path (e.g. `/mc`) the `--set-path` flag tells Tailscale which
incoming prefix to forward to the local service.

OpenClaw Gateway mirrors this with `gateway.controlUi.basePath`.

**Important:** Tailscale strips the path prefix before forwarding the request
to the upstream target. Ensure `gateway.controlUi.basePath` matches the
Tailscale path so the Gateway receives requests on the correct root.

---

## Modes

| Mode     | Visibility | Command |
| -------- | ---------- | ------- |
| `serve`  | Tailnet only (devices logged into your Tailscale network) | `tailscale serve` |
| `funnel` | Public internet | `tailscale funnel` |
| `off`    | Remove serve/funnel config | `tailscale serve reset` |

---

## Common patterns

### Root path (default)

No path configuration needed — Mission Control is served at `/`.

```bash
oclawmc openclaw setup --tailscale serve
```

Tailscale maps `https://mymachine.example.ts.net/` → `http://localhost:3000`
(replace `mymachine.example.ts.net` with your actual Tailscale hostname).

### Custom base path

Keep path consistent between Gateway config and Tailscale:

```bash
oclawmc openclaw setup \
  --base-path /mc \
  --tailscale serve \
  --tailscale-set-path /mc
```

This runs two operations atomically:

1. Sets `gateway.controlUi.basePath: /mc` in the Gateway config.
2. Runs `tailscale serve --set-path /mc http://localhost:3000`.

Tailscale maps `https://<hostname>/mc` → `http://localhost:3000` (prefix
`/mc` is stripped by Tailscale before forwarding).

### Public Funnel

Requires Tailscale Funnel to be enabled for your account/policy:

```bash
oclawmc openclaw setup \
  --base-path /control \
  --tailscale funnel \
  --tailscale-set-path /control
```

### Custom port or target

Override the upstream target if Mission Control runs on a non-default port:

```bash
oclawmc openclaw setup \
  --tailscale serve \
  --tailscale-set-path /mc \
  --tailscale-target http://localhost:4000
```

---

## Prefix-strip behaviour

Tailscale removes the path prefix before sending the request upstream. Example:

```
Incoming:  GET https://mymachine.example.ts.net/mc/agents
Tailscale: strips /mc
Upstream:  GET http://localhost:3000/agents
```

This means Mission Control receives requests at the root path internally.
Setting `gateway.controlUi.basePath: /mc` tells the Gateway to expect links
and CORS headers relative to `/mc` externally.

---

## Troubleshooting

| Symptom | Likely cause |
| ------- | ------------ |
| 404 on all routes | `--set-path` doesn't match `basePath` |
| CORS errors in browser | Origin not in `gateway.controlUi.allowedOrigins` |
| Funnel command fails | Funnel not enabled; check `tailscale funnel status` |
| `tailscale serve` fails on macOS | May need `sudo` or use the Tailscale app |
