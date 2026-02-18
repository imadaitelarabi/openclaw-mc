import { useReducer, useRef, useCallback, useEffect, useMemo } from 'react';
import type { ChatMessage } from '@/types';
import { extractAgentId, getStreamKey, getToolId } from '@/lib/gateway-utils';
import { uiStateStore } from '@/lib/ui-state-db';
import { 
  isToolResultMessage, 
  isAssistantMessage, 
  isUserMessage,
  isReasoningMessage,
  isToolMessage,
  hasContentParts,
  isValidGatewayMessage
} from '@/lib/gateway-type-guards';

function normalizeTextContent(value: unknown): string {
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value == null) return '';

  if (Array.isArray(value)) {
    return value.map((item) => normalizeTextContent(item)).filter(Boolean).join('\n');
  }

  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;

    if (typeof record.text === 'string') return record.text;
    if (typeof record.content === 'string') return record.content;
    if (record.content !== undefined) return normalizeTextContent(record.content);
    if (typeof record.value === 'string') return record.value;

    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  }

  return String(value);
}

function computeStableHash(input: string): string {
  let hash = 5381;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 33) ^ input.charCodeAt(index);
  }
  return (hash >>> 0).toString(36);
}

function buildFallbackHistoryId(msg: any): string {
  const role = typeof msg?.role === 'string' ? msg.role : 'unknown';
  const timestamp = typeof msg?.timestamp === 'number' ? msg.timestamp : 0;
  const runId = typeof msg?.runId === 'string' ? msg.runId : '';
  const toolCallId = normalizeTextContent(msg?.toolCallId || '');
  const toolName = normalizeTextContent(msg?.toolName || msg?.tool?.name || '');
  const content = normalizeTextContent(msg?.content ?? msg?.text ?? '').slice(0, 500);
  const signature = `${role}|${timestamp}|${runId}|${toolCallId}|${toolName}|${content}`;
  return `hist-${computeStableHash(signature)}`;
}

function stripAssistantFinalEnvelope(text: string): string {
  const finalMatch = text.match(/<final>([\s\S]*?)<\/final>/i);
  const withoutEnvelope = finalMatch ? finalMatch[1] : text;
  return withoutEnvelope.replace(/\[\[reply_to_current\]\]/g, '').trim();
}

function toContentParts(content: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(content)) {
    return content.filter((part): part is Record<string, unknown> => typeof part === 'object' && part !== null);
  }

  if (typeof content === 'string') {
    return [{ type: 'text', text: content }];
  }

  if (content && typeof content === 'object') {
    return [content as Record<string, unknown>];
  }

  return [];
}

function extractAttachments(msg: any): ChatMessage['attachments'] | undefined {
  if (!Array.isArray(msg?.attachments)) return undefined;

  const attachments = msg.attachments
    .map((attachment: any) => {
      if (!attachment || typeof attachment !== 'object') return null;

      const content = normalizeTextContent(attachment.content ?? attachment.media);
      if (!content || !content.startsWith('data:image/')) return null;

      const mimeType = normalizeTextContent(attachment.mimeType) || 'image/*';
      const type = normalizeTextContent(attachment.type) || 'image';
      const fileName = normalizeTextContent(attachment.fileName ?? attachment.name) || undefined;

      return {
        fileName,
        type,
        mimeType,
        content,
      };
    })
    .filter((attachment): attachment is NonNullable<typeof attachment> => attachment !== null);

  return attachments.length > 0 ? attachments : undefined;
}

function extractImageAttachmentFromPart(part: Record<string, unknown>): {
  fileName?: string;
  type: string;
  mimeType: string;
  content: string;
} | null {
  const partType = normalizeTextContent(part.type || '').toLowerCase();
  const explicitMime = normalizeTextContent(part.mimeType ?? part.mime_type ?? '').toLowerCase();
  const isImagePart =
    partType === 'image' ||
    partType === 'input_image' ||
    partType === 'image_url' ||
    partType.includes('image') ||
    explicitMime.startsWith('image/');
  if (!isImagePart) return null;

  const nestedImage = (part.image && typeof part.image === 'object' ? part.image as Record<string, unknown> : null);
  const nestedImageUrl = (part.image_url && typeof part.image_url === 'object'
    ? part.image_url as Record<string, unknown>
    : null);

  const imagePayload =
    part.media ??
    part.content ??
    part.data ??
    part.url ??
    part.image_url ??
    part.image ??
    nestedImage?.data ??
    nestedImage?.base64 ??
    nestedImage?.url ??
    nestedImage?.content ??
    nestedImageUrl?.url ??
    nestedImageUrl?.content;
  const imagePayloadText = normalizeTextContent(imagePayload);

  let content = imagePayloadText;
  if (content && !content.startsWith('data:image/')) {
    if (/^[A-Za-z0-9+/=\s]+$/.test(content)) {
      const cleaned = content.replace(/\s+/g, '');
      content = `data:image/png;base64,${cleaned}`;
    }
  }

  if (!content.startsWith('data:image/')) return null;

  const mimeMatch = content.match(/^data:(image\/[^;]+);base64,/i);
  const mimeType = (mimeMatch?.[1] || normalizeTextContent(part.mimeType) || 'image/png').toLowerCase();
  const fileName = normalizeTextContent(part.fileName ?? part.name) || undefined;

  return {
    fileName,
    type: 'image',
    mimeType,
    content,
  };
}

function withPreservedAttachments(
  localMessage: ChatMessage,
  incomingMessage: ChatMessage
): ChatMessage {
  if (
    localMessage.role === 'user' &&
    (!incomingMessage.attachments || incomingMessage.attachments.length === 0) &&
    localMessage.attachments &&
    localMessage.attachments.length > 0
  ) {
    return {
      ...incomingMessage,
      attachments: localMessage.attachments,
    };
  }

  return incomingMessage;
}

