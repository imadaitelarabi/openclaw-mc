"use client";

import type { Panel } from '@/types';
import { getStreamKey } from '@/lib/gateway-utils';
import { PanelHeader } from './PanelHeader';
import { ChatPanel } from './ChatPanel';
import { CreateAgentPanel } from './CreateAgentPanel';
import { UpdateAgentPanel } from './UpdateAgentPanel';
import { CreateCronPanel } from './CreateCronPanel';
import { UpdateCronPanel } from './UpdateCronPanel';
import { ExtensionOnboardingPanel } from './ExtensionOnboardingPanel';
import { CronPanel } from '../cron';
import type { CronJob } from '@/types';

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
  activeRuns: Record<string, string>;
  addUserMessage: (agentId: string, message: string) => void;
  models: any[];
  sessionSettings: Record<string, any>;
  updateSetting: (sessionKey: string, settings: any) => void;
  onAbortRun?: (agentId: string) => void;
  onResetSession?: (agentId: string) => void;
  onCreateAgent: (payload: {
    id?: string;
    name: string;
    workspace?: string;
    model?: string;
    tools?: { profile: string };
    sandbox?: { mode: string };
  }) => Promise<{ agentId: string; agentName: string }>;
  onUpdateAgent: (payload: { agentId: string; name: string }) => Promise<{ agentId: string; name: string }>;
  
  // Cron-related props
  cronJobs?: CronJob[];
  wsRef?: React.RefObject<WebSocket | null>;
  onForceRun?: (jobId: string) => void;
  onReschedule?: (jobId: string) => void;
  onEditCronJob?: (jobId: string) => void;
  onDeleteCronJob?: (jobId: string) => void;
  onCreateCronJob?: (payload: Omit<CronJob, 'id' | 'createdAtMs' | 'updatedAtMs'>) => Promise<CronJob>;
  onUpdateCronJob?: (payload: { jobId: string; updates: Partial<CronJob> }) => Promise<CronJob>;
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
  activeRuns,
  addUserMessage,
  models,
  sessionSettings,
  updateSetting,
  onAbortRun,
  onResetSession,
  onCreateAgent,
  onUpdateAgent,
  cronJobs = [],
  wsRef,
  onForceRun,
  onReschedule,
  onEditCronJob,
  onDeleteCronJob,
  onCreateCronJob,
  onUpdateCronJob,
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
            showCloseButton={panels.length > 1}
            agentId={panel.type === 'chat' ? panel.agentId : undefined}
            onResetSession={panel.type === 'chat' && panel.agentId ? () => onResetSession?.(panel.agentId!) : undefined}
          />
          
          <div 
            className="flex-1 min-h-0 overflow-hidden"
            onClick={() => onPanelActivate(panel.id)}
          >
            {panel.type === 'chat' && panel.agentId && (
              <ChatPanel
                agentId={panel.agentId}
                agent={agents.find(a => a.id === panel.agentId)}
                sendMessage={sendMessage}
                connectionStatus={connectionStatus}
                chatHistory={chatHistory[panel.agentId] || []}
                activeRunId={activeRuns[panel.agentId] || null}
                assistantStream={
                  activeRuns[panel.agentId]
                    ? chatStreams[getStreamKey(panel.agentId, activeRuns[panel.agentId])]
                    : undefined
                }
                reasoningStream={
                  activeRuns[panel.agentId]
                    ? reasoningStreams[getStreamKey(panel.agentId, activeRuns[panel.agentId])]
                    : undefined
                }
                addUserMessage={addUserMessage}
                models={models}
                sessionSettings={sessionSettings}
                updateSetting={updateSetting}
                onAbortRun={onAbortRun}
                showTools={panel.settings?.showTools ?? false}
                showReasoning={panel.settings?.showReasoning ?? true}
                isActive={panel.isActive}
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

            {panel.type === 'extension-onboarding' && panel.data?.extensionName && (
              <ExtensionOnboardingPanel
                extensionName={panel.data.extensionName}
                onClose={() => onPanelClose(panel.id)}
              />
            )}

            {panel.type === 'create-cron' && onCreateCronJob && (
              <CreateCronPanel
                onCreateCronJob={onCreateCronJob}
                onClose={() => onPanelClose(panel.id)}
              />
            )}

            {panel.type === 'update-cron' && panel.data?.jobId && onUpdateCronJob && (
              (() => {
                const job = cronJobs.find(j => j.id === panel.data.jobId);
                if (!job) {
                  return (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                      Cron job not found.
                    </div>
                  );
                }

                return (
                  <UpdateCronPanel
                    job={job}
                    onUpdateCronJob={onUpdateCronJob}
                    onClose={() => onPanelClose(panel.id)}
                  />
                );
              })()
            )}

            {panel.type === 'cron' && panel.data?.jobId && wsRef && (
              (() => {
                const job = cronJobs.find(j => j.id === panel.data.jobId);
                if (!job) {
                  return (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                      Cron job not found.
                    </div>
                  );
                }

                return (
                  <CronPanel
                    job={job}
                    sendMessage={sendMessage}
                    wsRef={wsRef}
                    onForceRun={onForceRun}
                    onReschedule={onReschedule}
                    onEdit={onEditCronJob}
                    onDelete={onDeleteCronJob}
                  />
                );
              })()
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
