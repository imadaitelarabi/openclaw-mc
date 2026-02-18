"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { MessageSquare, LayoutGrid, Wifi, WifiOff } from "lucide-react";
import { useGatewayWebSocket, useAgentEvents, useSessionSettings, useToast, useSessionControl, useCronJobs } from "@/hooks";
import { StatusBar } from "@/components/layout";
import { MobileControlPanel } from "@/components/mobile";
import { GatewaySetup } from "@/components/gateway/GatewaySetup";
import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";
import { PanelProvider, usePanels } from "@/contexts/PanelContext";
import { PanelContainer } from "@/components/panels";
import { ConfirmationModal } from "@/components/modals";
import { uiStateStore } from "@/lib/ui-state-db";

export const dynamic = 'force-dynamic';

export default function MissionControl() {
  return (
    <PanelProvider maxPanels={2}>
      <MissionControlInner />
    </PanelProvider>
  );
}

function MissionControlInner() {
  const { layout, openPanel, closePanel, setActivePanel, updatePanelSettings, updatePanelSessionSettings, getActivePanel } = usePanels();
  const [isAgentMenuOpen, setIsAgentMenuOpen] = useState(false);
  const [isCronMenuOpen, setIsCronMenuOpen] = useState(false);
  const [isMobilePanelOpen, setIsMobilePanelOpen] = useState(false);
  const [gateways, setGateways] = useState<any[]>([]);
  const [activeGatewayId, setActiveGatewayId] = useState<string | null>(null);
  const [showSetup, setShowSetup] = useState(false);
  const [isGatewayConnecting, setIsGatewayConnecting] = useState(false);
  // Onboarding state: null = not yet checked, true = show wizard, false = skip wizard
  const [showOnboarding, setShowOnboarding] = useState<boolean | null>(null);
  const [onboardingChecked, setOnboardingChecked] = useState(false);
  // Delete agent confirmation modal state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [agentToDelete, setAgentToDelete] = useState<{ id: string; name: string } | null>(null);
  
  const { toast } = useToast();
  const pendingRequestsRef = useRef(new Map<string, {
    ackType: string;
    resolve: (message: any) => void;
    reject: (error: Error) => void;
    timeoutId: ReturnType<typeof setTimeout>;
  }>());
  const hydratedHistoryAgentsRef = useRef(new Set<string>());

  // Custom hooks for WebSocket and event handling
  const { 
    chatHistory, 
    chatStreams, 
    reasoningStreams,
    activeRuns,
    activeRunData,
    handleAgentEvent, 
    addUserMessage,
    clearChatHistory
  } = useAgentEvents();

  const onEventRef = useRef<(message: any) => void>(() => {});
  const stableOnEvent = useCallback((message: any) => {
    onEventRef.current(message);
  }, []);

  const { 
    connectionStatus, 
    agents, 
    sendMessage,
    wsRef
  } = useGatewayWebSocket({ 
    onEvent: stableOnEvent
  });

  // Cron jobs hook
  const {
    jobs: cronJobs,
    status: cronStatus,
    addJob: addCronJob,
    updateJob: updateCronJob,
    deleteJob: deleteCronJob,
    refreshJobs: refreshCronJobs,
  } = useCronJobs({ 
    wsRef,
    connectionStatus,
    onEvent: (event) => {
      // Handle cron events if needed
      console.log('[App] Cron event:', event);
    }
  });

  // Get the active panel and its settings
  const activePanel = getActivePanel();
  const activePanelAgentId = activePanel?.agentId;

  const {
    models,
    sessionSettings,
    loading,
    updateSetting,
    setModels,
    setSessionSettings,
    setLoading
  } = useSessionSettings(activePanelAgentId || null, sendMessage, connectionStatus);

  // Session control hook for abort and reset
  const { abortRun, resetSession } = useSessionControl({ sendMessage });

  const handleAbortRun = useCallback((agentId: string) => {
    if (connectionStatus !== 'connected') {
      toast({
        title: 'Not connected',
        description: 'Cannot stop run while disconnected.',
        variant: 'destructive'
      });
      return;
    }

    abortRun(agentId);
  }, [abortRun, connectionStatus, toast]);

  // Enhanced reset handler that also clears UI history
  const handleResetSession = useCallback((agentId: string) => {
    resetSession(agentId);
    clearChatHistory(agentId);
  }, [resetSession, clearChatHistory]);

  const sendRequestWithAck = useCallback((payload: any, ackType: string, timeoutMs = 20000) => {
    return new Promise<any>((resolve, reject) => {
      const requestId = typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

      const timeoutId = setTimeout(() => {
        pendingRequestsRef.current.delete(requestId);
        reject(new Error('Request timed out. Please try again.'));
      }, timeoutMs);

      pendingRequestsRef.current.set(requestId, {
        ackType,
        resolve,
        reject,
        timeoutId
      });

      sendMessage({ ...payload, requestId });
    });
  }, [sendMessage]);

  const isOnboardingForced = useCallback(() => {
    if (typeof window === 'undefined') return false;
    return ['1', 'true', 'yes', 'force'].includes(
      (new URLSearchParams(window.location.search).get('onboarding') || '').toLowerCase()
    );
  }, []);

  // Request gateways on connect
  useEffect(() => {
    if (connectionStatus === 'connected') {
      sendMessage({ type: 'gateways.list' });
    }
  }, [connectionStatus, sendMessage]);

  // On refresh, rehydrate chat history for already open chat panels.
  useEffect(() => {
    if (connectionStatus !== 'connected') return;

    const openChatAgentIds = Array.from(new Set(
      layout.panels
        .filter((panel) => panel.type === 'chat' && panel.agentId)
        .map((panel) => panel.agentId as string)
    ));

    for (const agentId of openChatAgentIds) {
      if (hydratedHistoryAgentsRef.current.has(agentId)) continue;

      sendMessage({
        type: 'chat.history.load',
        agentId,
        params: {
          sessionKey: `agent:${agentId}:main`,
          limit: 50,
        },
      });

      hydratedHistoryAgentsRef.current.add(agentId);
    }
  }, [connectionStatus, layout.panels, sendMessage]);

  // Check onboarding status on mount and when connection status or gateways change
  useEffect(() => {
    const checkOnboarding = async () => {
      try {
        const forceOnboarding = isOnboardingForced();

        if (forceOnboarding) {
          setOnboardingChecked(true);
          setShowOnboarding(true);
          setShowSetup(false);
          return;
        }

        const state = await uiStateStore.getOnboardingState();
        const hasCompletedOnboarding = state?.isOnboarded === true;
        
        setOnboardingChecked(true);
        
        // Show onboarding wizard for first-time users with no gateway configured
        if (!hasCompletedOnboarding && connectionStatus === 'no-config' && gateways.length === 0) {
          setShowOnboarding(true);
        } else {
          setShowOnboarding(false);
        }
      } catch (err) {
        console.error('Failed to check onboarding state:', err);
        setOnboardingChecked(true);
        setShowOnboarding(false);
      }
    };
    
    checkOnboarding();
  }, [gateways.length, connectionStatus, isOnboardingForced]);

  useEffect(() => {
    if (connectionStatus !== 'connected') {
      setIsGatewayConnecting(false);
    }
  }, [connectionStatus]);

  useEffect(() => {
    onEventRef.current = (message) => {
      const requestId = message?.requestId;
      if (requestId) {
        const pending = pendingRequestsRef.current.get(requestId);
        if (pending) {
          if (message.type === pending.ackType) {
            clearTimeout(pending.timeoutId);
            pending.resolve(message);
            pendingRequestsRef.current.delete(requestId);
            return;
          }
          if (message.type === 'error') {
            clearTimeout(pending.timeoutId);
            pending.reject(new Error(message.message || 'Request failed'));
            pendingRequestsRef.current.delete(requestId);
            return;
          }
        }
      }

      handleAgentEvent(message);
      if (message.type === 'models' && message.data) {
        setModels(message.data.models || []);
      } else if (message.type === 'gateways.list') {
        setGateways(message.data || []);
        setActiveGatewayId(message.activeId);
        if (message.data.length === 0 && !isOnboardingForced()) {
          setShowSetup(true);
        }
      } else if (message.type === 'gateways.add.ack') {
        setIsGatewayConnecting(false);
        sendMessage({ type: 'gateways.list' });
        setShowSetup(false);
      } else if (message.type === 'gateways.switch.ack' || message.type === 'gateways.remove.ack') {
        sendMessage({ type: 'gateways.list' });
        setShowSetup(false);
      } else if (message.type === 'chat.abort.run.ack') {
        if (message.ok) {
          toast({
            title: 'Run stopped',
            description: 'Generation was aborted.'
          });
        } else {
          toast({
            title: 'Stop failed',
            description: message.error || 'Failed to abort run.',
            variant: 'destructive'
          });
        }
      } else if (message.type === 'error') {
        if (message.requestId) {
          return;
        }

        // Some server errors are emitted without requestId.
        // Fail all pending request/ack waits immediately so UI loading states stop now,
        // instead of waiting for timeout.
        pendingRequestsRef.current.forEach((pending, id) => {
          clearTimeout(pending.timeoutId);
          pending.reject(new Error(message.message || 'Request failed'));
          pendingRequestsRef.current.delete(id);
        });

        setIsGatewayConnecting(false);
        toast({
          title: "Gateway Error",
          description: message.message,
          variant: "destructive"
        });
        setLoading(false);
      } else if (message.type === 'sessions' && message.data) {
        const sessions = message.data.sessions || [];
        
        // Update the active panel's session settings in the global state
        if (activePanelAgentId) {
          const agentSession = sessions.find((s: any) => 
            s.key?.includes(`agent:${activePanelAgentId}`)
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
        
        // Update all chat panels with their respective session settings
        layout.panels.forEach(panel => {
          if (panel.type === 'chat' && panel.agentId) {
            const panelSession = sessions.find((s: any) => 
              s.key?.includes(`agent:${panel.agentId}`)
            );
            if (panelSession) {
              updatePanelSessionSettings(panel.id, {
                model: panelSession.model,
                modelProvider: panelSession.modelProvider,
                thinking: panelSession.thinkingLevel || 'low'
              });
            }
          }
        });
        
        setLoading(false);
      } else if (message.type === 'sessions.patch.ack') {
        setLoading(false);
      }
    };
  }, [
    handleAgentEvent,
    setModels,
    activePanelAgentId,
    setSessionSettings,
    setLoading,
    sendMessage,
    toast,
    clearChatHistory,
    isOnboardingForced,
    layout.panels,
    updatePanelSessionSettings,
  ]);

  useEffect(() => {
    return () => {
      pendingRequestsRef.current.forEach((pending) => {
        clearTimeout(pending.timeoutId);
      });
      pendingRequestsRef.current.clear();
    };
  }, []);

  // Calculate active panel agent for UI display
  const activePanelAgent = activePanel?.agentId ? agents.find(a => a.id === activePanel.agentId) : undefined;

  // Handlers for updating per-panel settings
  const handleShowToolsChange = useCallback((show: boolean) => {
    if (activePanel?.id) {
      updatePanelSettings(activePanel.id, { showTools: show });
    }
  }, [activePanel?.id, updatePanelSettings]);

  const handleShowReasoningChange = useCallback((show: boolean) => {
    if (activePanel?.id) {
      updatePanelSettings(activePanel.id, { showReasoning: show });
    }
  }, [activePanel?.id, updatePanelSettings]);

  // Handler to open chat panel for an agent
  const handleSelectAgent = useCallback((agentId: string) => {
    const agent = agents.find(a => a.id === agentId);
    openPanel('chat', { agentId, agentName: agent?.name || 'Chat' });
    // Request session settings for this agent
    if (connectionStatus === 'connected') {
      sendMessage({ type: 'sessions.list' });
    }
  }, [agents, openPanel, connectionStatus, sendMessage]);
  
  // Handler to open create agent panel
  const handleCreateAgent = useCallback(() => {
    openPanel('create-agent');
  }, [openPanel]);

  const handleEditAgent = useCallback((agentId: string) => {
    const agent = agents.find(a => a.id === agentId);
    openPanel('update-agent', {
      agentId,
      agentName: agent?.name || 'Agent'
    });
  }, [agents, openPanel]);

  const handleOpenExtensionOnboarding = useCallback((extensionName: string) => {
    openPanel('extension-onboarding', { extensionName });
  }, [openPanel]);

  // Cron handlers
  const handleSelectCronJob = useCallback((jobId: string) => {
    const job = cronJobs.find(j => j.id === jobId);
    if (job) {
      openPanel('cron', { jobId, jobName: job.name });
    }
  }, [cronJobs, openPanel]);

  const handleDeleteCronJob = useCallback(async (jobId: string) => {
    try {
      await deleteCronJob(jobId);
      toast({
        title: 'Cron job deleted',
        description: 'The cron job has been removed.',
      });
      // Close any open cron panels for this job
      layout.panels.forEach(panel => {
        if (panel.type === 'cron' && panel.data?.jobId === jobId) {
          closePanel(panel.id);
        }
      });
    } catch (err) {
      toast({
        title: 'Failed to delete job',
        description: (err as Error).message,
        variant: 'destructive',
      });
    }
  }, [deleteCronJob, toast, layout.panels, closePanel]);

  const handleOpenCreateCronPanel = useCallback(() => {
    setIsCronMenuOpen(false);
    openPanel('create-cron');
  }, [openPanel]);

  const handleEditCronJob = useCallback((jobId: string) => {
    const job = cronJobs.find(j => j.id === jobId);
    if (!job) return;
    openPanel('update-cron', { jobId, jobName: job.name });
  }, [cronJobs, openPanel]);

  const handleCreateCronJobRequest = useCallback(async (payload: any) => {
    const createdJob = await addCronJob({
      ...payload,
      payload: {
        ...payload.payload,
        agentId: payload.payload?.agentId || activePanelAgentId || undefined,
      }
    });

    toast({
      title: 'Cron job created',
      description: `${createdJob.name} was added.`,
    });

    openPanel('cron', { jobId: createdJob.id, jobName: createdJob.name });
    return createdJob;
  }, [addCronJob, activePanelAgentId, openPanel, toast]);

  const handleUpdateCronJobRequest = useCallback(async (payload: { jobId: string; updates: any }) => {
    const updatedJob = await updateCronJob(payload.jobId, payload.updates);

    toast({
      title: 'Cron job updated',
      description: `${updatedJob.name} was updated.`,
    });

    return updatedJob;
  }, [updateCronJob, toast]);

  const handleCreateAgentRequest = useCallback(async (payload: {
    id?: string;
    name: string;
    workspace?: string;
    model?: string;
    tools?: { profile: string };
    sandbox?: { mode: string };
  }) => {
    const ack = await sendRequestWithAck({ type: 'agents.add', ...payload }, 'agents.add.ack');
    return {
      agentId: ack.agentId,
      agentName: payload.name
    };
  }, [sendRequestWithAck]);

  const handleUpdateAgentRequest = useCallback(async (payload: { agentId: string; name: string }) => {
    const ack = await sendRequestWithAck({ type: 'agents.update', ...payload }, 'agents.update.ack');
    return {
      agentId: ack.agentId,
      name: ack.name
    };
  }, [sendRequestWithAck]);

  const handleDeleteAgentRequest = useCallback(async (agentId: string) => {
    const ack = await sendRequestWithAck({ type: 'agents.delete', agentId }, 'agents.delete.ack');
    return {
      agentId: ack.agentId,
      removed: Boolean(ack.removed)
    };
  }, [sendRequestWithAck]);

  const handleDeleteAgent = useCallback((agentId: string) => {
    const agent = agents.find(a => a.id === agentId);
    const agentName = agent?.name || agentId;
    setAgentToDelete({ id: agentId, name: agentName });
    setShowDeleteConfirm(true);
  }, [agents]);

  const handleConfirmDeleteAgent = useCallback(async () => {
    if (!agentToDelete) return;

    try {
      const result = await handleDeleteAgentRequest(agentToDelete.id);
      if (result.removed) {
        toast({
          title: 'Agent deleted',
          description: `${agentToDelete.name} has been removed.`
        });
      } else {
        toast({
          title: 'Agent not found',
          description: `${agentToDelete.name} was already missing.`
        });
      }

      const panelForAgent = layout.panels.find((panel) => panel.agentId === agentToDelete.id && panel.isActive);
      if (panelForAgent) {
        closePanel(panelForAgent.id);
      }
    } catch (err) {
      toast({
        title: 'Delete failed',
        description: err instanceof Error ? err.message : 'Failed to delete agent',
        variant: 'destructive'
      });
    } finally {
      setShowDeleteConfirm(false);
      setAgentToDelete(null);
    }
  }, [agentToDelete, handleDeleteAgentRequest, layout.panels, closePanel, toast]);

  const handleOnboardingGatewayConnect = useCallback(async (name: string, url: string, token: string) => {
    const ack = await sendRequestWithAck({ type: 'gateways.add', name, url, token }, 'gateways.add.ack');
    if (ack?.ok === false) {
      throw new Error(ack.error || 'Failed to connect to gateway');
    }
    sendMessage({ type: 'gateways.list' });
  }, [sendRequestWithAck, sendMessage]);

  // Use the active panel's agent for session key
  const sessionKey = activePanelAgentId ? `agent:${activePanelAgentId}:main` : null;

  // Handler for model change from panel header
  const handleModelChange = useCallback((modelId: string, provider?: string) => {
    if (sessionKey && activePanel?.id) {
      // Update the session on the server
      updateSetting(sessionKey, { model: modelId, modelProvider: provider });
      // Update the panel state immediately for responsive UI
      updatePanelSessionSettings(activePanel.id, { model: modelId, modelProvider: provider });
    }
  }, [sessionKey, activePanel?.id, updateSetting, updatePanelSessionSettings]);

  // Handler for thinking level change from panel header
  const handleThinkingChange = useCallback((thinking: 'off' | 'low' | 'medium' | 'high') => {
    if (sessionKey && activePanel?.id) {
      // Update the session on the server
      updateSetting(sessionKey, { thinking });
      // Update the panel state immediately for responsive UI
      updatePanelSessionSettings(activePanel.id, { thinking });
    }
  }, [sessionKey, activePanel?.id, updateSetting, updatePanelSessionSettings]);

  // Handler to refresh chat history for a specific agent
  const handleRefreshChat = useCallback((agentId: string) => {
    const agentName = agents.find((agent) => agent.id === agentId)?.name || agentId;

    if (connectionStatus !== 'connected') {
      toast({
        title: 'Refresh unavailable',
        description: 'Connect to a gateway to refresh chat history.',
        variant: 'destructive',
      });
      return;
    }

    sendMessage({
      type: 'chat.history.load',
      agentId,
      params: {
        sessionKey: `agent:${agentId}:main`,
        limit: 50,
      },
    });

    toast({
      title: 'Refreshing chat',
      description: `Reloading transcript for ${agentName}.`,
      variant: 'success',
    });
  }, [agents, connectionStatus, sendMessage, toast]);

  // Show onboarding wizard for first-time users with no config
  if (onboardingChecked && showOnboarding === true) {
    return (
      <OnboardingWizard
        onConnectGateway={handleOnboardingGatewayConnect}
        onComplete={() => {
          setShowOnboarding(false);
          sendMessage({ type: 'gateways.list' });
        }}
        onSkip={() => {
          setShowOnboarding(false);
        }}
      />
    );
  }

  // Show gateway setup for manual gateway addition or when no config and onboarding skipped/completed
  if ((connectionStatus === 'no-config' && showOnboarding === false) || showSetup) {
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
            activeRunData={activeRunData}
            addUserMessage={addUserMessage}
            models={models}
            sessionSettings={sessionSettings}
            updateSetting={updateSetting}
            onAbortRun={handleAbortRun}
            onResetSession={handleResetSession}
            onModelChange={handleModelChange}
            onThinkingChange={handleThinkingChange}
            onShowToolsChange={handleShowToolsChange}
            onShowReasoningChange={handleShowReasoningChange}
            onRefreshChat={handleRefreshChat}
            onCreateAgent={handleCreateAgentRequest}
            onUpdateAgent={handleUpdateAgentRequest}
            cronJobs={cronJobs}
            wsRef={wsRef}
            onEditCronJob={handleEditCronJob}
            onDeleteCronJob={handleDeleteCronJob}
            onCreateCronJob={handleCreateCronJobRequest}
            onUpdateCronJob={handleUpdateCronJobRequest}
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
          onEditAgent={handleEditAgent}
          onDeleteAgent={handleDeleteAgent}
          
          gateways={gateways}
          activeGatewayId={activeGatewayId}
          onSwitchGateway={(id) => sendMessage({ type: 'gateways.switch', id })}
          onAddGateway={() => setShowSetup(true)}
          onRemoveGateway={(id) => sendMessage({ type: 'gateways.remove', id })}
          onOpenExtensionOnboarding={handleOpenExtensionOnboarding}
          cronJobs={cronJobs}
          cronStatus={cronStatus}
          isCronMenuOpen={isCronMenuOpen}
          onToggleCronMenu={() => {
            if (!isCronMenuOpen) {
              refreshCronJobs();
            }
            setIsCronMenuOpen(!isCronMenuOpen);
          }}
          onSelectCronJob={handleSelectCronJob}
          onCreateCronJob={handleOpenCreateCronPanel}
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
        showTools={activePanel?.settings?.showTools ?? false}
        showReasoning={activePanel?.settings?.showReasoning ?? true}
        onModelChange={sessionKey ? (model, provider) => updateSetting(sessionKey, { model, modelProvider: provider }) : undefined}
        onThinkingChange={sessionKey ? (thinking) => updateSetting(sessionKey, { thinking }) : undefined}
        onShowToolsChange={handleShowToolsChange}
        onShowReasoningChange={handleShowReasoningChange}
        
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
      {(isAgentMenuOpen || isCronMenuOpen) && (
        <div className="fixed inset-0 z-40" onClick={() => {
          setIsAgentMenuOpen(false);
          setIsCronMenuOpen(false);
        }} />
      )}

      {/* Delete Agent Confirmation Modal */}
      <ConfirmationModal
        isOpen={showDeleteConfirm}
        onClose={() => {
          setShowDeleteConfirm(false);
          setAgentToDelete(null);
        }}
        onConfirm={handleConfirmDeleteAgent}
        title="Delete Agent"
        message={`Are you sure you want to delete "${agentToDelete?.name}"? This action cannot be undone.`}
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
      />
    </div>
  );
}