function transformGatewayHistoryMessages(messages: any[]): ChatMessage[] {
  const transformed: ChatMessage[] = [];
  const toolMessageIndexByCallId = new Map<string, number>();

  const pushMessage = (message: ChatMessage) => {
    transformed.push(message);
    return transformed.length - 1;
  };

  messages.forEach((msg: any) => {
    // Validate message has minimum required structure
    if (!isValidGatewayMessage(msg)) {
      console.warn('[transformGatewayHistoryMessages] Invalid message structure:', msg);
      return;
    }

    const role = msg?.role;
    const timestamp = typeof msg?.timestamp === 'number' ? msg.timestamp : Date.now();
    const runId = typeof msg?.runId === 'string' ? msg.runId : undefined;
    const baseId = normalizeTextContent(msg?.id || msg?.runId || buildFallbackHistoryId(msg));

    if (isToolResultMessage(msg)) {
      const details = (msg?.details && typeof msg.details === 'object') ? msg.details : {};
      const contentText = normalizeTextContent(msg?.content);
      const aggregated = normalizeTextContent((details as any)?.aggregated);
      const exitCode = typeof (details as any)?.exitCode === 'number' ? (details as any).exitCode : undefined;
      const duration = typeof (details as any)?.durationMs === 'number'
        ? (details as any).durationMs
        : (typeof (details as any)?.duration === 'number' ? (details as any).duration : undefined);
      const isError = Boolean(msg?.isError);
      const toolCallId = normalizeTextContent(msg?.toolCallId);

      if (toolCallId && toolMessageIndexByCallId.has(toolCallId)) {
        const existingIndex = toolMessageIndexByCallId.get(toolCallId);
        if (existingIndex !== undefined) {
          const existingMessage = transformed[existingIndex];
          if (existingMessage?.role === 'tool' && existingMessage.tool) {
            transformed[existingIndex] = {
              ...existingMessage,
              timestamp: Math.max(existingMessage.timestamp, timestamp),
              tool: {
                ...existingMessage.tool,
                status: isError ? 'error' : 'end',
                result: aggregated || contentText || (details as any)?.result || existingMessage.tool.result,
                error: isError
                  ? normalizeTextContent((details as any)?.error || contentText || 'Tool execution failed')
                  : undefined,
                exitCode,
                duration,
              },
            };
            return;
          }
        }
      }

      const standaloneTool: ChatMessage = {
        id: toolCallId || baseId,
        role: 'tool',
        content: msg?.toolName || 'tool',
        tool: {
          name: msg?.toolName || 'tool',
          status: isError ? 'error' : 'end',
          result: aggregated || contentText || (details as any)?.result,
          error: isError ? normalizeTextContent((details as any)?.error || contentText || 'Tool execution failed') : undefined,
          exitCode,
          duration,
        },
        timestamp,
        runId,
      };

      const standaloneIndex = pushMessage(standaloneTool);
      if (toolCallId) {
        toolMessageIndexByCallId.set(toolCallId, standaloneIndex);
      }
      return;
    }

    const parts = toContentParts(msg?.content);
    const textParts: string[] = [];
    const thinkingParts: string[] = [];
    const partAttachments: NonNullable<ChatMessage['attachments']> = [];

    parts.forEach((part, partIndex) => {
      const partType = typeof part.type === 'string' ? part.type : '';

      if (partType === 'text') {
        const rawText = normalizeTextContent(part.text);
        if (rawText) textParts.push(stripAssistantFinalEnvelope(rawText));
        return;
      }

      const imageAttachment = extractImageAttachmentFromPart(part);
      if (imageAttachment) {
        partAttachments.push(imageAttachment);
        return;
      }

      if (partType === 'thinking') {
        const thinkingText = normalizeTextContent(part.thinking ?? part.text);
        if (thinkingText) thinkingParts.push(thinkingText);
        return;
      }

      if (partType === 'toolCall') {
        const toolName = normalizeTextContent(part.name || 'tool');
        const toolCallId = normalizeTextContent(part.id || `${baseId}-tool-${partIndex}`);
        const toolMessage: ChatMessage = {
          id: toolCallId,
          role: 'tool',
          content: toolName,
          tool: {
            name: toolName,
            args: part.arguments,
            status: 'start',
          },
          timestamp,
          runId,
        };

        const toolMessageIndex = pushMessage(toolMessage);
        if (toolCallId) {
          toolMessageIndexByCallId.set(toolCallId, toolMessageIndex);
        }
        return;
      }

      const fallbackText = normalizeTextContent(part);
      if (fallbackText) textParts.push(stripAssistantFinalEnvelope(fallbackText));
    });

    const normalizedRole: ChatMessage['role'] = role === 'user'
      ? 'user'
      : role === 'reasoning'
        ? 'reasoning'
        : role === 'tool'
          ? 'tool'
          : 'assistant';

    const textContent = textParts.filter(Boolean).join('\n\n').trim();
    const thinkingContent = thinkingParts.filter(Boolean).join('\n\n').trim();
    const stopReason = normalizeTextContent(msg?.stopReason).trim();
    const rawErrorMessage = normalizeTextContent(msg?.errorMessage ?? msg?.error).trim();
    const isAssistantError = normalizedRole === 'assistant' && (stopReason.toLowerCase() === 'error' || Boolean(rawErrorMessage));

    if (thinkingContent) {
      pushMessage({
        id: `${baseId}-reasoning`,
        role: 'reasoning',
        content: thinkingContent,
        timestamp,
        runId,
      });
    }

    const directAttachments = extractAttachments(msg);
    const attachments = [
      ...(directAttachments || []),
      ...partAttachments,
    ];

    const fallbackContent = normalizeTextContent(msg?.content ?? msg?.text).trim();
    const normalizedContent = textContent
      ? textContent
      : (attachments.length > 0
          ? ''
          : (isAssistantError
              ? (rawErrorMessage || fallbackContent || 'Request failed')
              : fallbackContent));

    const shouldPushMessage =
      textContent.length > 0 ||
      attachments.length > 0 ||
      isAssistantError ||
      (parts.length === 0 && normalizedContent.length > 0);

    if (shouldPushMessage) {

      pushMessage({
        id: String(baseId),
        role: normalizedRole,
        content: normalizedContent,
        stopReason: stopReason || undefined,
        errorMessage: isAssistantError ? (rawErrorMessage || normalizedContent) : undefined,
        thinking: thinkingContent || undefined,
        timestamp,
        runId,
        attachments: attachments.length > 0 ? attachments : undefined,
      });
    }

    if (normalizedRole === 'tool' && msg?.tool) {
      pushMessage({
        id: String(baseId),
        role: 'tool',
        content: normalizeTextContent(msg?.tool?.name || msg?.content || 'tool'),
        tool: {
          name: normalizeTextContent(msg?.tool?.name || 'tool'),
          args: msg?.tool?.args,
          result: msg?.tool?.result,
          status: msg?.tool?.status || 'end',
          error: msg?.tool?.error,
          duration: msg?.tool?.duration,
          exitCode: msg?.tool?.exitCode,
          startTime: msg?.tool?.startTime,
        },
        timestamp,
        runId,
      });
    }
  });

  return transformed;
}

