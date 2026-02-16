import { useState, useRef, useCallback, useEffect } from 'react';
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

    parts.forEach((part, partIndex) => {
      const partType = typeof part.type === 'string' ? part.type : '';

      if (partType === 'text') {
        const rawText = normalizeTextContent(part.text);
        if (rawText) textParts.push(stripAssistantFinalEnvelope(rawText));
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

    if (thinkingContent) {
      pushMessage({
        id: `${baseId}-reasoning`,
        role: 'reasoning',
        content: thinkingContent,
        timestamp,
        runId,
      });
    }

    if (textContent || (normalizedRole !== 'tool' && parts.length === 0)) {
      pushMessage({
        id: String(baseId),
        role: normalizedRole,
        content: textContent || normalizeTextContent(msg?.content ?? msg?.text),
        thinking: thinkingContent || undefined,
        timestamp,
        runId,
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
    a.thinking !== b.thinking ||
    a.timestamp !== b.timestamp ||
    a.runId !== b.runId
  ) {
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

function isLikelySameUserMessage(localMessage: ChatMessage, incomingMessage: ChatMessage): boolean {
  if (localMessage.role !== 'user' || incomingMessage.role !== 'user') return false;

  const localContent = localMessage.content.trim();
  const incomingContent = incomingMessage.content.trim();
  if (!localContent || localContent !== incomingContent) return false;

  if (localMessage.runId && incomingMessage.runId && localMessage.runId !== incomingMessage.runId) {
    return false;
  }

  return Math.abs(localMessage.timestamp - incomingMessage.timestamp) <= 15000;
}

export function useAgentEvents() {
  const [chatHistory, setChatHistory] = useState<Record<string, ChatMessage[]>>({});
  const [chatStreams, setChatStreams] = useState<Record<string, string>>({});
  const [reasoningStreams, setReasoningStreams] = useState<Record<string, string>>({});
  const [activeRuns, setActiveRuns] = useState<Record<string, string>>({});
  
  // Refs to store latest accumulated text (synchronous, no state timing issues)
  const latestTextRef = useRef<Record<string, string>>({});
  const pendingToolIdsRef = useRef<Record<string, string[]>>({});
  const toolCallToMessageIdRef = useRef<Record<string, string>>({});
  const persistedStreamAgentsRef = useRef(new Set<string>());
  
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
   * Load chat history from Gateway
   */
  const loadChatHistory = useCallback((agentId: string, messages: any[]) => {
    console.log(`[Mission Control] Loading ${messages.length} history messages for agent ${agentId}`);
    const transformedMessages = transformGatewayHistoryMessages(messages);

    setChatHistory(prev => ({
      ...prev,
      [agentId]: transformedMessages,
    }));
  }, []);

  /**
   * Prepend older messages to existing chat history (for pagination)
   */
  const prependChatHistory = useCallback((agentId: string, messages: any[]) => {
    const transformedMessages = transformGatewayHistoryMessages(messages);

    // Prepend to existing history with deduplication
    setChatHistory(prev => {
      const existing = prev[agentId] || [];
      const existingIds = new Set(existing.map(m => m.id));
      
      // Filter out duplicates
      const newMessages = transformedMessages.filter(m => !existingIds.has(m.id));
      
      console.log(`[Mission Control] Prepending ${newMessages.length} new messages (filtered ${transformedMessages.length - newMessages.length} duplicates) for agent ${agentId}`);
      
      return {
        ...prev,
        [agentId]: [...newMessages, ...existing],
      };
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

    setChatHistory(prev => {
      const existing = prev[agentId] || [];
      if (existing.length === 0) {
        return {
          ...prev,
          [agentId]: transformedMessages,
        };
      }

      const existingIndexById = new Map(existing.map((msg, index) => [msg.id, index]));
      const next = [...existing];
      let changed = false;

      transformedMessages.forEach((incoming) => {
        const existingIndex = existingIndexById.get(incoming.id);

        if (existingIndex === undefined) {
          const optimisticMatchIndex = next.findIndex((existingMessage) =>
            isLikelySameUserMessage(existingMessage, incoming)
          );

          if (optimisticMatchIndex !== -1) {
            const previousId = next[optimisticMatchIndex].id;
            next[optimisticMatchIndex] = incoming;
            existingIndexById.delete(previousId);
            existingIndexById.set(incoming.id, optimisticMatchIndex);
            changed = true;
            return;
          }

          next.push(incoming);
          existingIndexById.set(incoming.id, next.length - 1);
          changed = true;
          return;
        }

        if (!areChatMessagesEqual(next[existingIndex], incoming)) {
          next[existingIndex] = incoming;
          changed = true;
        }
      });

      if (!changed) return prev;

      next.sort((a, b) => {
        if (a.timestamp !== b.timestamp) {
          return a.timestamp - b.timestamp;
        }
        return a.id.localeCompare(b.id);
      });

      return {
        ...prev,
        [agentId]: next,
      };
    });
  }, []);

  const handleAgentEvent = useCallback((message: any) => {
    if (message.type === 'chat.abort.run.ack') {
      const { agentId, ok } = message;
      if (!agentId || !ok) return;

      setActiveRuns(prev => {
        const runId = prev[agentId];
        if (!runId) return prev;

        const next = { ...prev };
        delete next[agentId];

        const streamKey = getStreamKey(agentId, runId);
        setChatStreams(streamPrev => {
          const streamNext = { ...streamPrev };
          delete streamNext[streamKey];
          return streamNext;
        });
        setReasoningStreams(reasoningPrev => {
          const reasoningNext = { ...reasoningPrev };
          delete reasoningNext[streamKey];
          return reasoningNext;
        });
        delete latestTextRef.current[streamKey];
        clearPendingToolQueuesForRun(runId);

        return next;
      });
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
        setActiveRuns(prev => {
          const next = { ...prev };
          if (next[agentId] === runId) delete next[agentId];
          return next;
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

    // Track active run
    if (stream === 'lifecycle' && data?.phase === 'start') {
      setActiveRuns(prev => ({ ...prev, [agentId]: runId }));
    }

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

        setChatHistory(prev => {
          const currentHistory = prev[agentId] || [];
          const existingByToolCallId = toolCallMapKey
            ? currentHistory.find(m => m.id === toolCallToMessageIdRef.current[toolCallMapKey] && m.role === 'tool')
            : undefined;

          if (currentHistory.some(m => m.id === toolId) || existingByToolCallId) return prev;

          enqueuePendingToolId(runId, toolName, toolId);
          if (toolCallMapKey) {
            toolCallToMessageIdRef.current[toolCallMapKey] = toolId;
          }
          return { ...prev, [agentId]: [...currentHistory, toolMsg] };
        });
      } else if (isUpdatePhase) {
        setChatHistory(prev => {
          const currentHistory = prev[agentId] || [];
          const matchedToolId = resolveToolId(currentHistory);
          if (!matchedToolId) return prev;

          const updated = currentHistory.map(msg => {
            if (msg.id === matchedToolId && msg.role === 'tool') {
              return {
                ...msg,
                tool: {
                  ...msg.tool!,
                  status: 'start' as const,
                  result: toolResult ?? msg.tool?.result
                }
              };
            }
            return msg;
          });

          return { ...prev, [agentId]: updated };
        });
      } else if (isResultPhase && !isErrorPhase) {
        setChatHistory(prev => {
          const currentHistory = prev[agentId] || [];
          const matchedToolId = resolveToolId(currentHistory);
          if (!matchedToolId) return prev;

          const updated = currentHistory.map(msg => {
            if (msg.id === matchedToolId && msg.role === 'tool') {
              const duration = msg.tool?.startTime 
                ? Date.now() - msg.tool.startTime 
                : undefined;
              
              // Extract exit code if available (for exec tools)
              // Try meta.exitCode first (direct metadata), then meta.result.exitCode (nested in result)
              const exitCode = toolData.meta?.exitCode !== undefined 
                ? toolData.meta.exitCode 
                : toolData.meta?.result?.exitCode ?? toolData.result?.exitCode;

              return {
                ...msg,
                tool: {
                  ...msg.tool!,
                  result: toolResult ?? msg.tool?.result,
                  status: 'end' as const,
                  duration,
                  exitCode
                }
              };
            }
            return msg;
          });

          dequeuePendingToolId(runId, toolName, matchedToolId);
          if (toolCallMapKey) {
            delete toolCallToMessageIdRef.current[toolCallMapKey];
          }
          return { ...prev, [agentId]: updated };
        });
      } else if (isErrorPhase) {
        setChatHistory(prev => {
          const currentHistory = prev[agentId] || [];
          const matchedToolId = resolveToolId(currentHistory);
          if (!matchedToolId) return prev;

          const updated = currentHistory.map(msg => {
            if (msg.id === matchedToolId && msg.role === 'tool') {
              const duration = msg.tool?.startTime 
                ? Date.now() - msg.tool.startTime 
                : undefined;

              return {
                ...msg,
                tool: {
                  ...msg.tool!,
                  status: 'error' as const,
                  error: toolData.error || toolData.meta?.error || (typeof toolResult === 'string' ? toolResult : 'Tool execution failed'),
                  result: toolResult ?? msg.tool?.result,
                  duration
                }
              };
            }
            return msg;
          });

          dequeuePendingToolId(runId, toolName, matchedToolId);
          if (toolCallMapKey) {
            delete toolCallToMessageIdRef.current[toolCallMapKey];
          }
          return { ...prev, [agentId]: updated };
        });
      }
    }

    // Handle reasoning stream
    if (stream === 'reasoning') {
      if (data?.delta) {
        setReasoningStreams(prev => ({
          ...prev,
          [streamKey]: (prev[streamKey] || '') + normalizeTextContent(data.delta)
        }));
      } else if (data?.text) {
        setChatHistory(prev => {
          const currentHistory = prev[agentId] || [];
          if (currentHistory.some(m => m.runId === runId && m.role === 'reasoning')) return prev;
          return {
            ...prev,
            [agentId]: [...currentHistory, {
              id: `${runId}-reasoning`,
              role: 'reasoning',
              content: normalizeTextContent(data.text),
              timestamp: Date.now(),
              runId
            }]
          };
        });
        setReasoningStreams(prev => {
          const next = { ...prev };
          delete next[streamKey];
          return next;
        });
      }
    }

    // Handle assistant stream
    if (stream === 'assistant') {
      if (data?.text !== undefined) {
        latestTextRef.current[streamKey] = normalizeTextContent(data.text);
      }
      
      if (data?.delta !== undefined) {
        setChatStreams(prev => ({
          ...prev,
          [streamKey]: (prev[streamKey] || '') + normalizeTextContent(data.delta)
        }));
      }
    }

    // Handle lifecycle events
    if (stream === 'lifecycle') {
      console.log('[Mission Control] Lifecycle event:', data?.phase, 'runId:', runId);
      
      if (data?.phase === 'start') {
        setActiveRuns(prev => ({ ...prev, [agentId]: runId }));
      }
      
      if (data?.phase === 'end' || data?.phase === 'error') {
        const accumulatedText = latestTextRef.current[streamKey] || '';
        console.log('[Mission Control] Finalizing:', { 
          streamKey, 
          textLength: accumulatedText.length, 
          preview: accumulatedText.substring(0, 50) 
        });
        
        if (accumulatedText) {
          setChatHistory(prev => {
            const currentHistory = prev[agentId] || [];
            if (currentHistory.some(m => m.runId === runId && m.role === 'assistant')) {
              console.log('[Mission Control] Duplicate detected, skipping');
              return prev;
            }
            console.log('[Mission Control] Adding finalized message to history');
            return {
              ...prev,
              [agentId]: [...currentHistory, {
                id: runId,
                role: 'assistant',
                content: accumulatedText,
                timestamp: Date.now(),
                runId
              }]
            };
          });
        }
        
        // Handle pending tools gracefully when run ends/errors
        if (data?.phase === 'error') {
          setChatHistory(prev => {
            const currentHistory = prev[agentId] || [];
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
            return { ...prev, [agentId]: updated };
          });

          clearPendingToolQueuesForRun(runId);
        }

        if (data?.phase === 'end') {
          clearPendingToolQueuesForRun(runId);
        }
        
        // Clear streams
        setChatStreams(prev => {
          const next = { ...prev };
          delete next[streamKey];
          return next;
        });
        setReasoningStreams(prev => {
          const next = { ...prev };
          delete next[streamKey];
          return next;
        });
        setActiveRuns(prev => {
          const next = { ...prev };
          if (next[agentId] === runId) delete next[agentId];
          return next;
        });
        delete latestTextRef.current[streamKey];

        // Handle error state
        if (data?.phase === 'error') {
          const errorMsg = data?.error || 'An error occurred';
          setChatHistory(prev => {
            const currentHistory = prev[agentId] || [];
            if (currentHistory.some(m => m.runId === runId && m.role === 'assistant')) {
              return prev;
            }
            return {
              ...prev,
              [agentId]: [...currentHistory, {
                id: `${runId}-error`,
                role: 'assistant',
                content: `❌ Error: ${errorMsg}`,
                timestamp: Date.now(),
                runId
              }]
            };
          });
        }
      }
    }
  }, [loadChatHistory, prependChatHistory, syncRecentChatHistory]);

  const addUserMessage = useCallback((agentId: string, content: string) => {
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content,
      timestamp: Date.now()
    };
    setChatHistory(prev => ({
      ...prev,
      [agentId]: [...(prev[agentId] || []), userMsg]
    }));
  }, []);

  // Restore in-progress stream state on mount so typing survives refresh
  useEffect(() => {
    let mounted = true;

    const restoreStreamState = async () => {
      const persistedStates = await uiStateStore.getAllStreamStates();
      if (!mounted || persistedStates.length === 0) return;

      setActiveRuns(prev => {
        const next = { ...prev };
        persistedStates.forEach(({ agentId, runId }) => {
          if (!next[agentId]) {
            next[agentId] = runId;
          }
        });
        return next;
      });

      setChatStreams(prev => {
        const next = { ...prev };
        persistedStates.forEach(({ agentId, runId, assistantStream }) => {
          const streamKey = getStreamKey(agentId, runId);
          if (!next[streamKey] && assistantStream) {
            next[streamKey] = assistantStream;
          }
        });
        return next;
      });

      setReasoningStreams(prev => {
        const next = { ...prev };
        persistedStates.forEach(({ agentId, runId, reasoningStream }) => {
          const streamKey = getStreamKey(agentId, runId);
          if (!next[streamKey] && reasoningStream) {
            next[streamKey] = reasoningStream;
          }
        });
        return next;
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
      const activeEntries = Object.entries(activeRuns);
      const nextPersistedAgents = new Set(activeEntries.map(([agentId]) => agentId));

      if (activeEntries.length > 0) {
        void Promise.all(
          activeEntries.map(([agentId, runId]) => {
            const streamKey = getStreamKey(agentId, runId);
            const assistantStream = chatStreams[streamKey] || '';
            const reasoningStream = reasoningStreams[streamKey] || '';

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
  }, [activeRuns, chatStreams, reasoningStreams]);

  // Cleanup effect to prevent memory leaks
  useEffect(() => {
    return () => {
      // Clear event tracking on unmount
      seenEventsRef.current.clear();
      console.log('[Mission Control] Cleared event deduplication cache on unmount');
    };
  }, []);

  const clearChatHistory = useCallback((agentId: string) => {
    setChatHistory(prev => ({ ...prev, [agentId]: [] }));
  }, []);

  return {
    chatHistory,
    chatStreams,
    reasoningStreams,
    activeRuns,
    handleAgentEvent,
    addUserMessage,
    clearChatHistory
  };
}
