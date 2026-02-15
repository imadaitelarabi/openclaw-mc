/**
 * Event Formatting Utilities (Frontend)
 * Parse and handle tag-based markdown formatting
 */

export type TagType = 'trace' | 'tool' | 'tool-result' | 'meta';

export interface ParsedMessage {
  type: TagType | 'plain';
  content: string;
  raw: string;
  toolName?: string;
  toolArgs?: any;
  toolMeta?: {
    exitCode?: number;
    duration?: number;
    cwd?: string;
  };
  metaData?: any;
}

/**
 * Parse a tagged message to extract type and content
 */
export function parseTaggedMessage(message: string): ParsedMessage {
  // Check for trace/thinking
  const traceMatch = message.match(/^\[\[trace\]\]\s*([\s\S]*)$/);
  if (traceMatch) {
    return {
      type: 'trace',
      content: traceMatch[1].trim(),
      raw: message
    };
  }
  
  // Check for tool call
  const toolMatch = message.match(/^\[\[tool\]\]\s*(.+?)(?:\nArguments:\s*([\s\S]*))?$/);
  if (toolMatch) {
    const toolName = toolMatch[1].trim();
    let toolArgs = undefined;
    
    if (toolMatch[2]) {
      try {
        toolArgs = JSON.parse(toolMatch[2]);
      } catch {
        toolArgs = toolMatch[2].trim();
      }
    }
    
    return {
      type: 'tool',
      content: message,
      raw: message,
      toolName,
      toolArgs
    };
  }
  
  // Check for tool result
  const toolResultMatch = message.match(/^\[\[tool-result\]\]([\s\S]*)$/);
  if (toolResultMatch) {
    const fullContent = toolResultMatch[1].trim();
    
    // Try to extract metadata from first line
    const lines = fullContent.split('\n');
    const firstLine = lines[0];
    const metaMatch = firstLine.match(/Exit Code:\s*(\d+)|Duration:\s*(\d+)ms|CWD:\s*(.+)/g);
    
    let toolMeta: any = {};
    let contentStartIdx = 0;
    
    if (metaMatch) {
      metaMatch.forEach(match => {
        if (match.startsWith('Exit Code:')) {
          toolMeta.exitCode = parseInt(match.split(':')[1].trim());
        } else if (match.startsWith('Duration:')) {
          toolMeta.duration = parseInt(match.split(':')[1].trim());
        } else if (match.startsWith('CWD:')) {
          toolMeta.cwd = match.split(':')[1].trim();
        }
      });
      contentStartIdx = 1;
    }
    
    const resultContent = lines.slice(contentStartIdx).join('\n').trim();
    
    return {
      type: 'tool-result',
      content: resultContent,
      raw: message,
      toolMeta: Object.keys(toolMeta).length > 0 ? toolMeta : undefined
    };
  }
  
  // Check for meta
  const metaMatch = message.match(/^\[\[meta\]\]\s*(.+)$/);
  if (metaMatch) {
    let metaData = undefined;
    try {
      metaData = JSON.parse(metaMatch[1]);
    } catch {
      metaData = metaMatch[1].trim();
    }
    
    return {
      type: 'meta',
      content: metaMatch[1].trim(),
      raw: message,
      metaData
    };
  }
  
  // Plain message
  return {
    type: 'plain',
    content: message,
    raw: message
  };
}

/**
 * Check if a message is a tagged message
 */
export function isTaggedMessage(message: string): boolean {
  return /^\[\[(trace|tool|tool-result|meta)\]\]/.test(message);
}