function areChatMessagesEqual(a: ChatMessage, b: ChatMessage): boolean {
  const stableStringify = (value: unknown): string => {
    if (value == null) return '';
    if (typeof value !== 'object') return String(value);
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  };

  if (
    a.id !== b.id ||
    a.role !== b.role ||
    a.content !== b.content ||
    a.stopReason !== b.stopReason ||
    a.errorMessage !== b.errorMessage ||
    a.thinking !== b.thinking ||
    a.timestamp !== b.timestamp ||
    a.runId !== b.runId
  ) {
    return false;
  }

  const aAttachments = stableStringify(a.attachments || []);
  const bAttachments = stableStringify(b.attachments || []);
  if (aAttachments !== bAttachments) {
    return false;
  }

  const aTool = a.tool;
  const bTool = b.tool;

  if (!aTool && !bTool) return true;
  if (!aTool || !bTool) return false;

  return (
    aTool.name === bTool.name &&
    aTool.status === bTool.status &&
    aTool.result === bTool.result &&
    aTool.error === bTool.error &&
    aTool.duration === bTool.duration &&
    aTool.exitCode === bTool.exitCode &&
    stableStringify(aTool.args) === stableStringify(bTool.args)
  );
}

function normalizeUserContentForDedup(content: string): string {
  return content.replace(/\s+/g, ' ').trim();
}

function isLikelyOptimisticMessageId(id: string): boolean {
  return /^\d{12,}$/.test(id);
}

function isLikelySameUserMessage(localMessage: ChatMessage, incomingMessage: ChatMessage): boolean {
  if (localMessage.role !== 'user' || incomingMessage.role !== 'user') return false;

  const localContent = normalizeUserContentForDedup(localMessage.content);
  const incomingContent = normalizeUserContentForDedup(incomingMessage.content);
  if (!localContent || localContent !== incomingContent) return false;

  if (localMessage.runId && incomingMessage.runId) {
    return localMessage.runId === incomingMessage.runId;
  }

  const timestampDelta = Math.abs(localMessage.timestamp - incomingMessage.timestamp);
  if (timestampDelta <= 15000) return true;

  const hasOptimisticId =
    isLikelyOptimisticMessageId(localMessage.id) ||
    isLikelyOptimisticMessageId(incomingMessage.id);

  return hasOptimisticId && timestampDelta <= 180000;
}

/**
 * Check if two messages are likely the same based on runId and role.
 * This handles cases where local finalization uses runId as the message ID,
 * but the server assigns a different UUID.
 */
function isLikelySameByRunIdAndRole(localMessage: ChatMessage, incomingMessage: ChatMessage): boolean {
  // Must have both runId and role
  if (!localMessage.runId || !incomingMessage.runId) return false;
  if (localMessage.role !== incomingMessage.role) return false;
  
  // Must be the same run
  if (localMessage.runId !== incomingMessage.runId) return false;
  
  // For assistant messages, check if content is similar (handles streaming finalization)
  if (localMessage.role === 'assistant' && incomingMessage.role === 'assistant') {
    const localContent = localMessage.content.trim();
    const incomingContent = incomingMessage.content.trim();
    
    // If either is empty, they're not the same
    if (!localContent || !incomingContent) return false;
    
    // Check if content is exactly the same or if one is a prefix of the other
    // (handles cases where finalization happened mid-stream)
    return localContent === incomingContent || 
           localContent.startsWith(incomingContent) || 
           incomingContent.startsWith(localContent);
  }
  
  return true;
}

/**
 * Phase 3 Optimization: Unified State Management
 * 
 * Previously used 4 separate useState hooks which caused:
 * - 12+ scattered setChatHistory calls
 * - Multiple re-renders per event (3-5 updates per lifecycle event)
 * - Hard to track state update sites
 * - No batching of related updates
 * 
 * Now uses single useReducer with:
 * - Centralized state transitions in reducer
 * - Typed actions for all state changes
 * - BATCH_UPDATE action to combine multiple updates into single render
 * - Easier debugging and maintenance
 */

// Unified state type for all agent event state
interface AgentEventsState {
  chatHistory: Record<string, ChatMessage[]>;
  chatStreams: Record<string, string>;
  reasoningStreams: Record<string, string>;
  activeRuns: Record<string, string>;
}

/**
 * Action types for state updates.
 * All state changes go through dispatch with these typed actions.
 * 
 * Key patterns:
 * - ADD_CHAT_MESSAGE: Append single message (with deduplication in reducer)
 * - UPDATE_CHAT_MESSAGES: Replace entire message array (for bulk updates)
 * - BATCH_UPDATE: Combine multiple actions into single render (performance critical)
 * - *_DELTA: Accumulate streaming text without full state replacement
 */
