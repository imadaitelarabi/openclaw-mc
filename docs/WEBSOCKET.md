# OpenClaw Gateway WebSocket Protocol

## Authentication Flow

1. **Client connects** to `ws://127.0.0.1:18789` or `wss://tailscale-domain/ws`

2. **Server sends challenge:**
```json
{
  "type": "event",
  "event": "connect.challenge",
  "payload": {
    "nonce": "uuid-v4-string",
    "ts": 1234567890
  }
}
```

3. **Client sends connect request:**
```json
{
  "type": "req",
  "id": "unique-request-id",
  "method": "connect",
  "params": {
    "minProtocol": 3,
    "maxProtocol": 3,
    "client": {
      "id": "openclaw-control-ui",
      "version": "dev",
      "platform": "web",
      "mode": "webchat",
      "instanceId": "optional-uuid"
    },
    "role": "operator",
    "scopes": ["operator.admin", "operator.approvals", "operator.pairing"],
    "auth": {
      "token": "gateway-token-from-config",
      "password": "optional-password"
    },
    "device": null,  // or device crypto object
    "caps": [],
    "userAgent": "Mozilla/...",
    "locale": "en-US"
  }
}
```

4. **Server responds:**
```json
{
  "type": "res",
  "id": "request-id-from-step-3",
  "ok": true,
  "payload": {
    "auth": {
      "deviceToken": "optional-device-token",
      "role": "operator",
      "scopes": ["..."]
    },
    "snapshot": {
      "sessionDefaults": {},
      "presence": [],
      "health": {}
    }
  }
}
```

## Making Requests

After authentication, send requests:
```json
{
  "type": "req",
  "id": "unique-id",
  "method": "sessions.list",
  "params": {}
}
```

## Receiving Events

Real-time events come as:
```json
{
  "type": "event",
  "event": "chat",
  "seq": 123,
  "payload": {
    "sessionKey": "agent:main:main",
    "runId": "uuid",
    "state": "delta|final|error",
    "message": {}
  }
}
```

## Event Types

- `chat` - Chat messages
- `agent` - Agent tool calls
- `cron` - CRON job events
- `presence` - Presence updates
- `exec.approval.requested` - Command approval needed
- `device.pair.requested` - Device pairing

## Why SSE Is Simpler for OpenClaw MC

1. No complex authentication handshake
2. Works through standard HTTP proxies
3. Built-in reconnection
4. We're polling anyway (2-second intervals)

WebSocket would be better for:
- Sub-second latency requirements
- Bidirectional commands (restart agents, etc.)
- Lower overhead at scale
