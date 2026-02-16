import { useState, useRef, useCallback } from 'react';
import type { ChatMessage } from '@/types';
import { extractAgentId, getStreamKey, getToolId } from '@/lib/gateway-utils';

export function useAgentEvents() {
  const [chatHistory, setChatHistory] = useState<Record<string, ChatMessage[]>>({});
  const [chatStreams, setChatStreams] = useState<Record<string, string>>({});
  const [reasoningStreams, setReasoningStreams] = useState<Record<string, string>>({});
  const [activeRuns, setActiveRuns] = useState<Record<string, string>>({});
  
  // Refs to store latest accumulated text (synchronous, no state timing issues)
  const latestTextRef = useRef<Record<string, string>>({});
  const pendingToolIdsRef = useRef<Record<string, string[]>>({});
  const toolCallToMessageIdRef = useRef<Record<string, string>>({});

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
    
    // Transform Gateway messages to ChatMessage format
    const transformedMessages: ChatMessage[] = messages.map((msg: any) => {
      // Basic message structure
      const chatMsg: ChatMessage = {
        id: msg.id || msg.runId || `${Date.now()}-${Math.random()}`,
        role: msg.role || 'assistant',
        content: msg.content || msg.text || '',
        timestamp: msg.timestamp || Date.now(),
      };

      // Add runId if present
      if (msg.runId) {
        chatMsg.runId = msg.runId;
      }

      // Handle tool messages
      if (msg.role === 'tool' && msg.tool) {
        chatMsg.tool = {
          name: msg.tool.name,
          args: msg.tool.args,
          result: msg.tool.result,
          status: msg.tool.status || 'end',
          error: msg.tool.error,
          duration: msg.tool.duration,
          exitCode: msg.tool.exitCode,
          startTime: msg.tool.startTime,
        };
      }

      return chatMsg;
    });

    setChatHistory(prev => ({
      ...prev,
      [agentId]: transformedMessages,
    }));
  }, []);

  const handleAgentEvent = useCallback((message: any) => {
    // Handle chat history loading
    if (message.type === 'chat_history') {
      const { agentId, messages } = message;
      if (agentId && Array.isArray(messages)) {
        loadChatHistory(agentId, messages);
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
                  status: 'start',
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
                  status: 'end',
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
                  status: 'error',
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
          [streamKey]: (prev[streamKey] || '') + data.delta
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
              content: data.text,
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
      if (data?.text) {
        latestTextRef.current[streamKey] = data.text;
      }
      
      if (data?.delta) {
        setChatStreams(prev => ({
          ...prev,
          [streamKey]: (prev[streamKey] || '') + data.delta
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
  }, [loadChatHistory]);

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

  return {
    chatHistory,
    chatStreams,
    reasoningStreams,
    activeRuns,
    handleAgentEvent,
    addUserMessage
  };
}
