import { useState, useRef, useCallback } from 'react';
import type { ChatMessage } from '@/types';
import { extractAgentId, getStreamKey, getToolId } from '@/lib/gateway-utils';
import { parseTaggedMessage } from '@/lib/event-formatting';

export function useAgentEvents() {
  const [chatHistory, setChatHistory] = useState<Record<string, ChatMessage[]>>({});
  const [chatStreams, setChatStreams] = useState<Record<string, string>>({});
  const [reasoningStreams, setReasoningStreams] = useState<Record<string, string>>({});
  const [activeRuns, setActiveRuns] = useState<Record<string, string>>({});
  const [thinkingTraces, setThinkingTraces] = useState<Record<string, string>>({});
  
  // Refs to store latest accumulated text (synchronous, no state timing issues)
  const latestTextRef = useRef<Record<string, string>>({});
  
  // Track last tool message ID per run for efficient updates
  const lastToolMessageIdRef = useRef<Record<string, string>>({});

  const handleAgentEvent = useCallback((message: any) => {
    // Handle new processed events format
    if (message.type === 'event.processed') {
      handleProcessedEvent(message);
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
      const toolId = getToolId(runId, toolName, seq);
      
      if (toolData.phase === 'start') {
        const toolMsg: ChatMessage = {
          id: toolId,
          role: 'tool',
          content: toolName,
          tool: {
            name: toolName,
            args: toolData.args,
            result: toolData.meta?.result,
            status: toolData.phase
          },
          timestamp: Date.now(),
          runId
        };

        setChatHistory(prev => {
          const currentHistory = prev[agentId] || [];
          if (currentHistory.some(m => m.id === toolId)) return prev;
          return { ...prev, [agentId]: [...currentHistory, toolMsg] };
        });
      } else if (toolData.phase === 'end') {
        setChatHistory(prev => {
          const currentHistory = prev[agentId] || [];
          const updated = currentHistory.map(msg => {
            if (msg.id === toolId && msg.role === 'tool') {
              return {
                ...msg,
                tool: {
                  ...msg.tool!,
                  result: toolData.meta?.result || msg.tool?.result,
                  status: 'end'
                }
              };
            }
            return msg;
          });
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
  }, []);

  // Handler for processed events
  const handleProcessedEvent = useCallback((message: any) => {
    const { agentId, runId, formattedMessages, thinkingDelta, thinkingComplete } = message;
    
    if (!agentId || !runId) return;
    
    const streamKey = getStreamKey(agentId, runId);
    
    // Handle thinking delta (live updates)
    if (thinkingDelta) {
      setThinkingTraces(prev => ({
        ...prev,
        [streamKey]: (prev[streamKey] || '') + thinkingDelta
      }));
    }
    
    // Handle thinking complete (commit to history)
    if (thinkingComplete) {
      const reasoningMsg: ChatMessage = {
        id: `${runId}-reasoning-trace`,
        role: 'reasoning',
        content: thinkingComplete,
        timestamp: Date.now(),
        runId
      };
      
      setChatHistory(prev => {
        const currentHistory = prev[agentId] || [];
        if (currentHistory.some(m => m.id === reasoningMsg.id)) return prev;
        return { ...prev, [agentId]: [...currentHistory, reasoningMsg] };
      });
      
      // Clear thinking trace
      setThinkingTraces(prev => {
        const next = { ...prev };
        delete next[streamKey];
        return next;
      });
    }
    
    // Handle formatted messages (tool calls, results, meta)
    if (formattedMessages && formattedMessages.length > 0) {
      formattedMessages.forEach((formattedMsg: string, idx: number) => {
        const parsed = parseTaggedMessage(formattedMsg);
        
        if (parsed.type === 'tool') {
          const toolMsg: ChatMessage = {
            id: `${runId}-tool-${idx}`,
            role: 'tool',
            content: parsed.toolName || 'unknown',
            tool: {
              name: parsed.toolName || 'unknown',
              args: parsed.toolArgs,
              status: 'start'
            },
            timestamp: Date.now(),
            runId
          };
          
          // Track this tool message ID for efficient result updates
          lastToolMessageIdRef.current[runId] = toolMsg.id;
          
          setChatHistory(prev => {
            const currentHistory = prev[agentId] || [];
            if (currentHistory.some(m => m.id === toolMsg.id)) return prev;
            return { ...prev, [agentId]: [...currentHistory, toolMsg] };
          });
        } else if (parsed.type === 'tool-result') {
          // Use tracked ID for O(1) lookup instead of O(n) iteration
          const targetToolId = lastToolMessageIdRef.current[runId];
          
          setChatHistory(prev => {
            const currentHistory = prev[agentId] || [];
            
            if (!targetToolId) {
              // Fallback: find last tool message for this run
              const updated = [...currentHistory];
              for (let i = updated.length - 1; i >= 0; i--) {
                if (updated[i].role === 'tool' && updated[i].runId === runId) {
                  updated[i] = {
                    ...updated[i],
                    tool: {
                      ...updated[i].tool!,
                      result: parsed.content,
                      status: 'end',
                      ...(parsed.toolMeta && { meta: parsed.toolMeta })
                    }
                  };
                  break;
                }
              }
              return { ...prev, [agentId]: updated };
            }
            
            // Fast path: use tracked ID
            const updated = currentHistory.map(msg => {
              if (msg.id === targetToolId) {
                return {
                  ...msg,
                  tool: {
                    ...msg.tool!,
                    result: parsed.content,
                    status: 'end',
                    ...(parsed.toolMeta && { meta: parsed.toolMeta })
                  }
                };
              }
              return msg;
            });
            
            return { ...prev, [agentId]: updated };
          });
          
          // Clean up tracked ID
          delete lastToolMessageIdRef.current[runId];
        } else if (parsed.type === 'trace') {
          // This is handled by thinkingComplete above
          // But if it comes through formattedMessages, add it
          const traceMsg: ChatMessage = {
            id: `${runId}-trace-${idx}`,
            role: 'reasoning',
            content: parsed.content,
            timestamp: Date.now(),
            runId
          };
          
          setChatHistory(prev => {
            const currentHistory = prev[agentId] || [];
            if (currentHistory.some(m => m.id === traceMsg.id)) return prev;
            return { ...prev, [agentId]: [...currentHistory, traceMsg] };
          });
        }
        // meta messages are mostly for logging/debugging, skip adding to history
      });
    }
  }, []);

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
    thinkingTraces,
    activeRuns,
    handleAgentEvent,
    addUserMessage
  };
}
