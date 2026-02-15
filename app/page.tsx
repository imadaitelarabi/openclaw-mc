"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { MessageSquare, LayoutGrid, Wifi, WifiOff } from "lucide-react";
import { useGatewayWebSocket, useAgentEvents, useSessionSettings, useToast } from "@/hooks";
import { ChatMessageItem, ChatInput, StreamingIndicator } from "@/components/chat";
import { StatusBar } from "@/components/layout";
import { MobileControlPanel } from "@/components/mobile";
import { GatewaySetup } from "@/components/gateway/GatewaySetup";
import { getStreamKey } from "@/lib/gateway-utils";

export const dynamic = 'force-dynamic';

export default function MissionControl() {
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [chatInput, setChatInput] = useState("");
  const [isAgentMenuOpen, setIsAgentMenuOpen] = useState(false);
  const [isMobilePanelOpen, setIsMobilePanelOpen] = useState(false);
  const [gateways, setGateways] = useState<any[]>([]);
  const [activeGatewayId, setActiveGatewayId] = useState<string | null>(null);
  const [showSetup, setShowSetup] = useState(false);
  
  const chatEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Custom hooks for WebSocket and event handling
  const { 
    chatHistory, 
    chatStreams, 
    reasoningStreams, 
    activeRuns, 
    handleAgentEvent, 
    addUserMessage 
  } = useAgentEvents();

  const onEventRef = useRef<(message: any) => void>(() => {});
  const stableOnEvent = useCallback((message: any) => {
    onEventRef.current(message);
  }, []);

  const { 
    connectionStatus, 
    agents, 
    sendMessage 
  } = useGatewayWebSocket({ 
    onEvent: stableOnEvent
  });

  const {
    models,
    sessionSettings,
    loading,
    updateSetting,
    setModels,
    setSessionSettings,
    setLoading
  } = useSessionSettings(selectedAgent, sendMessage, connectionStatus);

  // Request gateways on connect
  useEffect(() => {
    if (connectionStatus === 'connected') {
      sendMessage({ type: 'gateways.list' });
    }
  }, [connectionStatus, sendMessage]);

  useEffect(() => {
    onEventRef.current = (message) => {
      handleAgentEvent(message);
      if (message.type === 'models' && message.data) {
        setModels(message.data.models || []);
      } else if (message.type === 'gateways.list') {
        setGateways(message.data || []);
        setActiveGatewayId(message.activeId);
        if (message.data.length === 0) {
          setShowSetup(true);
        }
      } else if (message.type === 'gateways.add.ack' || message.type === 'gateways.switch.ack' || message.type === 'gateways.remove.ack') {
        sendMessage({ type: 'gateways.list' });
        setShowSetup(false);
      } else if (message.type === 'error') {
        toast({
          title: "Gateway Error",
          description: message.message,
          variant: "destructive"
        });
        setLoading(false);
      } else if (message.type === 'sessions' && message.data) {
        const sessions = message.data.sessions || [];
        if (selectedAgent) {
          const agentSession = sessions.find((s: any) => 
            s.key?.includes(`agent:${selectedAgent}`)
          );
          if (agentSession) {
            setSessionSettings({
              model: agentSession.model,
              thinking: agentSession.thinkingLevel || 'low',
              verbose: agentSession.verboseLevel || 'off',
              reasoning: agentSession.reasoningLevel || 'off'
            });
          }
        }
        setLoading(false);
      } else if (message.type === 'sessions.patch.ack') {
        setLoading(false);
      }
    };
  });

  const activeAgent = agents.find(a => a.id === selectedAgent);

  const sendChatMessage = () => {
    if (!selectedAgent || !chatInput.trim()) return;
    addUserMessage(selectedAgent, chatInput);
    sendMessage({ 
      type: 'chat.send', 
      agentId: selectedAgent, 
      message: chatInput 
    });
    setChatInput("");
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, chatStreams, selectedAgent]);

  const currentStreamKey = selectedAgent && activeRuns[selectedAgent] 
    ? getStreamKey(selectedAgent, activeRuns[selectedAgent])
    : null;
  
  const assistantStream = currentStreamKey ? chatStreams[currentStreamKey] : undefined;
  const reasoningStream = currentStreamKey ? reasoningStreams[currentStreamKey] : undefined;
  const sessionKey = selectedAgent ? `agent:${selectedAgent}:main` : null;

  if (connectionStatus === 'no-config' || showSetup) {
    return (
      <GatewaySetup 
        isLoading={connectionStatus === 'connecting'} 
        onConnect={(name, url, token) => {
          sendMessage({ type: 'gateways.add', name, url, token });
        }}
        onCancel={gateways.length > 0 ? () => setShowSetup(false) : undefined}
      />
    );
  }

  return (
    <div className="fixed inset-0 bg-background text-foreground flex flex-col font-mono overflow-hidden overscroll-none select-none">
      {/* Mobile-only Header */}
      <header className="flex md:hidden items-center justify-between px-4 h-14 border-b border-border bg-background/80 backdrop-blur-lg z-40">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          <span className="font-bold text-sm tracking-tight truncate max-w-[150px]">
            {activeAgent?.name || "Mission Control"}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <div className={connectionStatus === 'connected' ? 'text-primary' : 'text-destructive'}>
            {connectionStatus === 'connected' ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
          </div>
          <button 
            onClick={() => setIsMobilePanelOpen(true)}
            className="p-2 bg-secondary rounded-xl active:scale-90 transition-transform"
          >
            <LayoutGrid className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-h-0 relative overflow-hidden">
        {!selectedAgent ? (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground p-8 text-center">
            <div className="relative mb-6">
              <MessageSquare className="w-20 h-20 opacity-10" />
              <LayoutGrid className="w-8 h-8 absolute -bottom-2 -right-2 opacity-20" />
            </div>
            <h1 className="text-xl font-bold text-foreground mb-2">Ready for deployment</h1>
            <p className="max-w-xs text-sm opacity-60">Select an agent from the command panel to establish a secure uplink.</p>
            <button 
              onClick={() => setIsMobilePanelOpen(true)}
              className="mt-8 px-6 py-3 bg-primary text-primary-foreground rounded-2xl font-bold md:hidden"
            >
              Open Command Panel
            </button>
          </div>
        ) : (
          <>
            {/* Chat History */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-6 overscroll-contain">
              <div className="max-w-4xl mx-auto space-y-6 pb-4">
                {(chatHistory[selectedAgent] || []).map((msg) => (
                  <ChatMessageItem key={msg.id} message={msg} />
                ))}
                
                <StreamingIndicator 
                  assistantStream={assistantStream}
                  reasoningStream={reasoningStream}
                  isTyping={!!(selectedAgent && activeRuns[selectedAgent])}
                />
                
                <div ref={chatEndRef} />
              </div>
            </div>

            {/* Input Area */}
            <ChatInput
              value={chatInput}
              onChange={setChatInput}
              onSend={sendChatMessage}
              activeAgent={activeAgent}
              disabled={connectionStatus !== 'connected'}
            />
          </>
        )}
      </div>

      {/* Desktop Footer Status Bar */}
      <div className="hidden md:block">
        <StatusBar
          agents={agents}
          selectedAgent={selectedAgent}
          activeAgent={activeAgent}
          connectionStatus={connectionStatus}
          isAgentMenuOpen={isAgentMenuOpen}
          onToggleAgentMenu={() => setIsAgentMenuOpen(!isAgentMenuOpen)}
          onSelectAgent={setSelectedAgent}
          models={models}
          currentModel={sessionSettings.model}
          thinkingMode={sessionSettings.thinking || 'low'}
          verboseMode={sessionSettings.verbose || 'off'}
          reasoningMode={sessionSettings.reasoning || 'off'}
          onModelChange={sessionKey ? (model, provider) => updateSetting(sessionKey, { model, modelProvider: provider }) : undefined}
          onThinkingChange={sessionKey ? (thinking) => updateSetting(sessionKey, { thinking }) : undefined}
          onVerboseChange={sessionKey ? (verbose) => updateSetting(sessionKey, { verbose }) : undefined}
          onReasoningChange={sessionKey ? (reasoning) => updateSetting(sessionKey, { reasoning }) : undefined}
          
          gateways={gateways}
          activeGatewayId={activeGatewayId}
          onSwitchGateway={(id) => sendMessage({ type: 'gateways.switch', id })}
          onAddGateway={() => setShowSetup(true)}
          onRemoveGateway={(id) => sendMessage({ type: 'gateways.remove', id })}
        />
      </div>

      {/* Mobile Command Center Overlay */}
      <MobileControlPanel
        isOpen={isMobilePanelOpen}
        onClose={() => setIsMobilePanelOpen(false)}
        agents={agents}
        selectedAgent={selectedAgent}
        activeAgent={activeAgent}
        onSelectAgent={(id) => {
          setSelectedAgent(id);
          setIsMobilePanelOpen(false);
        }}
        models={models}
        currentModel={sessionSettings.model}
        thinkingMode={sessionSettings.thinking || 'low'}
        verboseMode={sessionSettings.verbose || 'off'}
        reasoningMode={sessionSettings.reasoning || 'off'}
        onModelChange={sessionKey ? (model, provider) => updateSetting(sessionKey, { model, modelProvider: provider }) : undefined}
        onThinkingChange={sessionKey ? (thinking) => updateSetting(sessionKey, { thinking }) : undefined}
        onVerboseChange={sessionKey ? (verbose) => updateSetting(sessionKey, { verbose }) : undefined}
        onReasoningChange={sessionKey ? (reasoning) => updateSetting(sessionKey, { reasoning }) : undefined}
        
        connectionStatus={connectionStatus}
        gateways={gateways}
        activeGatewayId={activeGatewayId}
        onSwitchGateway={(id) => sendMessage({ type: 'gateways.switch', id })}
        onAddGateway={() => {
          setShowSetup(true);
          setIsMobilePanelOpen(false);
        }}
        onRemoveGateway={(id) => sendMessage({ type: 'gateways.remove', id })}
      />
      
      {/* Click outside desktop menu */}
      {isAgentMenuOpen && (
        <div className="fixed inset-0 z-40" onClick={() => setIsAgentMenuOpen(false)} />
      )}
    </div>
  );
}
