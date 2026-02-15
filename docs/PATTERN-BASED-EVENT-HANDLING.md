# Pattern-Based Event Handling

This document describes the pattern-based event handling system for thinking and tool events in Mission Control.

## Overview

The pattern-based event handling system provides a structured pipeline for processing `chat` and `agent` events with:
- Tag-based Markdown formatting for different event types
- Per-run deduplication to prevent duplicate rendering
- Live thinking traces with commit phase
- Tool call and result tracking with metadata

## Architecture

### Server-Side Components

#### 1. Event Formatting (`server/utils/event-formatting.ts`)

Provides utilities for creating tagged Markdown messages:

```typescript
// Tag types
[[trace]]     // For reasoning/thinking blocks
[[tool]]      // For tool calls (name + arguments)
[[tool-result]]  // For tool outputs (exit codes + CWD + result text)
[[meta]]      // For internal metadata (timestamps, duration)
```

**Functions:**
- `formatTrace(content: string)` - Format thinking/reasoning text
- `formatToolCall(name: string, args?: any)` - Format tool invocation
- `formatToolResult(data: ToolResultData)` - Format tool output with metadata
- `formatMeta(data: MetaData)` - Format metadata
- `parseTaggedMessage(message: string)` - Parse tagged messages

#### 2. Deduplication Service (`server/utils/deduplication.ts`)

Maintains a set of seen lines per `runId` to prevent double-rendering:

```typescript
const deduplicationService = new DeduplicationService();

// Check if a line has been seen
if (deduplicationService.checkAndMark(runId, line)) {
  // Line is new, add to transcript
}

// Cleanup when run completes
deduplicationService.clearRun(runId);
```

#### 3. Message Extractor (`server/utils/message-extractor.ts`)

Extracts structured data from event payloads:

```typescript
// Extract thinking data
const thinking = extractThinking(payload);

// Extract tool data
const tool = extractTool(payload);

// Extract session info
const { agentId, runId, sessionKey } = extractSessionInfo(payload);

// Extract lifecycle phase
const { phase, error } = extractLifecycle(payload);
```

#### 4. Event Processor (`server/utils/event-processor.ts`)

Coordinates the entire pipeline:

```typescript
const processed = processEvent(eventType, payload);
// Returns:
// - type: 'runtime-chat' | 'runtime-agent' | 'unknown'
// - agentId, runId, sessionKey
// - formattedMessages: string[]
// - thinkingDelta?: string (for live updates)
// - thinkingComplete?: string (when committed)
```

**Key Features:**
- Buffers thinking deltas in memory per run
- Commits thinking to formatted trace on lifecycle end
- Applies deduplication automatically
- Cleans up resources when runs complete

### Frontend Components

#### 1. Event Formatting (`lib/event-formatting.ts`)

Client-side parsing of tagged messages:

```typescript
const parsed = parseTaggedMessage(message);
// Returns: { type, content, raw, toolName?, toolArgs?, toolMeta?, metaData? }
```

#### 2. Agent Events Hook (`hooks/useAgentEvents.ts`)

Enhanced with processed event support:

```typescript
const {
  chatHistory,
  chatStreams,
  reasoningStreams,
  thinkingTraces,  // NEW: Live thinking traces
  activeRuns,
  handleAgentEvent,
  addUserMessage
} = useAgentEvents();
```

**Event Flow:**
1. Receives `event.processed` messages from server
2. Updates `thinkingTraces` with live deltas
3. Commits completed thinking to `chatHistory` as reasoning messages
4. Handles tool calls and results with deduplication

#### 3. UI Components

**StreamingIndicator** - Shows live thinking traces:
```tsx
<StreamingIndicator 
  assistantStream={assistantStream}
  reasoningStream={reasoningStream}
  thinkingTrace={thinkingTrace}  // NEW
  isTyping={isTyping}
/>
```

**ChatPanel** - Passes thinking traces to indicator
**PanelContainer** - Routes thinking traces to panels

## Event Types

### Processed Events

The server sends `event.processed` messages with this structure:

```typescript
{
  type: 'event.processed',
  eventType: 'runtime-chat' | 'runtime-agent',
  agentId: string,
  runId: string,
  sessionKey: string,
  formattedMessages: string[],  // Tagged messages ready for display
  thinkingDelta?: string,        // Live thinking updates
  thinkingComplete?: string      // Finalized thinking content
}
```

### Tagged Message Format

#### Trace (Thinking/Reasoning)
```
[[trace]]
This is the agent's reasoning process...
Multiple lines are supported.
```

#### Tool Call
```
[[tool]] bash
Arguments: {
  "command": "ls -la",
  "description": "List files"
}
```

#### Tool Result
```
[[tool-result]]
Exit Code: 0 | Duration: 150ms | CWD: /workspace
total 48
drwxr-xr-x  4 user  staff   128 Jan 15 10:30 .
drwxr-xr-x 10 user  staff   320 Jan 15 10:25 ..
```

