"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { MessageSquare, LayoutGrid, Wifi, WifiOff } from "lucide-react";
import { useGatewayWebSocket, useAgentEvents, useSessionSettings, useToast } from "@/hooks";
import { StatusBar } from "@/components/layout";
import { MobileControlPanel } from "@/components/mobile";
import { GatewaySetup } from "@/components/gateway/GatewaySetup";
import { PanelProvider, usePanels } from "@/contexts/PanelContext";
import { PanelContainer } from "@/components/panels";
import { ChatMessageItem, ChatInput, StreamingIndicator } from "@/components/chat";
import { getStreamKey } from "@/lib/gateway-utils";

export const dynamic = 'force-dynamic';

export default function MissionControl() {
  return (
    <PanelProvider maxPanels={2}>
      <MissionControlInner />
    </PanelProvider>
  );
}

function MissionControlInner() {
  const { layout, openPanel, closePanel, setActivePanel } = usePanels();
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [chatInput, setChatInput] = useState("");
  const [isAgentMenuOpen, setIsAgentMenuOpen] = useState(false);
  const [isMobilePanelOpen, setIsMobilePanelOpen] = useState(false);
  const [gateways, setGateways] = useState<any[]>([]);
  const [activeGatewayId, setActiveGatewayId] = useState<string | null>(null);
  const [showSetup, setShowSetup] = useState(false);
  const [isGatewayConnecting, setIsGatewayConnecting] = useState(false);
  
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
    if (connectionStatus !== 'connected') {
      setIsGatewayConnecting(false);
    }
  }, [connectionStatus]);

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
      } else if (message.type === 'gateways.add.ack') {
        setIsGatewayConnecting(false);
        sendMessage({ type: 'gateways.list' });
        setShowSetup(false);
      } else if (message.type === 'gateways.switch.ack' || message.type === 'gateways.remove.ack') {
        sendMessage({ type: 'gateways.list' });
        setShowSetup(false);
      } else if (message.type === 'error') {
        setIsGatewayConnecting(false);
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
  
  // Get the active panel
  const activePanel = layout.panels.find(p => p.id === layout.activePanel);
  const activePanelAgent = activePanel?.agentId ? agents.find(a => a.id === activePanel.agentId) : undefined;

  // Handler to open chat panel for an agent
  const handleSelectAgent = useCallback((agentId: string) => {
    setSelectedAgent(agentId);
    const agent = agents.find(a => a.id === agentId);
    openPanel('chat', { agentId, agentName: agent?.name || 'Chat' });
  }, [agents, openPanel]);
  
  // Handler to open create agent panel
  const handleCreateAgent = useCallback(() => {
    openPanel('create-agent');
  }, [openPanel]);

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

  // Use the active panel's agent for session key
  const activePanelAgentId = activePanel?.agentId;
  const sessionKey = activePanelAgentId ? `agent:${activePanelAgentId}:main` : null;

  if (connectionStatus === 'no-config' || showSetup) {
    return (
      <GatewaySetup 
        isLoading={isGatewayConnecting}
        onConnect={(name, url, token) => {
          setIsGatewayConnecting(true);
          sendMessage({ type: 'gateways.add', name, url, token });
        }}
        onCancel={gateways.length > 0 ? () => {
          setIsGatewayConnecting(false);
          setShowSetup(false);
        } : undefined}
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
            {activePanelAgent?.name || "Mission Control"}
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

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-h-0 relative overflow-hidden">
        {layout.panels.length === 0 ? (
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
          <PanelContainer
            panels={layout.panels}
            activePanel={layout.activePanel}
            onPanelActivate={setActivePanel}
            onPanelClose={closePanel}
            agents={agents}
            sendMessage={sendMessage}
            connectionStatus={connectionStatus}
            chatHistory={chatHistory}
            chatStreams={chatStreams}
            reasoningStreams={reasoningStreams}
            activeRuns={activeRuns}
            addUserMessage={addUserMessage}
            models={models}
            sessionSettings={sessionSettings}
            updateSetting={updateSetting}
          />
        )}
      </div>

      {/* Desktop Footer Status Bar */}
      <div className="hidden md:block">
        <StatusBar
          agents={agents}
          selectedAgent={activePanel?.agentId || null}
          activeAgent={activePanelAgent}
          connectionStatus={connectionStatus}
          isAgentMenuOpen={isAgentMenuOpen}
          onToggleAgentMenu={() => setIsAgentMenuOpen(!isAgentMenuOpen)}
          onSelectAgent={handleSelectAgent}
          onCreateAgent={handleCreateAgent}
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
        selectedAgent={activePanel?.agentId || null}
        activeAgent={activePanelAgent}
        onSelectAgent={(id) => {
          handleSelectAgent(id);
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
