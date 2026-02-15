"use client";

import { useState, useRef, useEffect } from 'react';
import { ChatMessageItem, ChatInput, StreamingIndicator } from '@/components/chat';
import { getStreamKey } from '@/lib/gateway-utils';
import type { Agent } from '@/types';

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
  addUserMessage
}: ChatPanelProps) {
  const [chatInput, setChatInput] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);

  const sendChatMessage = () => {
    if (!agentId || !chatInput.trim()) return;
    addUserMessage(agentId, chatInput);
    sendMessage({ 
      type: 'chat.send', 
      agentId: agentId, 
      message: chatInput 
    });
    setChatInput("");
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, chatStream, agentId]);

  const currentStreamKey = agentId && activeRuns[agentId] 
    ? getStreamKey(agentId, activeRuns[agentId])
    : null;
  
  const assistantStream = currentStreamKey ? chatStream[currentStreamKey] : undefined;
  const reasoningStreamData = currentStreamKey ? reasoningStream[currentStreamKey] : undefined;

  return (
    <div className="flex flex-col h-full">
      {/* Chat History */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-6 overscroll-contain">
        <div className="max-w-4xl mx-auto space-y-6 pb-4">
          {chatHistory.map((msg) => (
            <ChatMessageItem key={msg.id} message={msg} />
          ))}
          
          <StreamingIndicator 
            assistantStream={assistantStream}
            reasoningStream={reasoningStreamData}
            isTyping={!!(agentId && activeRuns[agentId])}
          />
          
          <div ref={chatEndRef} />
        </div>
      </div>

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
