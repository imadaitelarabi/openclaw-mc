"use client";

import type { Panel, Note } from '@/types';
import { getStreamKey } from '@/lib/gateway-utils';
import { PanelHeader, type AgentRunStatus } from './PanelHeader';
import { ChatPanel } from './ChatPanel';
import { CreateAgentPanel } from './CreateAgentPanel';
import { UpdateAgentPanel } from './UpdateAgentPanel';
import { CreateCronPanel } from './CreateCronPanel';
import { UpdateCronPanel } from './UpdateCronPanel';
import { ExtensionOnboardingPanel } from './ExtensionOnboardingPanel';
import { TagsSettingsPanel } from './TagsSettingsPanel';
import { CronPanel } from '../cron';
import { NotesPanel } from '../notes';
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
  agentStatuses: Record<string, AgentRunStatus>;
  onClearCompletedRun?: (agentId: string) => void;
  addUserMessage: (agentId: string, message: string) => void;
  models: any[];
  sessionSettings: Record<string, any>;
  updateSetting: (sessionKey: string, settings: any) => void;
  onAbortRun?: (agentId: string) => void;
  onResetSession?: (agentId: string) => void;
  onModelChange?: (panelId: string, modelId: string, provider?: string) => void;
  onThinkingChange?: (panelId: string, thinking: 'off' | 'low' | 'medium' | 'high') => void;
  onShowToolsChange?: (panelId: string, show: boolean) => void;
  onShowReasoningChange?: (panelId: string, show: boolean) => void;
  onRefreshChat?: (agentId: string) => void;
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
  onReschedule?: (jobId: string) => void;
  onEditCronJob?: (jobId: string) => void;
  onDeleteCronJob?: (jobId: string) => void;
  onCreateCronJob?: (payload: Omit<CronJob, 'id' | 'createdAtMs' | 'updatedAtMs'>) => Promise<CronJob>;
  onUpdateCronJob?: (payload: { jobId: string; updates: Partial<CronJob> }) => Promise<CronJob>;

  // Notes-related props
  notes?: Note[];
  noteGroups?: string[];
  allTags?: string[];
  tagColors?: Record<string, string>;
  onAddNote?: (content: string, group: string, tags?: string[], imageUrl?: string) => Promise<void>;
  onUpdateNote?: (id: string, updates: Partial<Omit<Note, 'id' | 'createdAt'>>) => Promise<void>;
  onSetTagColor?: (tag: string, color: string) => Promise<void>;
  onDeleteTag?: (tag: string) => Promise<void>;
  onCreateNoteGroup?: (group: string) => Promise<void>;
  onDeleteNoteGroup?: (group: string) => Promise<void>;
  onUploadNoteImage?: (file: File) => Promise<string>;
  onDeleteNote?: (id: string) => Promise<void>;
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
  agentStatuses,
  onClearCompletedRun,
  addUserMessage,
  models,
  sessionSettings,
  updateSetting,
  onAbortRun,
  onResetSession,
  onModelChange,
  onThinkingChange,
  onShowToolsChange,
  onShowReasoningChange,
  onRefreshChat,
  onCreateAgent,
  onUpdateAgent,
  cronJobs = [],
  wsRef,
  onReschedule,
  onEditCronJob,
  onDeleteCronJob,
  onCreateCronJob,
  onUpdateCronJob,
  notes = [],
  noteGroups = [],
  allTags = [],
  tagColors = {},
  onAddNote,
  onUpdateNote,
  onSetTagColor,
  onDeleteTag,
  onCreateNoteGroup,
  onDeleteNoteGroup,
  onUploadNoteImage,
  onDeleteNote,
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
            showTools={panel.type === 'chat' ? panel.settings?.showTools ?? false : undefined}
            showReasoning={panel.type === 'chat' ? panel.settings?.showReasoning ?? true : undefined}
            onShowToolsChange={panel.type === 'chat' ? (show) => onShowToolsChange?.(panel.id, show) : undefined}
            onShowReasoningChange={panel.type === 'chat' ? (show) => onShowReasoningChange?.(panel.id, show) : undefined}
            models={panel.type === 'chat' ? models : undefined}
            currentModel={panel.type === 'chat' ? panel.model : undefined}
            onModelChange={panel.type === 'chat' ? (modelId, provider) => onModelChange?.(panel.id, modelId, provider) : undefined}
            thinkingMode={panel.type === 'chat' ? (panel.thinking || 'low') : undefined}
            onThinkingChange={panel.type === 'chat' ? (thinking) => onThinkingChange?.(panel.id, thinking) : undefined}
            onRefreshChat={panel.type === 'chat' && panel.agentId ? () => onRefreshChat?.(panel.agentId!) : undefined}
            activeRunStatus={panel.type === 'chat' && panel.agentId ? (agentStatuses[panel.agentId] ?? 'idle') : 'idle'}
            onRunAcknowledged={panel.type === 'chat' && panel.agentId ? () => onClearCompletedRun?.(panel.agentId!) : undefined}
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
                notes={notes}
                noteGroups={noteGroups}
                showTools={panel.settings?.showTools ?? false}
                showReasoning={panel.settings?.showReasoning ?? true}
                isActive={panel.isActive}
                wsRef={wsRef}
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

            {panel.type === 'cron' && wsRef && (
              (() => {
                const jobId = panel.data?.jobId;
                const jobNameFromData = panel.data?.jobName;
                const jobNameFromTitle = panel.title.startsWith('Cron: ')
                  ? panel.title.replace(/^Cron:\s*/, '')
                  : undefined;

                const job = cronJobs.find(j =>
                  (jobId && j.id === jobId)
                  || (jobNameFromData && j.name === jobNameFromData)
                  || (jobNameFromTitle && j.name === jobNameFromTitle)
                );
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
                    onReschedule={onReschedule}
                    onEdit={onEditCronJob}
                    onDelete={onDeleteCronJob}
                  />
                );
              })()
            )}

            {panel.type === 'notes' && onAddNote && onUpdateNote && onCreateNoteGroup && onDeleteNoteGroup && onUploadNoteImage && onDeleteNote && (
              <NotesPanel
                notes={notes}
                groups={noteGroups}
                allTags={allTags}
                tagColors={tagColors}
                selectedGroup={panel.data?.selectedGroup}
                onAddNote={onAddNote}
                onUpdateNote={onUpdateNote}
                onCreateGroup={onCreateNoteGroup}
                onDeleteGroup={onDeleteNoteGroup}
                onUploadNoteImage={onUploadNoteImage}
                onDeleteNote={onDeleteNote}
              />
            )}

            {panel.type === 'tags-settings' && onSetTagColor && onDeleteTag && (
              <TagsSettingsPanel
                allTags={allTags}
                tagColors={tagColors}
                onSetTagColor={onSetTagColor}
                onDeleteTag={onDeleteTag}
              />
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
