import type { Agent, ConnectionStatus, CronJob, CronStatus, Note } from "@/types";
import type { AgentRunStatus } from "@/components/panels/PanelHeader";
import { AgentSelector } from "../agents";
import { GatewaySwitcher } from "../gateway/GatewaySwitcher";
import { ExtensionStatusBarItem } from "../extensions";
import { CronStatusBarItem } from "../cron";
import { NotesStatusBarItem } from "../notes";
import { SettingsDropdown } from "./SettingsDropdown";
import { useExtensionStatusBar } from "@/hooks";
import { useOptionalExtensions } from "@/contexts/ExtensionContext";
import { useToast } from "@/hooks/useToast";

interface StatusBarProps {
  agents: Agent[];
  selectedAgent: string | null;
  activeAgent?: Agent;
  connectionStatus: ConnectionStatus;
  isAgentMenuOpen: boolean;
  onToggleAgentMenu: () => void;
  onSelectAgent: (agentId: string) => void;
  onCreateAgent?: () => void;
  onEditAgent?: (agentId: string) => void;
  onDeleteAgent?: (agentId: string) => void;
  agentStatuses?: Record<string, AgentRunStatus>;

  // Gateway management
  gateways: any[];
  activeGatewayId: string | null;
  onSwitchGateway: (id: string) => void;
  onAddGateway: () => void;
  onRemoveGateway: (id: string) => void;

  // Extension onboarding
  onOpenExtensionOnboarding?: (extensionName: string) => void;
  onOpenTagsSettings?: () => void;
  onOpenSkills?: () => void;

  // Cron jobs
  cronJobs?: CronJob[];
  cronStatus?: CronStatus | null;
  isCronMenuOpen?: boolean;
  onToggleCronMenu?: () => void;
  onSelectCronJob?: (jobId: string) => void;
  onCreateCronJob?: () => void;

  // Notes
  notes?: Note[];
  noteGroups?: string[];
  isNotesMenuOpen?: boolean;
  onToggleNotesMenu?: () => void;
  onSelectNoteGroup?: (group: string | null) => void;
  onOpenNotes?: () => void;
}

export function StatusBar({
  agents,
  selectedAgent,
  activeAgent,
  connectionStatus,
  isAgentMenuOpen,
  onToggleAgentMenu,
  onSelectAgent,
  onCreateAgent,
  onEditAgent,
  onDeleteAgent,
  agentStatuses = {},
  gateways,
  activeGatewayId,
  onSwitchGateway,
  onAddGateway,
  onRemoveGateway,
  onOpenExtensionOnboarding,
  onOpenTagsSettings,
  onOpenSkills,
  cronJobs = [],
  cronStatus = null,
  isCronMenuOpen = false,
  onToggleCronMenu = () => {},
  onSelectCronJob = () => {},
  onCreateCronJob,
  notes = [],
  noteGroups = [],
  isNotesMenuOpen = false,
  onToggleNotesMenu = () => {},
  onSelectNoteGroup = () => {},
  onOpenNotes = () => {},
}: StatusBarProps) {
  const { statusBarItems } = useExtensionStatusBar();
  const { toast } = useToast();
  const extensionContext = useOptionalExtensions();

  const availableExtensions = (() => {
    if (!extensionContext) {
      return [] as Array<{ name: string; description?: string; enabled: boolean }>;
    }

    const enabledExtensionNames = new Set(
      extensionContext.enabledExtensions.map((ext) => ext.manifest.name)
    );

    return extensionContext.extensions.map((ext) => ({
      name: ext.manifest.name,
      description: ext.manifest.description,
      enabled: enabledExtensionNames.has(ext.manifest.name),
    }));
  })();

  const handleCopy = (value: string) => {
    navigator.clipboard.writeText(value);
    toast({
      title: "Copied to clipboard",
      description: value,
      variant: "success",
    });
  };

  const handleOpen = (url: string) => {
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <div className="h-8 bg-secondary border-t border-border flex items-center px-3 text-xs select-none relative z-50 gap-3">
      {/* Left: Agent Switcher */}
      <AgentSelector
        agents={agents}
        selectedAgent={selectedAgent}
        activeAgent={activeAgent}
        isOpen={isAgentMenuOpen}
        onToggle={onToggleAgentMenu}
        onSelect={onSelectAgent}
        onCreateAgent={onCreateAgent}
        onEditAgent={onEditAgent}
        onDeleteAgent={onDeleteAgent}
        agentStatuses={agentStatuses}
      />

      {/* Separator */}
      {selectedAgent && <div className="h-4 w-px bg-border" />}

      <div className="flex-1" />

      {/* Cron Status */}
      {(cronStatus?.enabled || cronJobs.length > 0) && (
        <>
          <CronStatusBarItem
            jobs={cronJobs}
            status={cronStatus}
            isOpen={isCronMenuOpen}
            onToggle={onToggleCronMenu}
            onSelectJob={onSelectCronJob}
            onCreateJob={onCreateCronJob}
          />

          <div className="h-4 w-px bg-border" />
        </>
      )}

      {/* Extension Status Bar Items */}
      {statusBarItems.size > 0 && (
        <>
          {Array.from(statusBarItems.entries()).map(([extensionName, item]) => (
            <ExtensionStatusBarItem
              key={extensionName}
              extensionName={extensionName}
              item={item}
              onCopy={handleCopy}
              onOpen={handleOpen}
            />
          ))}

          <div className="h-4 w-px bg-border" />
        </>
      )}

      {/* Notes Status */}
      <NotesStatusBarItem
        notes={notes}
        groups={noteGroups}
        isOpen={isNotesMenuOpen}
        onToggle={onToggleNotesMenu}
        onSelectGroup={onSelectNoteGroup}
        onOpenNotes={onOpenNotes}
      />

      <div className="h-4 w-px bg-border" />

      {/* Settings Dropdown */}
      <SettingsDropdown
        extensions={availableExtensions}
        onSelectExtension={onOpenExtensionOnboarding}
        onOpenTagsSettings={onOpenTagsSettings}
        onOpenSkills={onOpenSkills}
      />

      <div className="h-4 w-px bg-border" />

      {/* Right: System Status */}
      <div className="flex items-center gap-3">
        <GatewaySwitcher
          status={connectionStatus}
          gateways={gateways}
          activeId={activeGatewayId}
          onSwitch={onSwitchGateway}
          onAdd={onAddGateway}
          onRemove={onRemoveGateway}
        />
      </div>
    </div>
  );
}
