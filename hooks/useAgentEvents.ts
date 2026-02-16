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

  const handleAgentEvent = useCallback((message: any) => {
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
            status: 'start',
            startTime: Date.now()
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
              const duration = msg.tool?.startTime 
                ? Date.now() - msg.tool.startTime 
                : undefined;
              
              // Extract exit code if available (for exec tools)
              const exitCode = toolData.meta?.exitCode !== undefined 
                ? toolData.meta.exitCode 
                : toolData.meta?.result?.exitCode;

              return {
                ...msg,
                tool: {
                  ...msg.tool!,
                  result: toolData.meta?.result || msg.tool?.result,
                  status: 'end',
                  duration,
                  exitCode
                }
              };
            }
            return msg;
          });
          return { ...prev, [agentId]: updated };
        });
      } else if (toolData.phase === 'error') {
        setChatHistory(prev => {
          const currentHistory = prev[agentId] || [];
          const updated = currentHistory.map(msg => {
            if (msg.id === toolId && msg.role === 'tool') {
              const duration = msg.tool?.startTime 
                ? Date.now() - msg.tool.startTime 
                : undefined;

              return {
                ...msg,
                tool: {
                  ...msg.tool!,
                  status: 'error',
                  error: toolData.error || toolData.meta?.error || 'Tool execution failed',
                  duration
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
