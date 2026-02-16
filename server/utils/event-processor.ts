/**
 * Event Processor
 * Structured pipeline for processing chat and agent events
 */

import { deduplicationService } from './deduplication';
import { 
  formatTrace, 
  formatToolCall, 
  formatToolResult, 
  formatMeta 
} from './event-formatting';
import {
  extractThinking,
  extractTool,
  extractSessionInfo,
  extractLifecycle,
  extractFromMessage
} from './message-extractor';

export interface ProcessedEvent {
  type: 'runtime-chat' | 'runtime-agent' | 'unknown';
  agentId: string | null;
  runId: string | null;
  sessionKey: string | null;
  formattedMessages: string[];
  thinkingDelta?: string;
  thinkingComplete?: string;
  rawPayload: any;
}

/**
 * Thinking buffer per run with timestamp
 */
interface ThinkingBuffer {
  content: string;
  timestamp: number;
}

const thinkingBuffers: Map<string, ThinkingBuffer> = new Map();

/**
 * Delay before cleaning up deduplication data (in milliseconds)
 */
const DEDUPLICATION_CLEANUP_DELAY_MS = 60000; // 1 minute

/**
 * TTL for thinking buffers (5 minutes)
 */
const THINKING_BUFFER_TTL_MS = 300000; // 5 minutes

/**
 * Clean up stale thinking buffers
 */
function cleanupStaleBuffers() {
  const now = Date.now();
  const staleKeys: string[] = [];
  
  thinkingBuffers.forEach((buffer, runId) => {
    if (now - buffer.timestamp > THINKING_BUFFER_TTL_MS) {
      staleKeys.push(runId);
    }
  });
  
  staleKeys.forEach(key => {
    console.log(`[EventProcessor] Cleaning up stale thinking buffer for run: ${key}`);
    thinkingBuffers.delete(key);
  });
}

// Run cleanup every minute
setInterval(cleanupStaleBuffers, 60000);

/**
 * Process an incoming event through the pipeline
 */
export function processEvent(event: string, payload: any): ProcessedEvent {
  const sessionInfo = extractSessionInfo(payload);
  const { agentId, runId, sessionKey } = sessionInfo;

  // Classify event type
  let type: 'runtime-chat' | 'runtime-agent' | 'unknown' = 'unknown';
  if (event === 'chat') {
    type = 'runtime-chat';
  } else if (event === 'agent') {
    type = 'runtime-agent';
  }

  const formattedMessages: string[] = [];
  let thinkingDelta: string | undefined;
  let thinkingComplete: string | undefined;

  // Process agent events
  if (type === 'runtime-agent' && runId) {
    // Extract and process thinking/reasoning
    const thinking = extractThinking(payload);
    if (thinking) {
      if (thinking.delta) {
        // Accumulate in buffer with timestamp
        const currentBuffer = thinkingBuffers.get(runId);
        const newContent = (currentBuffer?.content || '') + thinking.delta;
        thinkingBuffers.set(runId, {
          content: newContent,
          timestamp: Date.now()
        });
        thinkingDelta = thinking.delta;
      }
      
      if (thinking.complete && thinking.text) {
        // Commit buffered thinking to formatted message
        const buffered = thinkingBuffers.get(runId);
        const finalText = buffered?.content || thinking.text;
        const formatted = formatTrace(finalText);
        
        if (deduplicationService.checkAndMark(runId, formatted)) {
          formattedMessages.push(formatted);
        }
        
        thinkingComplete = finalText;
        thinkingBuffers.delete(runId);
      }
    }

    // Extract and process tool events
    const tool = extractTool(payload);
    if (tool) {
      if (tool.phase === 'start') {
        const formatted = formatToolCall(tool.name, tool.args);
        if (deduplicationService.checkAndMark(runId, formatted)) {
          formattedMessages.push(formatted);
        }
      } else if (tool.phase === 'end') {
        const formatted = formatToolResult({
          result: tool.result,
          exitCode: tool.meta?.exitCode,
          duration: tool.meta?.duration,
          cwd: tool.meta?.cwd
        });
        if (deduplicationService.checkAndMark(runId, formatted)) {
          formattedMessages.push(formatted);
        }
      }
    }

    // Handle lifecycle events
    const lifecycle = extractLifecycle(payload);
    if (lifecycle.phase === 'end' || lifecycle.phase === 'error') {
      // Commit any buffered thinking on lifecycle end
      const buffered = thinkingBuffers.get(runId);
      if (buffered) {
        const formatted = formatTrace(buffered.content);
        if (deduplicationService.checkAndMark(runId, formatted)) {
          formattedMessages.push(formatted);
        }
        thinkingComplete = buffered.content;
        thinkingBuffers.delete(runId);
      }

      // Add metadata about completion
      const meta = formatMeta({
        phase: lifecycle.phase,
        timestamp: Date.now(),
        ...(lifecycle.error && { error: lifecycle.error })
      });
      
      if (deduplicationService.checkAndMark(runId, meta)) {
        formattedMessages.push(meta);
      }

      // Clean up deduplication for this run
      setTimeout(() => {
        deduplicationService.clearRun(runId);
      }, DEDUPLICATION_CLEANUP_DELAY_MS);
    }
  }

  // Process chat events (final state as source of truth)
  if (type === 'runtime-chat' && runId && payload.state === 'final') {
    const message = payload.message;
    if (message) {
      const extracted = extractFromMessage(message);
      
      // Process thinking/trace from final message
      if (extracted.thinking) {
        const formatted = formatTrace(extracted.thinking);
        if (deduplicationService.checkAndMark(runId, formatted)) {
          formattedMessages.push(formatted);
          thinkingComplete = extracted.thinking;
        }
      }
      
      // Process tools from final message (chronological order)
      extracted.tools.forEach((tool, idx) => {
        // Tool call
        const callFormatted = formatToolCall(tool.name, tool.args);
        if (deduplicationService.checkAndMark(runId, callFormatted)) {
          formattedMessages.push(callFormatted);
        }
        
        // Tool result (separate from call)
        if (tool.result !== undefined) {
          const resultFormatted = formatToolResult({
            result: tool.result,
            exitCode: tool.meta?.exitCode,
            duration: tool.meta?.duration,
            cwd: tool.meta?.cwd
          });
          if (deduplicationService.checkAndMark(runId, resultFormatted)) {
            formattedMessages.push(resultFormatted);
          }
        }
      });
      
      // Clean up buffer for this run
      thinkingBuffers.delete(runId);
      
      // Clean up deduplication after a delay
      setTimeout(() => {
        deduplicationService.clearRun(runId);
      }, DEDUPLICATION_CLEANUP_DELAY_MS);
    }
  }

  return {
    type,
    agentId,
    runId,
    sessionKey,
    formattedMessages,
    thinkingDelta,
    thinkingComplete,
    rawPayload: payload
  };
}

/**
 * Get current thinking buffer for a run
 */
export function getThinkingBuffer(runId: string): string | undefined {
  return thinkingBuffers.get(runId)?.content;
}

/**
 * Clear thinking buffer for a run
 */
export function clearThinkingBuffer(runId: string): void {
  thinkingBuffers.delete(runId);
}

/**
 * Clear all thinking buffers
 */
export function clearAllThinkingBuffers(): void {
  thinkingBuffers.clear();
}
