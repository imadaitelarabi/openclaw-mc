// Polling intervals
const HIGH_PRIORITY_INTERVAL_MS = 2000; // Visible/active panels
const LOW_PRIORITY_INTERVAL_MS = 30000; // Background/unfocused panels
const TICK_INTERVAL_MS = 2000; // How often the scheduler ticks
const POLL_COOLDOWN_MS = 2000; // Guard against overlapping in-flight requests

// Debug flag for development/troubleshooting
const DEBUG = process.env.NEXT_PUBLIC_DEBUG_POLLING === "true";

type SendFn = (msg: Record<string, unknown>) => void;

interface AgentEntry {
  agentId: string;
  sendMessage: SendFn;
  /** High-priority (2s) when true; low-priority (30s) when false. */
  isVisible: boolean;
  /** Timestamp of last completed poll request (0 = never). */
  lastPolledAt: number;
  /** Whether a request is currently in-flight. */
  isPollInFlight: boolean;
}

/**
 * Global singleton scheduler that coordinates chat history polling across all
 * open panels.  It runs a single shared timer instead of one independent timer
 * per panel, which makes it easy to implement priority tiers:
 *
 * - **High priority (visible panels)**: polled every 2s.
 * - **Low priority (background panels)**: polled every 30s.
 *
 * Each `useChatPolling` hook registers with this scheduler when its agent has
 * an active run and unregisters when the run ends or the component unmounts.
 */
class GlobalChatPollingScheduler {
  private agents = new Map<string, AgentEntry>();
  private tickTimer: ReturnType<typeof setInterval> | null = null;

  /**
   * Register an agent for polling, or update its config if already registered.
   * If this is a brand-new registration the agent will be polled on the very
   * next tick (which fires immediately when the first agent registers).
   */
  register(agentId: string, sendMessage: SendFn, isVisible: boolean): void {
    const existing = this.agents.get(agentId);
    if (existing) {
      // Already tracked – just refresh mutable fields.
      existing.sendMessage = sendMessage;
      existing.isVisible = isVisible;
      return;
    }

    this.agents.set(agentId, {
      agentId,
      sendMessage,
      isVisible,
      lastPolledAt: 0, // 0 triggers an immediate poll on the first tick
      isPollInFlight: false,
    });

    if (DEBUG) {
      console.log(`[GlobalScheduler] Registered ${agentId} (visible: ${isVisible})`);
    }

    this.startTick();
  }

  /**
   * Remove an agent from polling (run ended or panel unmounted).
   * Stops the shared timer when no agents remain.
   */
  unregister(agentId: string): void {
    this.agents.delete(agentId);

    if (DEBUG) {
      console.log(`[GlobalScheduler] Unregistered ${agentId}`);
    }

    if (this.agents.size === 0) {
      this.stopTick();
    }
  }

  /**
   * Change the polling priority for an already-registered agent.
   * Calling this when the agent is not registered is a safe no-op.
   */
  setVisible(agentId: string, isVisible: boolean): void {
    const entry = this.agents.get(agentId);
    if (entry && entry.isVisible !== isVisible) {
      entry.isVisible = isVisible;

      if (DEBUG) {
        console.log(`[GlobalScheduler] ${agentId} visibility → ${isVisible}`);
      }
    }
  }

  /**
   * Swap the sendMessage function for a registered agent.
   * Calling this when the agent is not registered is a safe no-op.
   */
  updateSendMessage(agentId: string, sendMessage: SendFn): void {
    const entry = this.agents.get(agentId);
    if (entry) {
      entry.sendMessage = sendMessage;
    }
  }

  // ── private helpers ─────────────────────────────────────────────────────────

  private pollAgent(entry: AgentEntry): void {
    if (entry.isPollInFlight) {
      if (DEBUG) {
        console.log(`[GlobalScheduler] Skipping ${entry.agentId} - poll already in flight`);
      }
      return;
    }

    entry.isPollInFlight = true;
    entry.lastPolledAt = Date.now();

    if (DEBUG) {
      console.log(
        `[GlobalScheduler] Polling ${entry.agentId} (visible: ${entry.isVisible}, priority: ${entry.isVisible ? "high" : "low"})`
      );
    }

    try {
      entry.sendMessage({
        type: "chat.history.load",
        agentId: entry.agentId,
        params: {
          sessionKey: `agent:${entry.agentId}:main`,
          limit: 10,
        },
      });
    } catch (err) {
      if (DEBUG) {
        console.error(`[GlobalScheduler] Error polling ${entry.agentId}:`, err);
      }
      entry.isPollInFlight = false;
      return;
    }

    // Release the in-flight guard after a cooldown window so that a slow/lost
    // response doesn't permanently block future polls for this agent.
    setTimeout(() => {
      entry.isPollInFlight = false;
    }, POLL_COOLDOWN_MS);
  }

  private tick(): void {
    const now = Date.now();
    for (const entry of this.agents.values()) {
      const interval = entry.isVisible ? HIGH_PRIORITY_INTERVAL_MS : LOW_PRIORITY_INTERVAL_MS;
      if (now - entry.lastPolledAt >= interval) {
        this.pollAgent(entry);
      }
    }
  }

  private startTick(): void {
    if (this.tickTimer) return;
    // Fire the first tick immediately so newly registered agents are polled
    // right away rather than waiting a full interval.
    this.tick();
    this.tickTimer = setInterval(() => this.tick(), TICK_INTERVAL_MS);
  }

  private stopTick(): void {
    if (this.tickTimer) {
      clearInterval(this.tickTimer);
      this.tickTimer = null;
    }
  }
}

/** Module-level singleton – shared across all `useChatPolling` hook instances. */
export const globalChatPollingScheduler = new GlobalChatPollingScheduler();
