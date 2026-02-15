"use client";

import type { Panel } from '@/types';
import { PanelHeader } from './PanelHeader';
import { ChatPanel } from './ChatPanel';
import { CreateAgentPanel } from './CreateAgentPanel';
import { UpdateAgentPanel } from './UpdateAgentPanel';

interface PanelContainerProps {
  panels: Panel[];
  activePanel: string | null;
  onPanelActivate: (id: string) => void;
  onPanelClose: (id: string) => void;
  
  // Props needed for ChatPanel
  agents: any[];
  sendMessage: (msg: any) => void;
  connectionStatus: string;
  chatHistory: Record<string, any[]>;
  chatStreams: Record<string, string>;
  reasoningStreams: Record<string, string>;
  thinkingTraces: Record<string, string>;
  activeRuns: Record<string, string>;
  addUserMessage: (agentId: string, message: string) => void;
  models: any[];
  sessionSettings: Record<string, any>;
  updateSetting: (sessionKey: string, settings: any) => void;
  onCreateAgent: (payload: {
    id?: string;
    name: string;
    workspace?: string;
    model?: string;
    tools?: { profile: string };
    sandbox?: { mode: string };
  }) => Promise<{ agentId: string; agentName: string }>;
  onUpdateAgent: (payload: { agentId: string; name: string }) => Promise<{ agentId: string; name: string }>;
}

export function PanelContainer({
  panels,
  activePanel,
  onPanelActivate,
  onPanelClose,
  agents,
  sendMessage,
  connectionStatus,
  chatHistory,
  chatStreams,
  reasoningStreams,
  thinkingTraces,
  activeRuns,
  addUserMessage,
  models,
  sessionSettings,
  updateSetting,
  onCreateAgent,
  onUpdateAgent
}: PanelContainerProps) {
  if (panels.length === 0) {
    return null;
  }

  return (
    <div 
      className={`flex-1 grid gap-0 min-h-0`}
      style={{
        gridTemplateColumns: panels.length === 1 ? '1fr' : 'repeat(2, 1fr)'
      }}
    >
      {panels.map((panel) => (
        <div 
          key={panel.id} 
          className="flex flex-col border-r last:border-r-0 border-border min-h-0 overflow-hidden"
        >
          <PanelHeader
            title={panel.title}
            isActive={panel.isActive}
            onClose={() => onPanelClose(panel.id)}
            onClick={() => onPanelActivate(panel.id)}
          />
          
          <div className="flex-1 min-h-0 overflow-hidden">
            {panel.type === 'chat' && panel.agentId && (
              <ChatPanel
                agentId={panel.agentId}
                agent={agents.find(a => a.id === panel.agentId)}
                sendMessage={sendMessage}
                connectionStatus={connectionStatus}
                chatHistory={chatHistory[panel.agentId] || []}
                chatStream={chatStreams}
                reasoningStream={reasoningStreams}
                thinkingTraces={thinkingTraces}
                activeRuns={activeRuns}
                addUserMessage={addUserMessage}
                models={models}
                sessionSettings={sessionSettings}
                updateSetting={updateSetting}
              />
            )}
            
            {panel.type === 'create-agent' && (
              <CreateAgentPanel
                onCreateAgent={onCreateAgent}
                onClose={() => onPanelClose(panel.id)}
              />
            )}

            {panel.type === 'update-agent' && panel.agentId && (
              <UpdateAgentPanel
                agentId={panel.agentId}
                initialName={panel.data?.agentName || agents.find(a => a.id === panel.agentId)?.name || panel.agentId}
                onUpdateAgent={onUpdateAgent}
                onClose={() => onPanelClose(panel.id)}
              />
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
