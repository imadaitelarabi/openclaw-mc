/**
 * Extract agent ID from session key
 * Format: "agent:agentId:sessionType"
 */
export function extractAgentId(sessionKey: string | undefined): string | null {
  if (!sessionKey) return null;
  const parts = sessionKey.split(':');
  return parts.length >= 2 ? parts[1] : null;
}

/**
 * Generate stream key for tracking concurrent runs
 */
export function getStreamKey(agentId: string, runId: string): string {
  return `${agentId}-${runId}`;
}

/**
 * Generate unique tool ID
 */
export function getToolId(runId: string, toolName: string, seq: number): string {
  return `${runId}-${toolName}-${seq}`;
}
