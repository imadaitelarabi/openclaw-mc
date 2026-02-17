"use client";

import { memo, useState, useRef, useEffect, useMemo } from 'react';
import { ChatMessageItem, ChatInput, StreamingIndicator, ScrollToBottomButton, ChatHistoryLoader } from '@/components/chat';
import { useChatHistory, useChatPolling } from '@/hooks';
import { uiStateStore } from '@/lib/ui-state-db';
import { debounce } from '@/lib/utils';
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
  activeRunId: string | null;
  assistantStream?: string;
  reasoningStream?: string;
  addUserMessage: (agentId: string, message: string, attachments?: Array<{fileName?: string, type: string, mimeType: string, content: string}>) => void;
  models: any[];
  sessionSettings: Record<string, any>;
  updateSetting: (sessionKey: string, settings: any) => void;
  onAbortRun?: (agentId: string) => void;
  
  // Per-panel settings
  showTools?: boolean;
  showReasoning?: boolean;
  
  // Panel state
  isActive?: boolean;
}

export const ChatPanel = memo(function ChatPanel({
  agentId,
  agent,
  sendMessage,
  connectionStatus,
  chatHistory,
  activeRunId,
  assistantStream,
  reasoningStream,
  addUserMessage,
  sessionSettings,
  onAbortRun,
  showTools = false,
  showReasoning = true,
  isActive = true
}: ChatPanelProps) {
  const [chatInput, setChatInput] = useState("");
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [showHistoryLoader, setShowHistoryLoader] = useState(true); // Show by default if there's history
  const chatEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const shouldAutoScrollRef = useRef(true);
  const previousChatLengthRef = useRef(0);

  // Chat history hook for loading older messages
  const { loading: historyLoading, loadMoreHistory } = useChatHistory({ sendMessage });

  // Polling hook for real-time reasoning and enriched tool calls with adaptive intervals
  const { trackActivity } = useChatPolling({
    agentId,
    activeRunId,
    sendMessage,
    isActivePanel: isActive,
  });

  // Track activity when chat history length increases (new messages arrive)
  useEffect(() => {
    const currentLength = chatHistory.length;
    // Only track activity if length increases and it's not the initial population
    if (currentLength > previousChatLengthRef.current && previousChatLengthRef.current > 0) {
      trackActivity();
    }
    previousChatLengthRef.current = currentLength;
  }, [chatHistory.length, trackActivity]);

  // Debounced scroll position save function
  const debouncedSaveScroll = useMemo(
    () => debounce((agentId: string, position: number) => {
      uiStateStore.saveScrollPosition(agentId, position);
    }, 300),
    []
  );

  // Cleanup debounced function on unmount
  useEffect(() => {
    return () => {
      debouncedSaveScroll.cancel();
    };
  }, [debouncedSaveScroll]);

  // Filter messages based on per-panel settings
  const filteredChatHistory = useMemo(() => {
    return chatHistory.filter(msg => {
      // Filter out reasoning messages if showReasoning is false
      if (msg.role === 'reasoning' && !showReasoning) {
        return false;
      }
      // Filter out tool messages if showTools is false
      if (msg.role === 'tool' && !showTools) {
        return false;
      }
      return true;
    });
  }, [chatHistory, showReasoning, showTools]);

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

  const sendChatMessage = (attachments?: any[]) => {
    if (!agentId || (!chatInput.trim() && (!attachments || attachments.length === 0))) return;
    
    // Convert attachments to the Gateway protocol format
    const attachmentData = attachments && attachments.length > 0 
      ? attachments.map(att => ({
          fileName: att.name,
          type: 'image',
          mimeType: att.mimeType,
          content: att.media,
        }))
      : undefined;
    
    // Add user message with attachments
    addUserMessage(agentId, chatInput, attachmentData);
    
    const messageData: any = { 
      type: 'chat.send', 
      agentId: agentId, 
      message: chatInput 
    };
    
    // Add attachments if provided
    if (attachmentData) {
      messageData.attachments = attachmentData;
    }
    
    sendMessage(messageData);
    setChatInput("");
    // Clear draft after sending
    uiStateStore.clearDraft(agentId);
    
    // Scroll to bottom to show new user message
    scrollToBottom();
  };

  // Check if user has manually scrolled up
  const handleScroll = () => {
    if (!scrollContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    // Consider "at bottom" if within 50px of the bottom
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
    shouldAutoScrollRef.current = isAtBottom;
    setShowScrollButton(!isAtBottom);
    
    // Save scroll position with debounce (max once every 300ms)
    debouncedSaveScroll(agentId, scrollTop);
  };

  useEffect(() => {
    // Only scroll if we're supposed to auto-scroll and this is our own content
    if (shouldAutoScrollRef.current && chatEndRef.current && scrollContainerRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'auto' });
    }
  }, [chatHistory, assistantStream, agentId]);

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

  return (
    <div className="flex flex-col h-full relative">
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

          {filteredChatHistory.map((msg) => (
            <ChatMessageItem key={msg.id} message={msg} showTools={showTools} />
          ))}
          
          <StreamingIndicator 
            assistantStream={assistantStream}
            reasoningStream={showReasoning ? reasoningStream : undefined}
            isTyping={Boolean(activeRunId)}
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
        isRunning={Boolean(activeRunId)}
        onAbort={() => onAbortRun?.(agentId)}
      />
    </div>
  );
});

ChatPanel.displayName = 'ChatPanel';
