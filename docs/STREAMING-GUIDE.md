# OpenClaw MC - Streaming & Thinking Implementation Guide

Based on OpenClaw Gateway documentation analysis.

---

## 🧠 Handling Thinking/Reasoning

### Event Structure

OpenClaw separates **thinking/reasoning** from regular assistant content:

```javascript
// Agent event with reasoning stream
{
  event: 'agent',
  payload: {
    stream: 'reasoning',  // Separate stream for thinking
    data: {
      delta: 'thinking chunk...',
      text: 'full reasoning text'
    },
    runId: '...',
    sessionKey: 'agent:new-agent-2:main'
  }
}
```

### Key Facts from Docs

1. **Thinking is a separate stream** (`stream: 'reasoning'`)
2. **Thinking tags (`<think>...</think>`) should NOT be in assistant text**
   - They're an artifact of older parsing
   - Modern OpenClaw sends reasoning as a separate event
3. **Reasoning visibility controlled by `/reasoning` directive:**
   - `off` (default): reasoning not sent
   - `on`: reasoning sent as separate message with "Reasoning:" prefix
   - `stream` (Telegram only): streams into draft bubble

### Implementation Fix

**Current (Incorrect):**

```typescript
// ❌ Parsing <think> tags from assistant text
const thinkMatch = content.match(/<think>([\s\S]*?)<\/think>/i);
```

**Correct Implementation:**

```typescript
const handleRawEvent = (message: any) => {
  const { event, payload } = message;

  if (event === "agent" && payload.stream === "reasoning") {
    // Handle reasoning separately
    const { runId, data } = payload;

    if (data?.delta) {
      // Stream reasoning deltas
      setReasoningStreams((prev) => ({
        ...prev,
        [agentId]: (prev[agentId] || "") + data.delta,
      }));
    } else if (data?.text) {
      // Final reasoning
      setChatHistory((prev) => {
        const currentHistory = prev[agentId] || [];
        return {
          ...prev,
          [agentId]: [
            ...currentHistory,
            {
              id: `${runId}-reasoning`,
              role: "reasoning",
              content: data.text,
              timestamp: Date.now(),
              runId,
            },
          ],
        };
      });
      setReasoningStreams((prev) => {
        const next = { ...prev };
        delete next[agentId];
        return next;
      });
    }
  }

  if (event === "agent" && payload.stream === "assistant") {
    // Assistant text should be clean (no <think> tags)
    const { data } = payload;
    if (data?.delta) {
      setChatStreams((prev) => ({
        ...prev,
        [agentId]: (prev[agentId] || "") + data.delta,
      }));
    }
  }
};
```

---

## 📡 Streaming Without Glitches

### Problem: Double Rendering / Glitches

From the docs, there are **multiple event types** that can overlap:

1. **`agent` events** with `stream: "assistant"` (streaming deltas)
2. **`chat` events** with `state: "delta"` (legacy wrapper)
3. **Final events** that might duplicate accumulated text

### Event Flow (from docs)

```
Agent Run
  ├─ agent { stream: 'lifecycle', data: { phase: 'start' } }
  ├─ agent { stream: 'assistant', data: { delta: 'Hello' } }
  ├─ agent { stream: 'assistant', data: { delta: ' world' } }
  ├─ agent { stream: 'tool', data: { phase: 'start', name: 'read' } }
  ├─ agent { stream: 'tool', data: { phase: 'end', name: 'read' } }
  ├─ agent { stream: 'assistant', data: { delta: '...' } }
  └─ agent { stream: 'lifecycle', data: { phase: 'end' } }
```

### Implementation Strategy

**1. Use Only `agent` Events (Ignore Legacy `chat` Events)**

The `chat` event is a **wrapper** that OpenClaw generates for backward compatibility. Modern implementations should use `agent` events directly.

```typescript
const handleRawEvent = (message: any) => {
  const { event, payload } = message;

  // Only process agent events
  if (event !== "agent") return;

  const { stream, data, runId, sessionKey } = payload;
  const agentId = extractAgentId(sessionKey);

  switch (stream) {
    case "assistant":
      handleAssistantStream(agentId, data, runId);
      break;
    case "tool":
      handleToolStream(agentId, data, runId);
      break;
    case "reasoning":
      handleReasoningStream(agentId, data, runId);
      break;
    case "lifecycle":
      handleLifecycle(agentId, data, runId);
      break;
  }
};
```

**2. Delta Accumulation Pattern**

