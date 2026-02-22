# OpenClaw MC Architecture

## Overview

OpenClaw MC is a Next.js-based web application providing real-time monitoring and management for OpenClaw Gateway agents. The architecture emphasizes modularity, real-time communication, and extensibility.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Browser (Client)                      │
│  ┌─────────────────────────────────────────────────┐   │
│  │            React Application (Next.js)           │   │
│  │  - Components (Chat, Panels, Extensions)         │   │
│  │  - Contexts (Panel, Extension, Gateway)          │   │
│  │  - Hooks (Events, Settings, Extensions)          │   │
│  │  - IndexedDB (UI State, Extension Data)          │   │
│  │  - Encrypted Storage (Tokens, Keys)              │   │
│  └─────────────────────────────────────────────────┘   │
│                         │                                │
│                    WebSocket                             │
│                         │                                │
└─────────────────────────┼────────────────────────────────┘
                          │
┌─────────────────────────┼────────────────────────────────┐
│                    Node.js Server                        │
│  ┌─────────────────────────────────────────────────┐   │
│  │         Custom Server + Next.js Handler          │   │
│  │  - Gateway Client (WebSocket Management)         │   │
│  │  - RPC Handlers (Chat, Agents, Models)           │   │
│  │  - Event Forwarding (Agent, Tool, Reasoning)     │   │
│  │  - Config Manager (Gateway Settings)             │   │
│  └─────────────────────────────────────────────────┘   │
│                         │                                │
│                    WebSocket                             │
│                         │                                │
└─────────────────────────┼────────────────────────────────┘
                          │
┌─────────────────────────┼────────────────────────────────┐
│               OpenClaw Gateway                           │
│  - Agent Management                                      │
│  - Tool Execution                                        │
│  - Model Routing                                         │
│  - Session Management                                    │
└──────────────────────────────────────────────────────────┘
```

## Core Components

### 1. Client Layer (Browser)

#### React Application

- **Framework**: Next.js 15 with React 19 RC
- **Styling**: Tailwind CSS v4
- **UI Components**: Radix UI primitives

#### Component Structure

```
components/
├── agents/           # Agent selection and management
├── chat/             # Chat interface and messaging
├── extensions/       # Extension UI components
├── gateway/          # Gateway configuration
├── layout/           # Status bar and layout
├── mobile/           # Mobile-specific UI
├── panels/           # Panel system
└── statusbar/        # Status bar controls
```

#### Context Providers

```
contexts/
├── PanelContext.tsx        # Panel management
└── ExtensionContext.tsx    # Extension lifecycle
```

#### Custom Hooks

```
hooks/
├── useGatewayWebSocket.ts     # WebSocket connection
├── useAgentEvents.ts          # Agent event handling
├── useSessionSettings.ts      # Session configuration
├── useExtensionStatusBar.ts   # Extension status bar
└── useExtensionChatInput.ts   # Extension chat tagging
```

#### State Management

- **Local State**: React useState/useReducer
- **Persistent State**: IndexedDB (via `idb` library)
- **Real-time State**: WebSocket events

#### Data Persistence

##### IndexedDB (UI State)

```javascript
Store: 'openclaw-ui-state' (v4)
├── scroll-positions      # Chat scroll positions
├── drafts                # Message drafts
├── tool-cards            # Tool card expanded state
├── last-seen             # Last seen messages
├── stream-states         # Streaming state
├── workspace             # Panel layout
├── extension-states      # Extension enabled/onboarded
└── extension-configs     # Extension configurations
```

##### Encrypted Storage (Tokens/Keys)

- **Implementation**: Web Crypto API (AES-GCM)
- **Storage**: localStorage with encryption
- **Usage**: Extension API tokens, sensitive credentials

### 2. Server Layer (Node.js)

#### Custom Server

- **Runtime**: Node.js with TypeScript
- **WebSocket**: Native `ws` library
- **Server File**: `server/index.ts`

#### Gateway Client

```typescript
server/core/GatewayClient.ts
- WebSocket connection to OpenClaw Gateway
- Authentication with bearer token
- RPC request/response handling
- Event streaming
- Reconnection logic
```

#### RPC Handlers

```
server/handlers/
├── chat.handler.ts      # Chat send/abort
├── agents.handler.ts    # Agent list/sessions
├── models.handler.ts    # Model list
└── gateway.handler.ts   # Gateway config
```

#### Configuration

```typescript
~/.oc-mission-control/config.json
{
  "gateways": [
    {
      "id": "uuid",
      "name": "Gateway Name",
      "url": "ws://...",
      "token": "...",
      "isLocal": true
    }
  ],
  "activeGatewayId": "uuid"
}
```

### 3. Extensions System

#### Architecture

```
┌─────────────────────────────────────────────────────┐
│           Extension Registry (Singleton)             │
│  - Register/unregister extensions                    │
│  - Load/unload lifecycle                             │
│  - State management                                  │
│  - Hook access                                       │
└─────────────────────────────────────────────────────┘
                        │
        ┌───────────────┼───────────────┐
        │               │               │