type AgentEventsAction =
  | { type: 'LOAD_CHAT_HISTORY'; agentId: string; messages: ChatMessage[] }
  | { type: 'PREPEND_CHAT_HISTORY'; agentId: string; messages: ChatMessage[] }
  | { type: 'SYNC_RECENT_CHAT_HISTORY'; agentId: string; messages: ChatMessage[]; existingHistory: ChatMessage[] }
  | { type: 'ADD_CHAT_MESSAGE'; agentId: string; message: ChatMessage }
  | { type: 'UPDATE_CHAT_MESSAGES'; agentId: string; messages: ChatMessage[] }
  | { type: 'UPDATE_CHAT_MESSAGE'; agentId: string; messageId: string; updates: Partial<ChatMessage> }
  | { type: 'CLEAR_CHAT_HISTORY'; agentId: string }
  | { type: 'UPDATE_STREAM_DELTA'; streamKey: string; delta: string }
  | { type: 'SET_STREAM_TEXT'; streamKey: string; text: string }
  | { type: 'CLEAR_STREAM'; streamKey: string }
  | { type: 'UPDATE_REASONING_DELTA'; streamKey: string; delta: string }
  | { type: 'CLEAR_REASONING_STREAM'; streamKey: string }
  | { type: 'SET_ACTIVE_RUN'; agentId: string; runId: string }
  | { type: 'CLEAR_ACTIVE_RUN'; agentId: string; runId?: string }
  | { type: 'RESTORE_STREAM_STATE'; activeRuns: Record<string, string>; chatStreams: Record<string, string>; reasoningStreams: Record<string, string> }
  | { type: 'BATCH_UPDATE'; updates: AgentEventsAction[] };

// Reducer for unified state management - batches multiple updates into a single render
function agentEventsReducer(state: AgentEventsState, action: AgentEventsAction): AgentEventsState {
  switch (action.type) {
    case 'BATCH_UPDATE': {
      /**
       * BATCH_UPDATE: Critical performance optimization
       * 
       * Combines multiple state updates into a single render cycle.
       * React's automatic batching (React 18+) helps, but reducer batching
       * ensures updates are applied atomically even in async scenarios.
       * 
       * Example: Lifecycle 'end' event needs to:
       * 1. Add finalized assistant message
       * 2. Update interrupted tool statuses  
       * 3. Clear chat stream
       * 4. Clear reasoning stream
       * 5. Clear active run
       * 
       * Without batching: 5 separate re-renders
       * With batching: 1 single re-render
       */
      // Process all updates in a single state transition
      let newState = state;
      for (const update of action.updates) {
        newState = agentEventsReducer(newState, update as AgentEventsAction);
      }
      return newState;
    }

    case 'LOAD_CHAT_HISTORY': {
      const existing = state.chatHistory[action.agentId] || [];
      if (existing.length === 0) {
        return {
          ...state,
          chatHistory: {
            ...state.chatHistory,
            [action.agentId]: action.messages,
          },
        };
      }

      const existingById = new Map(existing.map((message) => [message.id, message]));
      const merged = action.messages.map((incoming) => {
        const existingByIdMatch = existingById.get(incoming.id);
        if (existingByIdMatch) {
          return withPreservedAttachments(existingByIdMatch, incoming);
        }

        const optimisticMatch = existing.find((localMessage) =>
          isLikelySameUserMessage(localMessage, incoming)
        );

        if (optimisticMatch) {
          return withPreservedAttachments(optimisticMatch, incoming);
        }

        return incoming;
      });

      return {
        ...state,
        chatHistory: {
          ...state.chatHistory,
          [action.agentId]: merged,
        },
      };
    }

    case 'PREPEND_CHAT_HISTORY': {
      const existing = state.chatHistory[action.agentId] || [];
      const existingIds = new Set(existing.map(m => m.id));
      const newMessages = action.messages.filter(m => !existingIds.has(m.id));
      
      return {
        ...state,
        chatHistory: {
          ...state.chatHistory,
          [action.agentId]: [...newMessages, ...existing],
        },
      };
    }

    case 'SYNC_RECENT_CHAT_HISTORY': {
      const existing = action.existingHistory;
      if (existing.length === 0) {
        return {
          ...state,
          chatHistory: {
            ...state.chatHistory,
            [action.agentId]: action.messages,
          },
        };
      }

      const existingIndexById = new Map(existing.map((msg, index) => [msg.id, index]));
      const next = [...existing];
      let changed = false;

      action.messages.forEach((incoming) => {
        const existingIndex = existingIndexById.get(incoming.id);

        if (existingIndex === undefined) {
          const runIdMatchIndex = next.findIndex((existingMessage) =>
            isLikelySameByRunIdAndRole(existingMessage, incoming)
          );

          if (runIdMatchIndex !== -1) {
            next[runIdMatchIndex] = withPreservedAttachments(next[runIdMatchIndex], incoming);
            changed = true;
          } else {
            next.push(incoming);
            changed = true;
          }
        } else {
          const existingMessage = next[existingIndex];
          if (!areChatMessagesEqual(existingMessage, incoming)) {
            next[existingIndex] = withPreservedAttachments(existingMessage, incoming);
            changed = true;
          }
        }
      });

      if (!changed) return state;

      return {
        ...state,
        chatHistory: {
          ...state.chatHistory,
          [action.agentId]: next,
        },
      };
    }

    case 'ADD_CHAT_MESSAGE': {
      const currentHistory = state.chatHistory[action.agentId] || [];
      // Check if message already exists
      if (currentHistory.some(m => m.id === action.message.id)) {
        return state;
      }
      return {
        ...state,
        chatHistory: {
          ...state.chatHistory,
          [action.agentId]: [...currentHistory, action.message],
        },
      };
    }

    case 'UPDATE_CHAT_MESSAGES': {
      return {
        ...state,
        chatHistory: {
          ...state.chatHistory,
          [action.agentId]: action.messages,
        },
      };
    }

    case 'UPDATE_CHAT_MESSAGE': {
      const currentHistory = state.chatHistory[action.agentId] || [];
      const messageIndex = currentHistory.findIndex(m => m.id === action.messageId);
      if (messageIndex === -1) return state;

      const updatedHistory = [...currentHistory];
      updatedHistory[messageIndex] = {
        ...updatedHistory[messageIndex],
        ...action.updates,
      };

      return {
        ...state,
        chatHistory: {
          ...state.chatHistory,
          [action.agentId]: updatedHistory,
        },
      };
    }

    case 'CLEAR_CHAT_HISTORY': {
      return {
        ...state,
        chatHistory: {
          ...state.chatHistory,
          [action.agentId]: [],
        },
      };
    }

    case 'UPDATE_STREAM_DELTA': {
      return {
        ...state,
        chatStreams: {
          ...state.chatStreams,
          [action.streamKey]: (state.chatStreams[action.streamKey] || '') + action.delta,
        },
      };
    }

    case 'SET_STREAM_TEXT': {
      return {
        ...state,
        chatStreams: {
          ...state.chatStreams,
          [action.streamKey]: action.text,
        },
      };
    }

    case 'CLEAR_STREAM': {
      const next = { ...state.chatStreams };
      delete next[action.streamKey];
      return {
        ...state,
        chatStreams: next,
      };
    }

    case 'UPDATE_REASONING_DELTA': {
      return {
        ...state,
        reasoningStreams: {
          ...state.reasoningStreams,
          [action.streamKey]: (state.reasoningStreams[action.streamKey] || '') + action.delta,
        },
      };
    }

    case 'CLEAR_REASONING_STREAM': {
      const next = { ...state.reasoningStreams };
      delete next[action.streamKey];
      return {
        ...state,
        reasoningStreams: next,
      };
    }

    case 'SET_ACTIVE_RUN': {
      return {
        ...state,
        activeRuns: {
          ...state.activeRuns,
          [action.agentId]: action.runId,
        },
      };
    }

    case 'CLEAR_ACTIVE_RUN': {
      const next = { ...state.activeRuns };
      if (!action.runId || next[action.agentId] === action.runId) {
        delete next[action.agentId];
      }
      return {
        ...state,
        activeRuns: next,
      };
    }

    case 'RESTORE_STREAM_STATE': {
      return {
        ...state,
        activeRuns: { ...state.activeRuns, ...action.activeRuns },
        chatStreams: { ...state.chatStreams, ...action.chatStreams },
        reasoningStreams: { ...state.reasoningStreams, ...action.reasoningStreams },
      };
    }

    default:
      return state;
  }
}


