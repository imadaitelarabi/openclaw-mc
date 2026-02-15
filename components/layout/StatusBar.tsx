import { Wifi, WifiOff } from 'lucide-react';
import type { Agent, ConnectionStatus } from '@/types';
import { AgentSelector } from '../agents';
import { ModelSelector, ThinkingToggle, VerboseToggle, ReasoningToggle } from '../statusbar';
import { GatewaySwitcher } from '../gateway/GatewaySwitcher';

interface StatusBarProps {
  agents: Agent[];
  selectedAgent: string | null;
  activeAgent?: Agent;
  connectionStatus: ConnectionStatus;
  isAgentMenuOpen: boolean;
  onToggleAgentMenu: () => void;
  onSelectAgent: (agentId: string) => void;
  onCreateAgent?: () => void;
  models?: any[];
  currentModel?: string;
  thinkingMode?: 'off' | 'low' | 'medium' | 'high';
  verboseMode?: 'on' | 'off' | 'inherit';
  reasoningMode?: 'off' | 'on' | 'stream';
  onModelChange?: (model: string, provider?: string) => void;
  onThinkingChange?: (thinking: 'off' | 'low' | 'medium' | 'high') => void;
  onVerboseChange?: (verbose: 'on' | 'off' | 'inherit') => void;
  onReasoningChange?: (reasoning: 'off' | 'on' | 'stream') => void;
  
  // Gateway management
  gateways: any[];
  activeGatewayId: string | null;
  onSwitchGateway: (id: string) => void;
  onAddGateway: () => void;
  onRemoveGateway: (id: string) => void;
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
  models = [],
  currentModel,
  thinkingMode = 'low',
  verboseMode = 'off',
  reasoningMode = 'off',
  onModelChange,
  onThinkingChange,
  onVerboseChange,
  onReasoningChange,
  gateways,
  activeGatewayId,
  onSwitchGateway,
  onAddGateway,
  onRemoveGateway
}: StatusBarProps) {
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
      />

      {/* Separator */}
      {selectedAgent && <div className="h-4 w-px bg-border" />}

      {/* Model Selector */}
      {selectedAgent && (
        <ModelSelector
          models={models}
          currentModel={currentModel}
          onChange={onModelChange || (() => {})}
          disabled={!onModelChange}
        />
      )}

      {/* Separator */}
      {selectedAgent && <div className="h-4 w-px bg-border" />}

      {/* Thinking Mode Toggle */}
      {selectedAgent && (
        <ThinkingToggle
          value={thinkingMode}
          onChange={onThinkingChange || (() => {})}
          disabled={!onThinkingChange}
        />
      )}

      {/* Separator */}
      {selectedAgent && <div className="h-4 w-px bg-border" />}

      {/* Verbose Mode Toggle */}
      {selectedAgent && (
        <VerboseToggle
          value={verboseMode}
          onChange={onVerboseChange || (() => {})}
          disabled={!onVerboseChange}
        />
      )}

      {/* Separator */}
      {selectedAgent && <div className="h-4 w-px bg-border" />}

      {/* Reasoning Mode Toggle */}
      {selectedAgent && (
        <ReasoningToggle
          value={reasoningMode}
          onChange={onReasoningChange || (() => {})}
          disabled={!onReasoningChange}
        />
      )}

      <div className="flex-1" />

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
