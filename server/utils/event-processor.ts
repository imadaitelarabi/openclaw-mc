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
  extractLifecycle
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
 * Thinking buffer per run
 */
const thinkingBuffers: Map<string, string> = new Map();

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
        // Accumulate in buffer
        const currentBuffer = thinkingBuffers.get(runId) || '';
        thinkingBuffers.set(runId, currentBuffer + thinking.delta);
        thinkingDelta = thinking.delta;
      }
      
      if (thinking.complete && thinking.text) {
        // Commit buffered thinking to formatted message
        const buffered = thinkingBuffers.get(runId);
        const finalText = buffered || thinking.text;
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
        const formatted = formatTrace(buffered);
        if (deduplicationService.checkAndMark(runId, formatted)) {
          formattedMessages.push(formatted);
        }
        thinkingComplete = buffered;
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
      }, 60000); // Clear after 1 minute
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
  return thinkingBuffers.get(runId);
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