#### Meta
```
[[meta]] {"phase":"end","timestamp":1736938800000}
```

## Thinking Lifecycle

### Delta Phase (Live Updates)

1. Agent begins reasoning
2. Server buffers `reasoning.delta` events
3. Server sends `thinkingDelta` in processed events
4. Frontend accumulates in `thinkingTraces[streamKey]`
5. UI shows live reasoning box with streaming content

### Commit Phase (Finalization)

1. Run ends (lifecycle: end or chat: final)
2. Server formats buffered thinking as `[[trace]]`
3. Server sends `thinkingComplete` in processed event
4. Frontend adds to permanent `chatHistory` as reasoning message
5. `thinkingTraces[streamKey]` is cleared

## Deduplication

Prevents duplicate rendering by:
1. Creating hash of each formatted message
2. Storing in per-run Set
3. Checking before adding to transcript
4. Cleaning up Set when run completes

This handles cases where:
- Same tool call arrives via delta and final message
- Lifecycle end triggers duplicate commits
- Multiple event sources report same information

## Usage Examples

### Server-Side

```typescript
// In GatewayClient.handleGatewayEvent
const processed = processEvent(msg.event, msg.payload);

if (processed.formattedMessages.length > 0 || processed.thinkingDelta) {
  this.broadcast({
    type: 'event.processed',
    eventType: processed.type,
    agentId: processed.agentId,
    runId: processed.runId,
    sessionKey: processed.sessionKey,
    formattedMessages: processed.formattedMessages,
    thinkingDelta: processed.thinkingDelta,
    thinkingComplete: processed.thinkingComplete,
  });
}
```

### Frontend

```typescript
// In useAgentEvents
if (message.type === 'event.processed') {
  const { agentId, runId, thinkingDelta, thinkingComplete } = message;
  const streamKey = getStreamKey(agentId, runId);
  
  // Handle live thinking
  if (thinkingDelta) {
    setThinkingTraces(prev => ({
      ...prev,
      [streamKey]: (prev[streamKey] || '') + thinkingDelta
    }));
  }
  
  // Commit completed thinking
  if (thinkingComplete) {
    setChatHistory(prev => ({
      ...prev,
      [agentId]: [...prev[agentId], {
        id: `${runId}-reasoning-trace`,
        role: 'reasoning',
        content: thinkingComplete,
        timestamp: Date.now(),
        runId
      }]
    }));
  }
}
```

## Benefits

1. **No Duplicates** - Deduplication ensures each event appears exactly once
2. **Live Updates** - Thinking traces stream in real-time
3. **Clean Transcripts** - Tagged format makes parsing and styling easy
4. **Metadata Rich** - Tool results include exit codes, duration, CWD
5. **Backward Compatible** - Old event format still works alongside new

## Future Enhancements

- [ ] Add more tag types (error, warning, info)
- [ ] Support nested tool calls
- [ ] Add trace collapsing/expansion controls
- [ ] Implement trace search and filtering
- [ ] Add trace export functionality

## Studio Pattern Enhancements

### Chat Events as Source of Truth

Chat events with `state === 'final'` serve as the definitive version of a conversation turn. The event processor handles these specially:

```typescript
if (type === 'runtime-chat' && runId && payload.state === 'final') {
  const message = payload.message;
  const extracted = extractFromMessage(message);
  
  // Process thinking and tools from final message
  // These go through deduplication to avoid double-rendering
}
```

This ensures that anything missed during live streaming (due to network issues or timing) is captured from the final authoritative message.

### Separate Tool Results

Following the Studio pattern, tool results are separate transcript items rather than updates to tool calls:

```typescript
// Tool call
[[tool]] bash
Arguments: {"command": "ls"}

// ... other events may occur here ...

// Tool result (separate, chronological)
[[tool-result]]
Exit Code: 0 | Duration: 150ms
total 48
```

This maintains chronological order and allows for thinking or other actions between call and result.

### Buffer Memory Management

Thinking buffers now include timestamps and automatic cleanup:

```typescript
interface ThinkingBuffer {
  content: string;
  timestamp: number;
}

const THINKING_BUFFER_TTL_MS = 300000; // 5 minutes
```

A background cleanup task runs every minute to remove stale buffers from runs that crashed or never sent terminal events.

### TranscriptItem Component

The new `TranscriptItem` component enables a simplified data model:

```typescript
// Future: simplify from complex objects to clean strings
const transcript: string[] = [
  "[[trace]]\nAgent reasoning...",
  "[[tool]] bash\nArguments: {...}",
  "[[tool-result]]\nExit: 0\noutput..."
];

// Render with TranscriptItem
{transcript.map((line, i) => (
  <TranscriptItem key={i} line={line} />
))}
```

This component parses the `[[tag]]` prefixes and renders appropriate UI elements.

