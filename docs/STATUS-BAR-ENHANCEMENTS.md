# Mission Control - Status Bar Enhancements

## Features to Add

Based on OpenClaw Gateway documentation:

### 1. **Model Selection**
- Display current model for selected agent
- Dropdown with search to switch models
- Get models from `models.list` Gateway RPC
- Set per-session model override via `session_status` tool with `model` parameter
- Show model aliases (opus, sonnet, gemini, etc.)

### 2. **Model Selection Per Agent**
- Each agent can have a different model
- Retrieved from session metadata
- Use `sessions.list` RPC to get current sessions with metadata
- Use `sessions.patch` RPC to update model per session

### 3. **Thinking Mode Toggle**
- Per-agent/session setting
- Modes: `off`, `low`, `medium`, `high`
- Retrieved via `sessions.list` (includes `thinking` field)
- Updated via `sessions.patch` with `{ thinking: "low" | "medium" | "high" | "off" }`

### 4. **Verbose Mode Toggle** 
- Per-agent/session setting
- Modes: `on`, `off`, `inherit`
- Retrieved via `sessions.list` (includes `verbose` field)  
- Updated via `sessions.patch` with `{ verbose: "on" | "off" | "inherit" }`

---

## Gateway RPC Methods Needed

### `models.list`
Returns list of available models from config.

**Request:**
```typescript
{
  type: 'req',
  id: 'uuid',
  method: 'models.list',
  params: {}
}
```

**Response:**
```typescript
{
  models: [
    {
      id: 'anthropic/claude-sonnet-4-5',
      alias: 'sonnet',
      provider: 'anthropic',
      // ... other metadata
    },
    // ...
  ]
}
```

### `sessions.list`
Returns list of active sessions with metadata.

**Request:**
```typescript
{
  type: 'req',
  id: 'uuid',
  method: 'sessions.list',
  params: {}
}
```

**Response:**
```typescript
{
  sessions: [
    {
      sessionId: '...',
      key: 'agent:new-agent-2:main',
      kind: 'main',
      model: 'anthropic/claude-sonnet-4-5', // Current model override (if set)
      thinking: 'low',  // Current thinking mode
      verbose: 'off',   // Current verbose mode
      // ... other fields
    }
  ]
}
```

### `sessions.patch`
Update session settings (model, thinking, verbose).

**Request:**
```typescript
{
  type: 'req',
  id: 'uuid',
  method: 'sessions.patch',
  params: {
    sessionKey: 'agent:new-agent-2:main',  // or sessionId
    model: 'anthropic/claude-opus-4-6',    // Optional: change model
    thinking: 'high',                       // Optional: change thinking mode
    verbose: 'on'                           // Optional: change verbose mode
  }
}
```

**Response:**
```typescript
{
  success: true
}
```

---

## Implementation Plan

### 1. Add Gateway RPC Methods to Server
```typescript
// mission-control/server.js

async request(method, params) {
  return new Promise((resolve, reject) => {
    const id = uuidv4();
    this.pending.set(id, { resolve, reject });
    this.ws.send(JSON.stringify({
      type: 'req',
      id,
      method,
      params
    }));
  });
}

// Add methods
async getModels() {
  return this.request('models.list', {});
}

async getSessions() {
  return this.request('sessions.list', {});
}

async patchSession(sessionKey, patch) {
  return this.request('sessions.patch', { sessionKey, ...patch });
}
```

### 2. Add WebSocket Message Handler
```typescript
// Handle RPC responses
case 'rep':
  const { id, result, error } = message;
  const pending = this.pending.get(id);
  if (pending) {
    this.pending.delete(id);
    if (error) pending.reject(error);
    else pending.resolve(result);
  }
  break;
```

### 3. Create Status Bar Enhancement Components

```
components/
└── statusbar/
    ├── ModelSelector.tsx     # Model dropdown with search
    ├── ThinkingToggle.tsx    # Thinking mode toggle
    └── VerboseToggle.tsx     # Verbose mode toggle
```

### 4. Add State Management Hook
```typescript
// hooks/useSessionSettings.ts
export function useSessionSettings(selectedAgent, sendRequest) {
  const [models, setModels] = useState([]);
  const [sessionSettings, setSessionSettings] = useState({});
  
  // Fetch models on mount
  useEffect(() => {
    sendRequest('models.list', {}).then(data => {
      setModels(data.models || []);
    });
  }, []);
  
  // Fetch session settings for selected agent
  useEffect(() => {
    if (!selectedAgent) return;
    sendRequest('sessions.list', {}).then(data => {
      const agentSession = data.sessions.find(s => 
        s.key.includes(selectedAgent)
      );
      if (agentSession) {
        setSessionSettings({
          model: agentSession.model,
          thinking: agentSession.thinking,
          verbose: agentSession.verbose
        });
      }
    });
  }, [selectedAgent]);
  
  const updateSetting = async (sessionKey, patch) => {
    await sendRequest('sessions.patch', { sessionKey, ...patch });
    // Refresh settings
    // ...
  };
  
  return { models, sessionSettings, updateSetting };
}
```

### 5. Update StatusBar Component
```tsx
<StatusBar
  // ... existing props
  models={models}
  currentModel={sessionSettings.model}
  thinkingMode={sessionSettings.thinking}
  verboseMode={sessionSettings.verbose}
  onModelChange={(model) => updateSetting(sessionKey, { model })}
  onThinkingChange={(thinking) => updateSetting(sessionKey, { thinking })}
  onVerboseChange={(verbose) => updateSetting(sessionKey, { verbose })}
/>
```

---

## UI Design

### Model Selector
```
┌─────────────────────────────┐
│ 🤖 Model: Sonnet 4.5    ▼  │  ← Click to open
└─────────────────────────────┘

Opens dropdown:
┌─────────────────────────────┐
│ Search models...            │
├─────────────────────────────┤
│ ✓ Sonnet 4.5 (current)     │
│   Opus 4.6                  │
│   Gemini 3 Pro              │
│   Gemini 3 Flash            │
│   GPT-5.2                   │
│   GPT-5 Mini                │
└─────────────────────────────┘
```

### Thinking Mode Toggle
```
🧠 Think: [Low] [Med] [High] [Off]
         ^^^^^ (active, highlighted)
```

### Verbose Mode Toggle
```
📊 Verbose: [On] [Off] [Inherit]
           ^^^^ (active, highlighted)
```

---

## Config Context from Docs

- Default thinking: `agents.defaults.thinkingDefault` (low/medium/high/off)
- Default verbose: `agents.defaults.verboseDefault` (on/off)
- Model list: `agents.defaults.models` (object with model IDs as keys)
- Model aliases: `agents.defaults.models[model].alias`
- Per-session overrides persist until session is deleted or reset

---

## Next Steps

1. Update `server.js` to handle RPC request/response pattern
2. Create `useSessionSettings` hook
3. Create `ModelSelector`, `ThinkingToggle`, `VerboseToggle` components
4. Update `StatusBar` to include new controls
5. Test with Gateway RPC
