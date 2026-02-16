/**
 * Event Formatting Utilities
 * Tag-based markdown formatting for thinking and tool events
 */

export type TagType = 'trace' | 'tool' | 'tool-result' | 'meta';

export interface ToolCallData {
  name: string;
  args?: any;
}

export interface ToolResultData {
  result: any;
  exitCode?: number;
  duration?: number;
  cwd?: string;
}

export interface MetaData {
  timestamp?: number;
  duration?: number;
  [key: string]: any;
}

/**
 * Format a trace/thinking block with markdown tag
 */
export function formatTrace(content: string): string {
  return `[[trace]]\n${content}`;
}

/**
 * Format a tool call with markdown tag
 */
export function formatToolCall(name: string, args?: any): string {
  const argsStr = args ? `\nArguments: ${JSON.stringify(args, null, 2)}` : '';
  return `[[tool]] ${name}${argsStr}`;
}

/**
 * Format a tool result with markdown tag
 */
export function formatToolResult(data: ToolResultData): string {
  const meta: string[] = [];
  
  if (data.exitCode !== undefined) {
    meta.push(`Exit Code: ${data.exitCode}`);
  }
  if (data.duration !== undefined) {
    meta.push(`Duration: ${data.duration}ms`);
  }
  if (data.cwd) {
    meta.push(`CWD: ${data.cwd}`);
  }
  
  const metaStr = meta.length > 0 ? `\n${meta.join(' | ')}` : '';
  const resultStr = typeof data.result === 'string' 
    ? data.result 
    : JSON.stringify(data.result, null, 2);
  
  return `[[tool-result]]${metaStr}\n${resultStr}`;
}

/**
 * Format metadata with markdown tag
 */
export function formatMeta(data: MetaData): string {
  return `[[meta]] ${JSON.stringify(data)}`;
}

/**
 * Parse a tagged message to extract type and content
 */
export function parseTaggedMessage(message: string): {
  type: TagType | null;
  content: string;
  raw: string;
} {
  const traceMatch = message.match(/^\[\[trace\]\]\s*([\s\S]*)$/);
  if (traceMatch) {
    return { type: 'trace', content: traceMatch[1].trim(), raw: message };
  }
  
  const toolMatch = message.match(/^\[\[tool\]\]\s*(.+?)(?:\nArguments:\s*([\s\S]*))?$/);
  if (toolMatch) {
    return { type: 'tool', content: message, raw: message };
  }
  
  const toolResultMatch = message.match(/^\[\[tool-result\]\]([\s\S]*)$/);
  if (toolResultMatch) {
    return { type: 'tool-result', content: toolResultMatch[1].trim(), raw: message };
  }
  
  const metaMatch = message.match(/^\[\[meta\]\]\s*(.+)$/);
  if (metaMatch) {
    return { type: 'meta', content: metaMatch[1].trim(), raw: message };
  }
  
  return { type: null, content: message, raw: message };
}

/**
 * Extract tool name and args from a tool-tagged message
 */
export function parseToolMessage(message: string): {
  name: string;
  args?: any;
} | null {
  const match = message.match(/^\[\[tool\]\]\s*(.+?)(?:\nArguments:\s*([\s\S]*))?$/);
  if (!match) return null;
  
  const name = match[1].trim();
  let args = undefined;
  
  if (match[2]) {
    try {
      args = JSON.parse(match[2]);
    } catch {
      // If parsing fails, keep args as string
      args = match[2].trim();
    }
  }
  
  return { name, args };
}
