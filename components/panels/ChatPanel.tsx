"use client";

import { useState, useRef, useEffect } from 'react';
import { ChatMessageItem, ChatInput, StreamingIndicator, ScrollToBottomButton, ChatHistoryLoader } from '@/components/chat';
import { useChatHistory, useChatPolling } from '@/hooks';
import { getStreamKey } from '@/lib/gateway-utils';
import { uiStateStore } from '@/lib/ui-state-db';
import type { Agent } from '@/types';

// Constants
const HISTORY_PAGE_SIZE = 50;
const DRAFT_SAVE_DEBOUNCE_MS = 500;
const SCROLL_RESTORE_DELAY_MS = 100;

interface ChatPanelProps {
  agentId: string;
  agent?: Agent;
  sendMessage: (msg: any) => void;
  connectionStatus: string;
  chatHistory: any[];
  chatStream: Record<string, string>;
  reasoningStream: Record<string, string>;
  activeRuns: Record<string, string>;
  addUserMessage: (agentId: string, message: string) => void;
  models: any[];
  sessionSettings: Record<string, any>;
  updateSetting: (sessionKey: string, settings: any) => void;
}

export function ChatPanel({
  agentId,
  agent,
  sendMessage,
  connectionStatus,
  chatHistory,
  chatStream,
  reasoningStream,
  activeRuns,
  addUserMessage,
  sessionSettings
}: ChatPanelProps) {
  const [chatInput, setChatInput] = useState("");
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [showHistoryLoader, setShowHistoryLoader] = useState(true); // Show by default if there's history
  const chatEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const shouldAutoScrollRef = useRef(true);

  // Chat history hook for loading older messages
  const { loading: historyLoading, loadMoreHistory } = useChatHistory({ sendMessage });

  // Polling hook for real-time reasoning and enriched tool calls
  const currentRunId = activeRuns[agentId] || null;
  const { isPolling } = useChatPolling({
    agentId,
    activeRunId: currentRunId,
    sendMessage,
  });

  // Extract verbose mode from session settings
  const verboseMode = sessionSettings?.verbose || 'off';

  // Load draft on mount
  useEffect(() => {
    const loadDraft = async () => {
      const draft = await uiStateStore.getDraft(agentId);
      if (draft) {
        setChatInput(draft);
      }
    };
    loadDraft();
  }, [agentId]);

  // Restore scroll position on mount
  useEffect(() => {
    const restoreScroll = async () => {
      const position = await uiStateStore.getScrollPosition(agentId);
      if (position !== null && scrollContainerRef.current) {
        // Wait for next paint cycle, then restore
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            if (scrollContainerRef.current) {
              scrollContainerRef.current.scrollTop = position;
              const { scrollHeight, clientHeight } = scrollContainerRef.current;
              const isAtBottom = scrollHeight - position - clientHeight < 50;
              shouldAutoScrollRef.current = isAtBottom;
              console.log(`[ChatPanel] Restored scroll position to ${position}px`);
            }
          });
        });
      }
    };
    restoreScroll();
  }, [agentId]);

  // Save draft on input change (debounced)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (chatInput) {
        uiStateStore.saveDraft(agentId, chatInput);
      } else {
        uiStateStore.clearDraft(agentId);
      }
    }, DRAFT_SAVE_DEBOUNCE_MS);

    return () => clearTimeout(timeoutId);
  }, [chatInput, agentId]);

  const sendChatMessage = () => {
    if (!agentId || !chatInput.trim()) return;
    addUserMessage(agentId, chatInput);
    sendMessage({ 
      type: 'chat.send', 
      agentId: agentId, 
      message: chatInput 
    });
    setChatInput("");
    // Clear draft after sending
    uiStateStore.clearDraft(agentId);
  };

  // Check if user has manually scrolled up
  const handleScroll = () => {
    if (!scrollContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    // Consider "at bottom" if within 50px of the bottom
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
    shouldAutoScrollRef.current = isAtBottom;
    setShowScrollButton(!isAtBottom);
    
    // Save scroll position periodically
    uiStateStore.saveScrollPosition(agentId, scrollTop);
  };

  useEffect(() => {
    // Only scroll if we're supposed to auto-scroll and this is our own content
    if (shouldAutoScrollRef.current && chatEndRef.current && scrollContainerRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatHistory, chatStream, agentId]);

  const scrollToBottom = () => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Handle loading more history
  const handleLoadMore = async () => {
    if (chatHistory.length === 0) return;
    
    // Get the oldest message ID for pagination
    const oldestMessage = chatHistory[0];
    const beforeId = oldestMessage?.id;
    
    if (beforeId) {
      await loadMoreHistory(agentId, HISTORY_PAGE_SIZE, beforeId);
    }
  };

  const currentStreamKey = agentId && activeRuns[agentId] 
    ? getStreamKey(agentId, activeRuns[agentId])
    : null;
  
  const assistantStream = currentStreamKey ? chatStream[currentStreamKey] : undefined;
  const reasoningStreamData = currentStreamKey ? reasoningStream[currentStreamKey] : undefined;

  return (
    <div className="flex flex-col h-full">
      {/* Chat History */}
      <div 
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-6 overscroll-contain"
      >
        <div className="max-w-4xl mx-auto space-y-6 pb-4">
          {/* History Loader - shows at top if there's history */}
          {showHistoryLoader && chatHistory.length > 0 && (
            <ChatHistoryLoader
              agentId={agentId}
              loading={historyLoading[agentId] || false}
              onLoadMore={handleLoadMore}
            />
          )}

          {chatHistory.map((msg) => (
            <ChatMessageItem key={msg.id} message={msg} verboseMode={verboseMode} />
          ))}
          
          <StreamingIndicator 
            assistantStream={assistantStream}
            reasoningStream={reasoningStreamData}
            isTyping={!!(agentId && activeRuns[agentId])}
          />
          
          <div ref={chatEndRef} />
        </div>
      </div>

      {/* Scroll to Bottom Button */}
      <ScrollToBottomButton onClick={scrollToBottom} visible={showScrollButton} />

      {/* Input Area */}
      <ChatInput
        value={chatInput}
        onChange={setChatInput}
        onSend={sendChatMessage}
        activeAgent={agent}
        disabled={connectionStatus !== 'connected'}
      />
    </div>
  );
}