┌───────▼───────┐ ┌────▼─────┐ ┌──────▼──────┐
│ Status Bar    │ │ Chat     │ │ Onboarding  │
│ Hook System   │ │ Input    │ │ Hook System │
│               │ │ Hook     │ │             │
└───────────────┘ └──────────┘ └─────────────┘
```

#### Extension Structure

```
extensions/{name}/
├── manifest.json       # Metadata and permissions
├── config.ts           # Configuration interface
├── api.ts              # Read-only API client
├── setup.ts            # Initialization logic
├── ui/
│   ├── status-bar.tsx  # Status bar integration
│   ├── chat-input.tsx  # Chat tagging
│   └── onboarding.tsx  # Setup wizard
└── index.ts            # Entry point
```

#### Extension Hooks

**Status Bar Hook**

- Provides real-time data for status bar
- Returns: icon, value, dropdown items
- Actions: copy, open URL

**Chat Input Hook**

- Provides @ tagging options
- Triggered on @ character
- Returns: tag, value, description

**Onboarding Hook**

- Setup wizard for configuration
- Validates credentials
- Saves encrypted tokens

#### Security Model

**Principles**:

1. Read-only access (no mutations)
2. Encrypted credential storage
3. Permission declarations
4. Input sanitization
5. Rate limiting awareness

**Token Storage**:

```typescript
SecureStorage.setItem(extensionName, key, value);
// Uses Web Crypto API for encryption
// Stored in localStorage with encryption
```

**State Persistence**:

```typescript
uiStateStore.saveExtensionState(state);
uiStateStore.saveExtensionConfig(name, config);
// Stored in IndexedDB
// Non-sensitive data only
```

## Communication Flow

### 1. WebSocket Messages (Client ↔ Server)

#### RPC Format

```json
{
  "jsonrpc": "2.0",
  "id": "unique-id",
  "method": "chat.send",
  "params": {
    "agentId": "agent-id",
    "message": "Hello"
  }
}
```

#### Response Format

```json
{
  "jsonrpc": "2.0",
  "id": "unique-id",
  "result": {
    "success": true
  }
}
```

#### Event Format

```json
{
  "jsonrpc": "2.0",
  "method": "event",
  "params": {
    "type": "agent",
    "event": "chunk",
    "agentId": "agent-id",
    "data": { ... }
  }
}
```

### 2. Gateway Communication (Server ↔ Gateway)

#### Authentication

```
Authorization: Bearer {token}
```

#### RPC Methods

- `agents` - List agents
- `sessions.list` - Get sessions
- `sessions.patch` - Update settings
- `models.list` - Get models
- `chat.send` - Send message
- `chat.abort` - Stop execution

#### Event Types

- `agent` events - Agent lifecycle, chunks
- `tool` events - Tool calls, results
- `reasoning` events - Thinking process
- `chat` events - Message completion

### 3. Extension Communication

#### Status Bar Updates

```typescript
// Extension provides data
hooks.statusBar() → StatusBarItem

// UI renders item
<ExtensionStatusBarItem item={item} />

// User clicks
onCopy(item.copyValue) → navigator.clipboard
onOpen(item.openUrl) → window.open()
```

#### Chat Input Tagging

```typescript
// User types @
onInput('@PR') → isTagging = true

// Extension searches
hooks.chatInput('PR') → ChatInputTagOption[]

// UI shows dropdown
<ChatInputTagDropdown options={options} />

// User selects
onSelect(option) → insertTag(option.tag)
```

## Data Flow

### Message Sending Flow

```
1. User types message in ChatInput
2. ChatInput calls onSend(message, attachments)
3. ChatPanel dispatches sendMessage RPC
4. Server forwards to GatewayClient
5. GatewayClient sends to OpenClaw Gateway
6. Gateway processes and streams events
7. Server forwards events to client
8. useAgentEvents handles events
9. UI updates with new messages/tools
```

### Extension Data Flow

```
1. Extension registered in registry
2. Registry calls extension.setup()
3. Extension initializes API client
4. Hook is called (e.g., statusBar())
5. Extension fetches data from API
6. Returns formatted StatusBarItem
7. useExtensionStatusBar receives item
8. ExtensionStatusBarItem renders UI
9. User interacts (copy/open)
10. Callback executes action
```

## State Management

### Panel State

```typescript
PanelContext
├── panels: Panel[]
├── activePanel: string | null
├── openPanel(type, data) → string
├── closePanel(panelId) → void
└── updatePanelSettings(id, settings) → void
```

### Extension State

```typescript
ExtensionContext
├── extensions: Extension[]
├── enabledExtensions: Extension[]
├── enableExtension(name) → Promise<void>
├── disableExtension(name) → Promise<void>
└── completeOnboarding(name) → Promise<void>
```

### Agent State

```typescript
useAgentEvents
├── chatHistory: Message[]
├── activeRunId: string | null
├── assistantStream: string
├── reasoningStream: string
├── toolCalls: ToolCall[]
└── sendMessage(message) → void
```

## Performance Optimizations

### 1. Component Memoization

```typescript
React.memo(ChatMessageItem, (prev, next) => prev.id === next.id && prev.content === next.content);
```

### 2. Debouncing

```typescript
// Chat input height adjustment
requestAnimationFrame(() => {
  textarea.style.height = "auto";
});

