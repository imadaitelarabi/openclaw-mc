# Refactor Chat Streaming and History Management

## Overview
Simplify the `openclaw-mc` chat architecture by decoupling live streaming (active run) from persistent history. The current implementation uses complex deduplication and merging logic (`SYNC_RECENT_CHAT_HISTORY`, `FINALIZE_ASSISTANT_MESSAGE`) to synthesize history from streams.

This refactor proposes a **"Stream-to-Commit"** strategy where active runs are rendered in an ephemeral overlay ("Ghost Bubble") and only committed to the history list when specific lifecycle events occur.

## Architecture Change

### Current (Complex)
- **State:** Single `chatHistory` array.
- **Logic:** Stream deltas are merged into history items in real-time.
- **Problem:** Requires fuzzy matching (`isLikelySameUserMessage`), manual deduping, and complex reducer logic to prevent UI jitter.

### Proposed (Simplified)
- **State:** 
  - `chatHistory`: Array of completed messages (Source of Truth).
  - `activeRun`: Object tracking current stream state (`thinking` | `tool` | `text`).
- **UI:**
  - **History List:** Renders `chatHistory`. Only updates on `chat_history` load or explicit `ADD_CHAT_MESSAGE` actions.
  - **ActiveRunOverlay:** Renders `activeRun` data at the bottom of the list.

## Implementation Details

### 1. The "Commit" Strategy
Instead of merging, we listen for specific lifecycle ends to "commit" the active stream to history.

#### A. Thinking (Reasoning)
- **Stream:** Update `activeRun.content` with `reasoning` deltas.
- **Display:** `<ReasoningCard isStreaming />` in Overlay.
- **Commit:** On stream switch (to tool/text) or end, dispatch `ADD_CHAT_MESSAGE` with full reasoning.

#### B. Tool Execution
- **Stream:** Update `activeRun.tool` with `phase: "start"`.
- **Display:** `<ToolCard status="running" />` in Overlay.
- **Commit:** On `phase: "result"`, dispatch `ADD_CHAT_MESSAGE` with the tool result (Gateway sends `toolResult` role).

#### C. Assistant Response
- **Stream:** Update `activeRun.content` with `assistant` deltas.
- **Display:** Markdown block with blinking cursor in Overlay.
- **Commit:** On `lifecycle: "end"`, dispatch `ADD_CHAT_MESSAGE` with final text.

### 2. Component Changes
- **`useAgentEvents.ts`**: Remove `SYNC_RECENT_CHAT_HISTORY` and `FINALIZE_...` logic. Add `activeRun` state management.
- **`ChatPanel.tsx`**: Add `<ActiveRunOverlay />` below the history list.
- **`ActiveRunOverlay.tsx`**: New component that switches between `<ReasoningCard>`, `<ToolCard>`, and Markdown based on `activeRun.status`.

## Benefits
1.  **Simpler Code:** Removes ~40% of reducer logic (fuzzy matching, merging).
2.  **Better UX:** "Spinner" -> "Snap" -> "Result" transition is smoother than updating a list item in place.
3.  **Performance:** Updates a single overlay component instead of re-rendering the heavy history list during streaming.
