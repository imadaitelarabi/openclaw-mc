/**
 * Message Extractor
 * Extracts thinking and tool data from event payloads
 */

export interface ThinkingData {
  delta?: string;
  text?: string;
  complete?: boolean;
}

export interface ToolData {
  phase: 'start' | 'end';
  name: string;
  args?: any;
  result?: any;
  meta?: {
    exitCode?: number;
    duration?: number;
    cwd?: string;
    [key: string]: any;
  };
}

/**
 * Extract thinking/reasoning data from event payload
 */
export function extractThinking(payload: any): ThinkingData | null {
  // Check for reasoning stream
  if (payload.stream === 'reasoning' && payload.data) {
    return {
      delta: payload.data.delta,
      text: payload.data.text,
      complete: !!payload.data.text
    };
  }

  // Check for tagged thinking in assistant stream
  if (payload.stream === 'assistant' && payload.data?.text) {
    const text = payload.data.text;
    const thinkMatch = text.match(/<think>([\s\S]*?)<\/think>/);
    if (thinkMatch) {
      return {
        text: thinkMatch[1].trim(),
        complete: true
      };
    }
  }

  return null;
}

/**
 * Extract tool data from event payload
 */
export function extractTool(payload: any): ToolData | null {
  if (payload.stream !== 'tool') return null;

  const data = payload.data || {};
  const phase = data.phase;
  
  if (phase !== 'start' && phase !== 'end') return null;

  const name = payload.tool || data.name || 'unknown';

  const toolData: ToolData = {
    phase,
    name,
    args: data.args,
    result: data.result || data.meta?.result,
    meta: data.meta
  };

  return toolData;
}

/**
 * Extract agent/session info from event
 */
export function extractSessionInfo(payload: any): {
  agentId: string | null;
  runId: string | null;
  sessionKey: string | null;
} {
  let agentId: string | null = null;
  
  if (payload.sessionKey) {
    const parts = payload.sessionKey.split(':');
    if (parts.length >= 2) {
      agentId = parts[1];
    }
  }

  return {
    agentId,
    runId: payload.runId || null,
    sessionKey: payload.sessionKey || null
  };
}

/**
 * Check if event indicates lifecycle phase
 */
export function extractLifecycle(payload: any): {
  phase: 'start' | 'end' | 'error' | null;
  error?: string;
} {
  if (payload.stream === 'lifecycle' && payload.data?.phase) {
    return {
      phase: payload.data.phase,
      error: payload.data.error
    };
  }
  return { phase: null };
}

/**
 * Extract thinking and tools from final chat message (role-based JSON format)
 * Used for processing chat events with state === 'final'
 */
export function extractFromMessage(message: any): {
  thinking?: string;
  tools: Array<{ name: string; args?: any; result?: any; meta?: any }>;
} {
  const result: {
    thinking?: string;
    tools: Array<{ name: string; args?: any; result?: any; meta?: any }>;
  } = {
    tools: []
  };

  if (!message) return result;

  // Extract thinking from message content
  if (message.thinking) {
    result.thinking = message.thinking;
  } else if (message.content) {
    // Try to extract from <think> tags in content
    const thinkMatch = message.content.match(/<think>([\s\S]*?)<\/think>/);
    if (thinkMatch) {
      result.thinking = thinkMatch[1].trim();
    }
  }

  // Extract tools from toolCalls array
  if (Array.isArray(message.toolCalls)) {
    message.toolCalls.forEach((toolCall: any) => {
      result.tools.push({
        name: toolCall.name || toolCall.tool || 'unknown',
        args: toolCall.args || toolCall.arguments,
        result: toolCall.result,
        meta: toolCall.meta
      });
    });
  }

  return result;
}