// Extension search queries
debounce(searchQuery, 300);
```

### 3. Virtual Scrolling

- Auto-scroll only when near bottom
- Preserve scroll position on updates
- Smooth scroll to bottom button

### 4. Extension Caching

```typescript
// Cache API responses
private cache = new Map<string, any>();

// Rate limiting
private minInterval = 1000; // ms between requests
```

## Security Considerations

### 1. Gateway Authentication

- Bearer token authentication
- Tokens stored in secure config file
- Never exposed in client code

### 2. Extension Security

- Encrypted token storage (Web Crypto API)
- Read-only API permissions
- Input validation and sanitization
- No direct DOM manipulation

### 3. XSS Prevention

- React's built-in escaping
- Markdown sanitization (react-markdown)
- Content Security Policy headers

### 4. CORS Handling

- Gateway must enable CORS for browser access
- WebSocket connections require proper origins
- Extensions use browser's fetch API

## Deployment

### Development

```bash
npm run dev
# Runs on http://localhost:3000
```

### Production

```bash
npm run build
npm start
# Runs on configured PORT (default 3000)
```

### Docker

```bash
docker build -t mission-control .
docker run -p 3000:3000 mission-control
```

### Environment Variables

```env
OPENCLAW_GATEWAY_URL=http://127.0.0.1:18789
OPENCLAW_GATEWAY_TOKEN=your_token_here
PORT=3000
NODE_ENV=production
DEBUG_GATEWAY_EVENTS=false
```

## Monitoring and Debugging

### Client-Side Logging

```javascript
console.log("[ComponentName] Message", data);
```

### Server-Side Logging

```javascript
console.log("[GatewayClient] Connected");
```

### Extension Logging

```javascript
console.log("[ExtensionName] Action", result);
```

### Browser DevTools

- Network tab: WebSocket messages
- Application tab: IndexedDB inspection
- Console: All logs and errors

## Testing Strategy

### Manual Testing

- UI interaction testing
- WebSocket connection testing
- Extension integration testing
- Multi-gateway switching

### Extension Testing

- Connection validation
- Data fetching
- UI rendering
- Error handling
- Security compliance

## Future Enhancements

### Planned Features

- Multiple simultaneous extensions
- Extension marketplace
- Extension permissions UI
- Extension update mechanism
- Extension analytics

### Extension Ideas

- GitLab integration
- Jira/Linear integration
- Dockploy deployments
- Slack notifications
- Custom webhooks

## Architecture Decisions

### Why Next.js?

- Server-side rendering support
- Built-in routing
- API routes (if needed)
- React ecosystem
- Hot module replacement

### Why Custom Server?

- Need persistent WebSocket connections
- Gateway connection management
- Event streaming
- File-based configuration

### Why IndexedDB?

- Browser-native persistence
- Async API
- Large storage capacity
- Structured data storage

### Why Web Crypto API?

- Browser-native encryption
- Strong security (AES-GCM)
- No external dependencies
- Cross-browser support

### Why Extension System?

- Modularity and isolation
- Third-party integrations
- User customization
- Read-only safety model
- Easy to add/remove features

## Extension Panel System

### Panel UX Rules

Extension panels are host-owned UI surfaces opened from the extension status bar menu.

1. **Open Panel entry**: Every extension that declares `panels` in its manifest gets an "Open Panel" submenu item automatically injected into its status bar dropdown by `useExtensionStatusBar`.
2. **Host renders `PanelHeader`**: `PanelContainer` always wraps extension panels with `PanelHeader` — extensions only render the body component.
3. **Themed container**: Extension panel bodies are rendered inside a `bg-background text-foreground border-border` container so they inherit app theming automatically.
4. **Write operations in panels only**: Write actions are not permitted in status bar dropdowns or chat input — only inside extension panels.
5. **Write consent gate**: When a panel declares `requiresWrite: true` in the manifest, the host shows a one-time `ConfirmationModal` before opening. Consent is stored per-panel in `ExtensionState.writeConsent` (persisted to IndexedDB). Subsequent opens skip the gate.

### Consent Storage

Write consent is stored in the extension state object under `writeConsent: Record<string, boolean>` where the key is `panelId`. Helpers:
- `extensionRegistry.checkWriteConsent(extensionName, panelId)` — synchronous check
- `extensionRegistry.grantWriteConsent(extensionName, panelId)` — async, persists to IndexedDB
- `useExtensions().getWriteConsent(extensionName, panelId)` — React context helper
- `useExtensions().grantWriteConsent(extensionName, panelId)` — React context helper

## References

- [Next.js Documentation](https://nextjs.org/docs)
- [React Documentation](https://react.dev)
- [Tailwind CSS](https://tailwindcss.com)
- [Radix UI](https://www.radix-ui.com)
- [Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API)
- [IndexedDB API](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)
- [WebSocket Protocol](https://developer.mozilla.org/en-US/docs/Web/API/WebSocket)
