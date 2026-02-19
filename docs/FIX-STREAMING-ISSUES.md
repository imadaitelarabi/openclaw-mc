# Fix: ActiveRun Overlay Animations, Reasoning Sync, and History Duplication

## Context
Following the "Stream-to-Commit" refactor (#63), field testing has revealed three regression/gap issues regarding UI polish, data synchronization for non-streaming models, and state reconciliation.

## The Issues

### 1. Missing Animations (Typing & Loading)
**Observation:**
1.  **Typing Effect:** The text appears instantly in chunks rather than smoothly typing out character-by-character.
2.  **Loading Indicators:** The "three dots" bubble animation (indicating "Agent is thinking/working") is missing from the new Overlay when waiting for data.
**Requirement:** Restore both the smooth typing effect for text *and* the visual "working" indicators (pulsing dots/spinner) when the agent is busy but hasn't produced output yet.

### 2. Missing Reasoning (The "Silent Thought" Problem)
**Observation:** Some gateway configurations/models do not stream `reasoning` events (no `delta`). Reasoning blocks only appear in the finalized `chat_history` array on the server.
**Current Failure:** Since the "Commit Strategy" relies on stream transitions to commit data, if no reasoning stream arrives, nothing is committed. The reasoning block is lost until a full page refresh.
**Proposed Solution (Server-Side Simulation):**
Instead of polling from the client, we should implement a **Server-Side Simulator** in the `openclaw-mc` backend (Next.js API route / Proxy).
- The server will monitor the `chat_history`.
- When it detects a `reasoning` message in history that hasn't been broadcast as a stream:
  - It will **synthesize** `agent` stream events (`stream: "reasoning", delta: "..."`) and send them to the client via WebSocket.
- **Benefit:** The Client code remains clean (it just listens to streams). The Server bridges the gap until the OpenClaw Gateway supports native reasoning streams.

### 3. Duplication on History Load
**Observation:** When a new message is sent or history is refreshed, the "Official" history loads (containing the committed reasoning/response). However, the `ActiveRunOverlay` sometimes fails to clear or recognize that its content is now official.
**Result:** The user sees the message twice: once in the history list (final) and once in the overlay (stale).

---

## Technical Implementation Plan

### Fix 1: Restore Visuals
- **Component:** `ActiveRunOverlay.tsx`
- **Typing:** Wrap text rendering in a hook that interpolates the string length over time (smooth typewriter).
- **Loading:** Add a conditional "Three Dots" animation block that appears when `activeRun.status` is active but `content` is empty/stale.

### Fix 2: Server-Side Reasoning Stream Simulator
- **Location:** `openclaw-mc/server/handlers/agent.handler.ts` (or equivalent WS handler).
- **Logic:**
  - Create a background poller (or hook into the history-fetch cycle).
  - Compare the latest history against what has been streamed.
  - If a `reasoning` block is found in history but not streamed:
    - Break it into chunks.
    - Emit `agent` events with `stream: "reasoning"` to the connected client.
  - **Goal:** Simulate the Gateway's expected behavior so the Frontend "Stream-to-Commit" logic works without modification.

### Fix 3: State Reconciliation (The "Dedup" Logic)
- **Location:** `useAgentEvents.ts` -> `agentEventsReducer` -> `LOAD_CHAT_HISTORY` case.
- **Logic:** 
  When new history arrives:
  1. Identify messages in the payload that match the current `activeRunData.runId`.
  2. If the History contains the *full* content of the `ActiveRun`:
     - Dispatch `CLEAR_ACTIVE_RUN_DATA` (kill the ghost).
  3. If the History contains *part* (e.g., Reasoning is done, but Tool is starting):
     - Update `activeRunData` to remove the committed part (prevent double vision).
  
This ensures that "Loading History" is the **Ultimate Source of Truth** that overrides and cleans up any ephemeral overlay state.
