/**
 * Type guards for validating Gateway message structures
 * Used to safely handle Gateway responses and prevent runtime errors
 */

export function isToolResultMessage(msg: unknown): msg is {
  role: 'toolResult';
  toolCallId?: string;
  toolName?: string;
  content: unknown;
  details?: Record<string, unknown>;
  isError?: boolean;
  timestamp?: number;
} {
  return (
    typeof msg === 'object' &&
    msg !== null &&
    'role' in msg &&
    msg.role === 'toolResult'
  );
}

export function isAssistantMessage(msg: unknown): msg is {
  role: 'assistant';
  content: unknown;
  id?: string;
  runId?: string;
  timestamp?: number;
} {
  return (
    typeof msg === 'object' &&
    msg !== null &&
    'role' in msg &&
    msg.role === 'assistant'
  );
}

export function isUserMessage(msg: unknown): msg is {
  role: 'user';
  content: unknown;
  id?: string;
  timestamp?: number;
} {
  return (
    typeof msg === 'object' &&
    msg !== null &&
    'role' in msg &&
    msg.role === 'user'
  );
}

export function isReasoningMessage(msg: unknown): msg is {
  role: 'reasoning';
  content: unknown;
  id?: string;
  runId?: string;
  timestamp?: number;
} {
  return (
    typeof msg === 'object' &&
    msg !== null &&
    'role' in msg &&
    msg.role === 'reasoning'
  );
}

export function isToolMessage(msg: unknown): msg is {
  role: 'tool';
  content: unknown;
  tool?: Record<string, unknown>;
  id?: string;
  runId?: string;
  timestamp?: number;
} {
  return (
    typeof msg === 'object' &&
    msg !== null &&
    'role' in msg &&
    msg.role === 'tool'
  );
}

export function hasContentParts(content: unknown): content is Array<Record<string, unknown>> {
  return Array.isArray(content) && content.every(part => typeof part === 'object' && part !== null);
}

/**
 * Validates that a message has the minimum required fields
 */
export function isValidGatewayMessage(msg: unknown): msg is {
  role: string;
  content?: unknown;
  timestamp?: number;
} {
  return (
    typeof msg === 'object' &&
    msg !== null &&
    'role' in msg &&
    typeof (msg as any).role === 'string'
  );
}