export function useAgentEvents() {
  const [state, dispatch] = useReducer(agentEventsReducer, {
    chatHistory: {},
    chatStreams: {},
    reasoningStreams: {},
    activeRuns: {},
  });
  
  // Refs to store latest accumulated text (synchronous, no state timing issues)
  const latestTextRef = useRef<Record<string, string>>({});
  const pendingToolIdsRef = useRef<Record<string, string[]>>({});
  const toolCallToMessageIdRef = useRef<Record<string, string>>({});
  const persistedStreamAgentsRef = useRef(new Set<string>());
  const activeToolsRef = useRef<Record<string, ChatMessage>>({});
  
  // Event deduplication tracking
  const seenEventsRef = useRef(new Set<string>());

  const getToolQueueKey = (runId: string, toolName: string) => `${runId}::${toolName}`;

  const enqueuePendingToolId = (runId: string, toolName: string, toolId: string) => {
    const queueKey = getToolQueueKey(runId, toolName);
    const queue = pendingToolIdsRef.current[queueKey] || [];
    if (!queue.includes(toolId)) {
      pendingToolIdsRef.current[queueKey] = [...queue, toolId];
    }
  };

  const dequeuePendingToolId = (runId: string, toolName: string, toolId?: string) => {
    const queueKey = getToolQueueKey(runId, toolName);
    const queue = pendingToolIdsRef.current[queueKey] || [];

    if (queue.length === 0) return;

    if (toolId) {
      const nextQueue = queue.filter(id => id !== toolId);
      if (nextQueue.length > 0) pendingToolIdsRef.current[queueKey] = nextQueue;
      else delete pendingToolIdsRef.current[queueKey];
      return;
    }

    const nextQueue = queue.slice(1);
    if (nextQueue.length > 0) pendingToolIdsRef.current[queueKey] = nextQueue;
    else delete pendingToolIdsRef.current[queueKey];
  };

  const clearPendingToolQueuesForRun = (runId: string) => {
    Object.keys(pendingToolIdsRef.current).forEach(key => {
      if (key.startsWith(`${runId}::`)) {
        delete pendingToolIdsRef.current[key];
      }
    });

    Object.keys(toolCallToMessageIdRef.current).forEach(key => {
      if (key.startsWith(`${runId}::`)) {
        delete toolCallToMessageIdRef.current[key];
      }
    });
  };

  /**
   * Resolve the tool ID for an active tool from activeToolsRef
   * Tries multiple strategies: toolCallId mapping, sequence-based ID, and queue lookup
   * @param toolCallMapKey Optional mapping key for toolCallId-based lookup
   * @param hasSeq Whether a sequence number is available
   * @param runId The run ID associated with this tool
   * @param toolName The name of the tool
   * @param seq Optional sequence number for seq-based lookup
   * @returns The resolved tool ID if found in activeToolsRef, undefined otherwise
   */
  const resolveActiveToolId = (
    toolCallMapKey: string | undefined,
    hasSeq: boolean,
    runId: string,
    toolName: string,
    seq?: number
  ): string | undefined => {
    // Try toolCallId mapping first
    if (toolCallMapKey) {
      const mappedId = toolCallToMessageIdRef.current[toolCallMapKey];
      if (mappedId && activeToolsRef.current[mappedId]) {
        return mappedId;
      }
    }
    
    // Try sequence-based ID
    if (hasSeq && seq !== undefined) {
      const seqToolId = getToolId(runId, toolName, seq);
      if (activeToolsRef.current[seqToolId]) {
        return seqToolId;
      }
    }
    
    // Fall back to queue lookup
    const queueKey = getToolQueueKey(runId, toolName);
    const queue = pendingToolIdsRef.current[queueKey] || [];
    return queue.find(id => activeToolsRef.current[id]);
  };

  /**
   * Load chat history from Gateway
   */
  const loadChatHistory = useCallback((agentId: string, messages: any[]) => {
    console.log(`[Mission Control] Loading ${messages.length} history messages for agent ${agentId}`);
    const transformedMessages = transformGatewayHistoryMessages(messages);

    dispatch({
      type: 'LOAD_CHAT_HISTORY',
      agentId,
      messages: transformedMessages,
    });
  }, []);

  /**
   * Prepend older messages to existing chat history (for pagination)
   */
  const prependChatHistory = useCallback((agentId: string, messages: any[]) => {
    const transformedMessages = transformGatewayHistoryMessages(messages);

    console.log(`[Mission Control] Prepending ${transformedMessages.length} messages for agent ${agentId}`);
    
    dispatch({
      type: 'PREPEND_CHAT_HISTORY',
      agentId,
      messages: transformedMessages,
    });
  }, []);

  /**
   * Sync latest history window from polling without replacing full panel history.
   * - Updates existing messages in-place when enriched metadata arrives
   * - Appends genuinely new recent messages
   * - Avoids state updates when nothing changed
   */
  const syncRecentChatHistory = useCallback((agentId: string, messages: any[]) => {
    const transformedMessages = transformGatewayHistoryMessages(messages);

    dispatch({
      type: 'SYNC_RECENT_CHAT_HISTORY',
      agentId,
      messages: transformedMessages,
      existingHistory: state.chatHistory[agentId] || [],
    });
  }, [state.chatHistory]);

  const handleAgentEvent = useCallback((message: any) => {
    if (message.type === 'chat.abort.run.ack') {
      const { agentId, ok } = message;
      if (!agentId || !ok) return;

      const runId = state.activeRuns[agentId];
      if (!runId) return;

      const streamKey = getStreamKey(agentId, runId);
      
      // Batch multiple state updates into single dispatch
      dispatch({
        type: 'BATCH_UPDATE',
        updates: [
          { type: 'CLEAR_ACTIVE_RUN', agentId, runId },
          { type: 'CLEAR_STREAM', streamKey },
          { type: 'CLEAR_REASONING_STREAM', streamKey },
        ],
      });
      
      delete latestTextRef.current[streamKey];
      clearPendingToolQueuesForRun(runId);
      return;
    }

    // Handle chat history loading
    if (message.type === 'chat_history') {
      const { agentId, messages } = message;
      if (agentId && Array.isArray(messages)) {
        loadChatHistory(agentId, messages);
      }
      return;
    }

    // Handle loading more history (pagination)
    if (message.type === 'chat_history_more') {
      const { agentId, messages, before } = message;
      if (agentId && Array.isArray(messages)) {
        if (before) {
          prependChatHistory(agentId, messages);
        } else {
          syncRecentChatHistory(agentId, messages);
        }
      }
      return;
    }

    const { event, payload } = message;
    
    // Process chat events to end active runs
    if (event === 'chat') {
      const { runId, sessionKey, state } = payload;
      const agentId = extractAgentId(sessionKey);
      if (agentId && state === 'final') {
        dispatch({
          type: 'CLEAR_ACTIVE_RUN',
          agentId,
          runId,
        });
      }
      return;
    }

    // Only process agent events for the rest of the logic
    if (event !== 'agent') return;
    
    const { stream, data, runId, sessionKey, seq } = payload;
    const agentId = extractAgentId(sessionKey);
    if (!agentId) return;

    // Deduplication: Check if we've already processed this event
    const eventKey = `${runId}:${stream}:${seq || 0}`;
    if (seenEventsRef.current.has(eventKey)) {
      console.log('[Mission Control] Skipping duplicate event:', eventKey);
      return;
    }
    
    // Mark event as seen
    seenEventsRef.current.add(eventKey);
    
    // Prune old entries to prevent memory leaks (keep last 1000)
    if (seenEventsRef.current.size > 1000) {
      const entries = Array.from(seenEventsRef.current);
      seenEventsRef.current = new Set(entries.slice(-500));
    }

    const streamKey = getStreamKey(agentId, runId);

    console.log('[Mission Control] Agent event:', { stream, agentId, runId, seq, data });

    // Track active run - this will be handled in lifecycle event
    // (Note: removed duplicate setActiveRuns call here as it's already handled in lifecycle 'start')

    // Handle tool events
    if (stream === 'tool') {
      const toolData = data || {};
      const toolName = payload.tool || toolData.name || 'unknown tool';
      const toolCallId = toolData.toolCallId as string | undefined;
      const toolCallMapKey = toolCallId ? `${runId}::${toolCallId}` : undefined;
      const toolPhase = toolData.phase as string | undefined;
      const hasSeq = typeof seq === 'number';
      const toolId = hasSeq
        ? getToolId(runId, toolName, seq)
        : `${runId}-${toolName}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

      const resolveToolId = (currentHistory: ChatMessage[]) => {
        if (toolCallMapKey) {
          const mappedId = toolCallToMessageIdRef.current[toolCallMapKey];
          if (mappedId && currentHistory.some(m => m.id === mappedId && m.role === 'tool')) {
            return mappedId;
          }
        }

        if (hasSeq) {
          const seqToolId = getToolId(runId, toolName, seq);
          if (currentHistory.some(m => m.id === seqToolId && m.role === 'tool')) {
            return seqToolId;
          }
        }

        const queueKey = getToolQueueKey(runId, toolName);
        const queue = pendingToolIdsRef.current[queueKey] || [];
        const queuedId = queue.find(id => currentHistory.some(
          m => m.id === id && m.role === 'tool' && m.tool?.status === 'start'
        ));
        if (queuedId) return queuedId;

        const fallback = [...currentHistory].reverse().find(
          m => m.role === 'tool' && m.runId === runId && m.tool?.name === toolName && m.tool?.status === 'start'
        );

        return fallback?.id;
      };

      const isStartPhase = toolPhase === 'start';
      const isUpdatePhase = toolPhase === 'update';
      const isResultPhase = toolPhase === 'result' || toolPhase === 'end';
      const isErrorPhase = toolPhase === 'error' || (toolPhase === 'result' && Boolean(toolData.isError));
      const toolResult = toolData.result ?? toolData.meta?.result ?? toolData.meta;
      
      if (isStartPhase) {
        const toolMsg: ChatMessage = {
          id: toolId,
          role: 'tool',
          content: toolName,
          tool: {
            name: toolName,
            args: toolData.args,
            result: toolResult,
            status: 'start',
            startTime: Date.now()
          },
          timestamp: Date.now(),
          runId
        };

        // Store in activeToolsRef instead of chatHistory
        // This prevents incomplete/streaming tool messages from appearing in the UI
        // Tools will only be shown in chat history once they complete successfully or error
        if (!activeToolsRef.current[toolId]) {
          activeToolsRef.current[toolId] = toolMsg;
          enqueuePendingToolId(runId, toolName, toolId);
          if (toolCallMapKey) {
            toolCallToMessageIdRef.current[toolCallMapKey] = toolId;
          }
        }
      } else if (isUpdatePhase) {
        // Update the active tool in activeToolsRef
        const resolvedToolId = resolveActiveToolId(toolCallMapKey, hasSeq, runId, toolName, seq);
        
        if (resolvedToolId && activeToolsRef.current[resolvedToolId]) {
          activeToolsRef.current[resolvedToolId] = {
            ...activeToolsRef.current[resolvedToolId],
            tool: {
              ...activeToolsRef.current[resolvedToolId].tool!,
              status: 'start' as const,
              result: toolResult ?? activeToolsRef.current[resolvedToolId].tool?.result
            }
          };
        }
      } else if (isResultPhase && !isErrorPhase) {
        // Tool completed successfully - now add to chatHistory
        const resolvedToolId = resolveActiveToolId(toolCallMapKey, hasSeq, runId, toolName, seq);
        
        if (resolvedToolId && activeToolsRef.current[resolvedToolId]) {
          const activeTool = activeToolsRef.current[resolvedToolId];
          const duration = activeTool.tool?.startTime 
            ? Date.now() - activeTool.tool.startTime 
            : undefined;
          
          // Extract exit code if available (for exec tools)
          const exitCode = toolData.meta?.exitCode !== undefined 
            ? toolData.meta.exitCode 
            : toolData.meta?.result?.exitCode ?? toolData.result?.exitCode;

          const completedToolMsg: ChatMessage = {
            ...activeTool,
            tool: {
              ...activeTool.tool!,
              result: toolResult ?? activeTool.tool?.result,
              status: 'end' as const,
              duration,
              exitCode
            }
          };

          // Add to chatHistory now that it's complete
          dispatch({
            type: 'ADD_CHAT_MESSAGE',
            agentId,
            message: completedToolMsg,
          });

          // Clean up
          delete activeToolsRef.current[resolvedToolId];
          dequeuePendingToolId(runId, toolName, resolvedToolId);
          if (toolCallMapKey) {
            delete toolCallToMessageIdRef.current[toolCallMapKey];
          }
        }
      } else if (isErrorPhase) {
        // Tool errored - now add to chatHistory
        const resolvedToolId = resolveActiveToolId(toolCallMapKey, hasSeq, runId, toolName, seq);
        
        if (resolvedToolId && activeToolsRef.current[resolvedToolId]) {
          const activeTool = activeToolsRef.current[resolvedToolId];
          const duration = activeTool.tool?.startTime 
            ? Date.now() - activeTool.tool.startTime 
            : undefined;

          const errorToolMsg: ChatMessage = {
            ...activeTool,
            tool: {
              ...activeTool.tool!,
              status: 'error' as const,
              error: toolData.error || toolData.meta?.error || (typeof toolResult === 'string' ? toolResult : 'Tool execution failed'),
              result: toolResult ?? activeTool.tool?.result,
              duration
            }
          };

          // Add to chatHistory now that it's errored
          dispatch({
            type: 'ADD_CHAT_MESSAGE',
            agentId,
            message: errorToolMsg,
          });

          // Clean up
          delete activeToolsRef.current[resolvedToolId];
          dequeuePendingToolId(runId, toolName, resolvedToolId);
          if (toolCallMapKey) {
            delete toolCallToMessageIdRef.current[toolCallMapKey];
          }
        }
      }
    }

    // Handle reasoning stream
    if (stream === 'reasoning') {
      if (data?.delta) {
        dispatch({
          type: 'UPDATE_REASONING_DELTA',
          streamKey,
          delta: normalizeTextContent(data.delta),
        });
      } else if (data?.text) {
        // Batch the message add and stream clear
        dispatch({
          type: 'BATCH_UPDATE',
          updates: [
            {
              type: 'ADD_CHAT_MESSAGE',
              agentId,
              message: {
                id: `${runId}-reasoning`,
                role: 'reasoning' as const,
                content: normalizeTextContent(data.text),
                timestamp: Date.now(),
                runId
              },
            },
            {
              type: 'CLEAR_REASONING_STREAM',
              streamKey,
            },
          ],
        });
      }
    }

    // Handle assistant stream
    if (stream === 'assistant') {
      if (data?.text !== undefined) {
        latestTextRef.current[streamKey] = normalizeTextContent(data.text);
      }
      
      if (data?.delta !== undefined) {
        const normalizedDelta = normalizeTextContent(data.delta);
        dispatch({
          type: 'UPDATE_STREAM_DELTA',
          streamKey,
          delta: normalizedDelta,
        });
        // Also update latestTextRef with the accumulated text
        latestTextRef.current[streamKey] = (latestTextRef.current[streamKey] || '') + normalizedDelta;
      }
    }

    // Handle lifecycle events
    if (stream === 'lifecycle') {
      console.log('[Mission Control] Lifecycle event:', data?.phase, 'runId:', runId);
      
      if (data?.phase === 'start') {
        dispatch({
          type: 'SET_ACTIVE_RUN',
          agentId,
          runId,
        });
      }
      
      if (data?.phase === 'end' || data?.phase === 'error') {
        const accumulatedText = latestTextRef.current[streamKey] || '';
        console.log('[Mission Control] Finalizing:', { 
          streamKey, 
          textLength: accumulatedText.length, 
          preview: accumulatedText.substring(0, 50) 
        });
        
        const updates: AgentEventsAction[] = [];
        
        if (accumulatedText) {
          const currentHistory = state.chatHistory[agentId] || [];
          if (!currentHistory.some(m => m.runId === runId && m.role === 'assistant')) {
            console.log('[Mission Control] Adding finalized message to history');
            updates.push({
              type: 'ADD_CHAT_MESSAGE',
              agentId,
              message: {
                id: runId,
                role: 'assistant' as const,
                content: accumulatedText,
                timestamp: Date.now(),
                runId
              },
            });
          } else {
            console.log('[Mission Control] Duplicate detected, skipping');
          }
        }
        
        // Handle pending tools gracefully when run ends/errors
        if (data?.phase === 'error') {
          const currentHistory = state.chatHistory[agentId] || [];
          const updated = currentHistory.map(msg => {
            // Mark pending tools as interrupted
            if (msg.runId === runId && msg.role === 'tool' && msg.tool?.status === 'start') {
              const duration = msg.tool.startTime 
                ? Date.now() - msg.tool.startTime 
                : undefined;
              
              return {
                ...msg,
                tool: {
                  ...msg.tool,
                  status: 'error' as const,
                  error: 'Interrupted by run failure',
                  duration
                }
              };
            }
            return msg;
          });
          
          if (updated.some((msg, idx) => msg !== currentHistory[idx])) {
            updates.push({
              type: 'UPDATE_CHAT_MESSAGES',
              agentId,
              messages: updated,
            });
          }

          clearPendingToolQueuesForRun(runId);
          
          // Add error message if no accumulated text
          const errorMsg = data?.error || 'An error occurred';
          if (!accumulatedText && !currentHistory.some(m => m.runId === runId && m.role === 'assistant')) {
            updates.push({
              type: 'ADD_CHAT_MESSAGE',
              agentId,
              message: {
                id: `${runId}-error`,
                role: 'assistant' as const,
                content: errorMsg,
                stopReason: 'error',
                errorMessage: errorMsg,
                timestamp: Date.now(),
                runId
              },
            });
          }
        }

        if (data?.phase === 'end') {
          clearPendingToolQueuesForRun(runId);
        }
        
        // Clear streams and active run
        updates.push(
          { type: 'CLEAR_STREAM', streamKey },
          { type: 'CLEAR_REASONING_STREAM', streamKey },
          { type: 'CLEAR_ACTIVE_RUN', agentId, runId }
        );
        
        delete latestTextRef.current[streamKey];

        // Batch all updates
        if (updates.length > 0) {
          dispatch({
            type: 'BATCH_UPDATE',
            updates,
          });
        }
      }
    }
  }, [loadChatHistory, prependChatHistory, syncRecentChatHistory, state.chatHistory, state.activeRuns]);

  const addUserMessage = useCallback((agentId: string, content: string, attachments?: Array<{fileName?: string, type: string, mimeType: string, content: string}>) => {
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content,
      timestamp: Date.now(),
      ...(attachments && attachments.length > 0 && { attachments })
    };
    dispatch({
      type: 'ADD_CHAT_MESSAGE',
      agentId,
      message: userMsg,
    });
  }, []);

  // Restore in-progress stream state on mount so typing survives refresh
  useEffect(() => {
    let mounted = true;

    const restoreStreamState = async () => {
      const persistedStates = await uiStateStore.getAllStreamStates();
      if (!mounted || persistedStates.length === 0) return;

      const activeRuns: Record<string, string> = {};
      const chatStreams: Record<string, string> = {};
      const reasoningStreams: Record<string, string> = {};

      persistedStates.forEach(({ agentId, runId, assistantStream, reasoningStream }) => {
        activeRuns[agentId] = runId;
        
        const streamKey = getStreamKey(agentId, runId);
        if (assistantStream) {
          chatStreams[streamKey] = assistantStream;
        }
        if (reasoningStream) {
          reasoningStreams[streamKey] = reasoningStream;
        }
      });

      dispatch({
        type: 'RESTORE_STREAM_STATE',
        activeRuns,
        chatStreams,
        reasoningStreams,
      });

      persistedStreamAgentsRef.current = new Set(persistedStates.map(({ agentId }) => agentId));
    };

    void restoreStreamState();

    return () => {
      mounted = false;
    };
  }, []);

  // Persist active stream state for refresh recovery
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      const activeEntries = Object.entries(state.activeRuns);
      const nextPersistedAgents = new Set(activeEntries.map(([agentId]) => agentId));

      if (activeEntries.length > 0) {
        void Promise.all(
          activeEntries.map(([agentId, runId]) => {
            const streamKey = getStreamKey(agentId, runId);
            const assistantStream = state.chatStreams[streamKey] || '';
            const reasoningStream = state.reasoningStreams[streamKey] || '';

            return uiStateStore.saveStreamState(
              agentId,
              runId,
              assistantStream,
              reasoningStream
            );
          })
        );
      }

      persistedStreamAgentsRef.current.forEach((agentId) => {
        if (!nextPersistedAgents.has(agentId)) {
          void uiStateStore.clearStreamState(agentId);
        }
      });

      persistedStreamAgentsRef.current = nextPersistedAgents;
    }, 200);

    return () => clearTimeout(timeoutId);
  }, [state.activeRuns, state.chatStreams, state.reasoningStreams]);

  // Cleanup effect to prevent memory leaks
  useEffect(() => {
    return () => {
      // Clear event tracking on unmount
      seenEventsRef.current.clear();
      console.log('[Mission Control] Cleared event deduplication cache on unmount');
    };
  }, []);

  const clearChatHistory = useCallback((agentId: string) => {
    dispatch({
      type: 'CLEAR_CHAT_HISTORY',
      agentId,
    });
  }, []);

  return {
    chatHistory: state.chatHistory,
    chatStreams: state.chatStreams,
    reasoningStreams: state.reasoningStreams,
    activeRuns: state.activeRuns,
    handleAgentEvent,
    addUserMessage,
    clearChatHistory
  };
}