```typescript
const handleAssistantStream = (agentId: string, data: any, runId: string) => {
  if (data?.delta) {
    // Accumulate deltas in temporary state
    setChatStreams((prev) => ({
      ...prev,
      [`${agentId}-${runId}`]: (prev[`${agentId}-${runId}`] || "") + data.delta,
    }));
  }

  // Note: Do NOT create a final message here
  // Wait for lifecycle 'end' event
};
```

**3. Finalize on Lifecycle End**

```typescript
const handleLifecycle = (agentId: string, data: any, runId: string) => {
  if (data.phase === "end") {
    // Move accumulated stream to final history
    setChatHistory((prev) => {
      const streamKey = `${agentId}-${runId}`;
      const accumulatedText = chatStreams[streamKey] || "";

      if (!accumulatedText) return prev;

      const currentHistory = prev[agentId] || [];

      // Check if already exists (prevent duplicates)
      if (currentHistory.some((m) => m.runId === runId && m.role === "assistant")) {
        return prev;
      }

      return {
        ...prev,
        [agentId]: [
          ...currentHistory,
          {
            id: runId,
            role: "assistant",
            content: accumulatedText,
            timestamp: Date.now(),
            runId,
          },
        ],
      };
    });

    // Clear stream
    setChatStreams((prev) => {
      const next = { ...prev };
      delete next[`${agentId}-${runId}`];
      return next;
    });
  }
};
```

**4. Render Streaming Text Separately**

```tsx
{
  /* History messages */
}
{
  (chatHistory[selectedAgent] || []).map((msg) => <MessageBubble key={msg.id} message={msg} />);
}

{
  /* Active streaming (ephemeral) */
}
{
  chatStreams[`${selectedAgent}-${currentRunId}`] && (
    <div className="streaming-message opacity-80">
      <Markdown>{chatStreams[`${selectedAgent}-${currentRunId}`]}</Markdown>
      <span className="animate-pulse">▊</span>
    </div>
  );
}
```

---

## 📊 Complete Event Handling Architecture

### State Management

```typescript
interface ChatState {
  // Finalized messages
  chatHistory: Record<agentId, ChatMessage[]>;

  // Active streams (keyed by agentId-runId)
  chatStreams: Record<string, string>; // assistant deltas
  reasoningStreams: Record<string, string>; // reasoning deltas
  toolStatus: Record<string, ToolState>; // tool phase tracking

  // Run tracking
  activeRuns: Record<agentId, string>; // current runId per agent
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "tool" | "reasoning";
  content: string;
  timestamp: number;
  runId?: string;
  tool?: ToolInfo;
}

interface ToolState {
  runId: string;
  name: string;
  phase: "start" | "update" | "end";
  args?: any;
  result?: any;
}
```

### Deduplication Strategy

**Key by `runId`:**

- Each assistant response has a unique `runId`
- Never add duplicate messages with the same `runId` + `role`

**Stream Key:**

- Use `${agentId}-${runId}` for stream accumulation
- Prevents collision when multiple agents are active

**Tool Deduplication:**

- Use `${runId}-${toolName}-${seq}` as tool message ID
- Only create tool cards on `phase: 'start'`
- Update existing card on `phase: 'update'` or `phase: 'end'`

---

## 🎯 Implementation Checklist

- [ ] Remove `<think>` tag parsing from assistant content
- [ ] Add `stream: 'reasoning'` handler
- [ ] Add `stream: 'lifecycle'` handler
- [ ] Remove legacy `event: 'chat'` handling
- [ ] Change stream key from `agentId` to `${agentId}-${runId}`
- [ ] Only finalize messages on `lifecycle { phase: 'end' }`
- [ ] Add runId-based deduplication checks
- [ ] Separate streaming UI from finalized history
- [ ] Add reasoning message type to ChatMessage interface
- [ ] Update tool handling to track phase transitions
- [ ] Add visual distinction for reasoning vs assistant content

---

## 🔍 Testing Strategy

1. **Send simple message** → verify single delta stream, single final message
2. **Send with tool usage** → verify tool cards appear before assistant text
3. **Enable `/reasoning on`** → verify reasoning appears as separate message
4. **Rapid succession** → verify no duplicate messages, proper runId separation
5. **Long response** → verify no text duplication or glitches during streaming
6. **Network lag simulation** → verify accumulated deltas handle delays gracefully

---

## 📚 References

- OpenClaw Docs: `/usr/lib/node_modules/openclaw/docs/concepts/streaming.md`
- Agent Loop: `/usr/lib/node_modules/openclaw/docs/concepts/agent-loop.md`
- Messages: `/usr/lib/node_modules/openclaw/docs/concepts/messages.md`
- Thinking: `/usr/lib/node_modules/openclaw/docs/tools/thinking.md`
- Control UI: `/usr/lib/node_modules/openclaw/docs/web/control-ui.md`
