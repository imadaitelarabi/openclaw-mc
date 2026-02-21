# Global Gateway Event Forwarding and Logging

## Overview

OpenClaw MC now implements a **global event forwarding** approach for all Gateway events, replacing the previous selective filtering system. This enhancement improves debugging capabilities and enables new features without requiring server-side code changes.

## Key Changes

### 1. Inclusive Event Forwarding

**Before:**

- Only `chat` and `agent` events were forwarded to clients
- Other events like `tick`, `presence`, and `exec.approval.requested` were silently dropped

**After:**

- **ALL** gateway events are now forwarded to connected clients
- Events are broadcast immediately after logging
- Internal processing still occurs for specific events (chat, agent, cron)

### 2. Comprehensive Event Logging

Every gateway event is now logged with structured information:

```json
{
  "timestamp": "2026-02-16T01:40:01.512Z",
  "event": "chat",
  "runId": "run-abc123",
  "sessionKey": "agent:test-agent-123:main",
  "payloadSize": "103 bytes"
}
```

**Logged Information:**

- **timestamp**: ISO 8601 formatted server arrival time
- **event**: Event name (e.g., `chat`, `tick`, `exec.approval.requested`)
- **runId**: Run identifier when available in payload
- **sessionKey**: Session key when available in payload
- **payloadSize**: Size of the event payload in bytes

### 3. Debug Mode for Detailed Logging

A new environment variable `DEBUG_GATEWAY_EVENTS` controls verbose payload logging:

```bash
# Enable detailed payload logging
DEBUG_GATEWAY_EVENTS=true

# Disable detailed payload logging (default)
DEBUG_GATEWAY_EVENTS=false
```

**When enabled**, the full event payload is logged:

```
[Gateway Event Payload] chat: {
  "sessionKey": "agent:test-agent-123:main",
  "runId": "run-abc123",
  "message": "Hello world",
  "state": "final"
}
```

## Implementation Details

### Modified Files

1. **`.env.local.example`**
   - Added `DEBUG_GATEWAY_EVENTS` configuration option

2. **`server/core/GatewayClient.ts`**
   - Added `debugGatewayEvents` class property
   - Implemented `logGatewayEvent()` method for comprehensive logging
   - Refactored `handleGatewayEvent()` to follow the new flow:
     1. Log all events
     2. Broadcast all events to clients
     3. Process specific events for enhanced formatting
     4. Execute internal handlers for specific event types

### Event Flow

```
Gateway Event Received
        ↓
    Log Event (with structured data)
        ↓
    Broadcast to ALL Clients
        ↓
    Process chat/agent events (optional enhanced formatting)
        ↓
    Internal Handlers (activity log, cron refresh, etc.)
```

## Usage Examples

### Frontend Event Handling

The frontend will now receive ALL gateway events through the WebSocket connection:

```typescript
// Example: Handling a tick event
ws.onmessage = (event) => {
  const data = JSON.parse(event.data);

  if (data.type === "event") {
    switch (data.event) {
      case "tick":
        // Handle tick event
        console.log("Tick received:", data.payload);
        break;

      case "presence":
        // Handle presence event
        updatePresenceIndicator(data.payload);
        break;

      case "exec.approval.requested":
        // Show approval dialog
        showApprovalDialog(data.payload);
        break;

      case "chat":
      case "agent":
        // These still receive enhanced processing
        handleChatOrAgentEvent(data);
        break;
    }
  }
};
```

### Server Console Output

**Normal Mode** (DEBUG_GATEWAY_EVENTS=false):

```
[Gateway Event] {"timestamp":"2026-02-16T01:40:01.512Z","event":"chat","runId":"run-abc123","sessionKey":"agent:test-agent-123:main","payloadSize":"103 bytes"}
[Gateway Event] {"timestamp":"2026-02-16T01:40:01.513Z","event":"tick","runId":null,"sessionKey":null,"payloadSize":"27 bytes"}
```

**Debug Mode** (DEBUG_GATEWAY_EVENTS=true):

```
[Gateway Event] {"timestamp":"2026-02-16T01:40:01.512Z","event":"chat","runId":"run-abc123","sessionKey":"agent:test-agent-123:main","payloadSize":"103 bytes"}
[Gateway Event Payload] chat: {
  "sessionKey": "agent:test-agent-123:main",
  "runId": "run-abc123",
  "message": "Hello world",
  "state": "final"
}
```

## Benefits

1. **No Server Changes for New Features**: Frontend can now implement features like Exec Approvals or Presence monitoring without requiring server-side changes

2. **Improved Debugging**: All events are visible in server logs with structured information

3. **Better Observability**: Payload size tracking helps identify performance issues

4. **Flexible Logging**: Debug mode provides detailed information when needed without cluttering production logs

5. **Backward Compatible**: Existing event processing (activity logs, enhanced formatting) continues to work

## Configuration

Add to your `.env.local` file:

```bash
# Optional: Enable detailed gateway event logging
DEBUG_GATEWAY_EVENTS=true
```

## Migration Notes

- **No breaking changes**: Existing frontend code continues to work
- `chat` and `agent` events still receive enhanced processing through `event.processed` messages
- Internal handlers (activity log, cron refresh) continue to function
- New events are automatically available to clients

## Related Documentation

- [Server Architecture](./SERVER-ARCHITECTURE.md)
- [Pattern-Based Event Handling](./PATTERN-BASED-EVENT-HANDLING.md)
- [WebSocket Communication](./WEBSOCKET.md)
