# Server Architecture

## Overview

Mission Control's backend is built with a **modular TypeScript architecture** that separates concerns into logical layers. The server handles Next.js integration, WebSocket client connections, and Gateway communication.

## Directory Structure

```
server/
├── index.ts                # Server entry point & Next.js integration
├── core/                   # Core services
│   ├── ConfigManager.ts    # Persistent gateway configuration
│   ├── GatewayClient.ts    # OpenClaw Gateway WebSocket client
│   └── WebSocketServer.ts  # Client connection manager
├── handlers/               # Message handlers (modular routing)
│   ├── agent.handler.ts    # Agent operations (add, update, delete)
│   ├── chat.handler.ts     # Chat message handling
│   ├── session.handler.ts  # Session operations (list, patch)
│   ├── gateway.handler.ts  # Gateway management (add, switch, remove)
│   ├── models.handler.ts   # Model listing
│   └── index.ts            # Message router/dispatcher
├── types/
│   ├── gateway.ts          # Gateway RPC type definitions
│   └── internal.ts         # Internal server types
└── utils/
    ├── paths.ts            # OS-agnostic path helpers
    └── strings.ts          # String formatting (slugification)
```

## Core Components

### 1. ConfigManager
**Location**: `server/core/ConfigManager.ts`

Manages persistent gateway configurations stored in `~/.oc-mission-control/config.json`.

**Key Features**:
- Load/save gateway configurations
- Migration from environment variables
- Active gateway tracking

**API**:
```typescript
class ConfigManager {
  load(): void
  save(): void
  getGateways(): GatewayConfig[]
  getActiveGateway(): GatewayConfig | undefined
  addGateway(name: string, url: string, token: string): GatewayConfig
  switchGateway(id: string): boolean
  removeGateway(id: string): void
}
```

### 2. GatewayClient
**Location**: `server/core/GatewayClient.ts`

Robust WebSocket wrapper for OpenClaw Gateway communication.

**Key Features**:
- Automatic reconnection with exponential backoff
- RPC request/response management with timeout
- Event handling and broadcasting
- Activity log persistence
- Agent list caching
- Session transformation

**API**:
```typescript
class GatewayClient {
  connect(): void
  request(method: string, params: any): Promise<any>
  sendChat(agentId: string, message: string): Promise<{ok: boolean}>
  addClient(client: WebSocket): void
  removeClient(client: WebSocket): void
  broadcast(message: any): void
  fetchInitialData(): Promise<void>
}
```

### 3. WebSocketServer
**Location**: `server/core/WebSocketServer.ts`

Manages client WebSocket connections and routes messages to handlers.

**Key Features**:
- HTTP upgrade handling
- Message routing to domain-specific handlers
- Client lifecycle management

## Message Handlers

All client messages are routed through `server/handlers/index.ts` which dispatches to domain-specific handlers:

### Agent Handler
**Location**: `server/handlers/agent.handler.ts`

Handles agent lifecycle operations:
- `agents.add` - Create new agents with atomic initialization
- `agents.update` - Update agent properties
- `agents.delete` - Remove agents

### Chat Handler
**Location**: `server/handlers/chat.handler.ts`

Handles real-time chat messaging:
- `chat.send` - Send messages to agent sessions

### Session Handler
**Location**: `server/handlers/session.handler.ts`

Manages session operations:
- `sessions.list` - Retrieve all sessions
- `sessions.patch` - Update session settings (model, thinking, verbose, reasoning)

### Gateway Handler
**Location**: `server/handlers/gateway.handler.ts`

Manages gateway connections:
- `gateways.list` - List configured gateways
- `gateways.add` - Add new gateway
- `gateways.switch` - Switch active gateway
- `gateways.remove` - Remove gateway

### Models Handler
**Location**: `server/handlers/models.handler.ts`

Handles model operations:
- `models.list` - Retrieve available models from gateway

## Type System

### Gateway Types
**Location**: `server/types/gateway.ts`

Strongly-typed definitions for OpenClaw Gateway RPC protocol:
- Request/Response structures
- Agent, Session, Model types
- Config operations

### Internal Types
**Location**: `server/types/internal.ts`

Internal server type definitions:
- Client message types (union of all message types)
- Server message types (responses)
- Configuration structures
- Activity log types

## Development Workflow

### Development Mode
Uses `tsx` for hot-reloading TypeScript:
```bash
npm run dev
```

Server runs directly from TypeScript source with automatic restart on file changes.

### Production Build
Compiles TypeScript to JavaScript:
```bash
npm run build        # Builds both server and Next.js
npm run build:server # Builds server only
npm start           # Runs compiled server
```

Compiled output: `dist/server/`

## Key Design Patterns

### 1. Singleton Pattern
`ConfigManager` is instantiated once and shared across handlers via `handlers/index.ts`.

### 2. Registry Pattern
Message handlers are registered in a switch statement in `handlers/index.ts` for clean separation.

### 3. Promise-based RPC
Gateway requests return promises that resolve/reject based on WebSocket responses.

### 4. Event Broadcasting
Gateway events are forwarded to all connected clients for real-time updates.

## Health Check
The server exposes health endpoints at `/health` and `/api/health`:

```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "service": "mission-control",
  "version": "0.1.0",
  "gateway": {
    "connected": true,
    "name": "Local Gateway",
    "url": "ws://127.0.0.1:18789"
  }
}
```

## Environment Variables

- `OPENCLAW_GATEWAY_URL` - Gateway URL (auto-migrated to config on first run)
- `OPENCLAW_GATEWAY_TOKEN` - Gateway authentication token
- `PORT` - Server port (default: 3000)
- `NODE_ENV` - Environment mode (development/production)

## Persistence

### Gateway Configuration
**Location**: `~/.oc-mission-control/config.json`

Stores gateway configurations with tokens (encrypted in UI display).

### Activity Log
**Location**: `data/activity-history.json`

Stores recent agent activities (last 500 events) for persistence across restarts.

## Future Enhancements

- Dependency injection container for service management
- Enhanced error recovery and retry logic
- Rate limiting and request queuing
- Metrics and observability hooks
- WebSocket client authentication
