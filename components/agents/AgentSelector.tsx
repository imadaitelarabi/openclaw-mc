import { Zap, ChevronDown, Plus, Pencil, Trash2 } from 'lucide-react';
import type { Agent } from '@/types';
import type { AgentRunStatus } from '@/components/panels/PanelHeader';

interface AgentSelectorProps {
  agents: Agent[];
  selectedAgent: string | null;
  activeAgent?: Agent;
  isOpen: boolean;
  onToggle: () => void;
  onSelect: (agentId: string) => void;
  onCreateAgent?: () => void;
  onEditAgent?: (agentId: string) => void;
  onDeleteAgent?: (agentId: string) => void;
  agentStatuses?: Record<string, AgentRunStatus>;
}

export function AgentSelector({ 
  agents, 
  selectedAgent, 
  activeAgent, 
  isOpen, 
  onToggle, 
  onSelect,
  onCreateAgent,
  onEditAgent,
  onDeleteAgent,
  agentStatuses = {},
}: AgentSelectorProps) {
  function getPulseClass(status: AgentRunStatus | undefined): string | null {
    if (!status || status === 'idle') return null;
    if (status === 'thinking' || status === 'tool') return 'bg-amber-400 animate-pulse';
    if (status === 'text') return 'bg-blue-400 animate-pulse';
    if (status === 'completed') return 'bg-green-500';
    return null;
  }
  return (
    <div className="relative">
      <button 
        onClick={onToggle}
        className="flex items-center gap-2 hover:bg-white/10 px-2 py-1 rounded cursor-pointer transition-colors"
      >
        <Zap className="w-3 h-3 text-primary" />
        <span className="font-medium">
          {activeAgent ? activeAgent.name : "Select Agent"}
        </span>
        <ChevronDown className="w-3 h-3 opacity-50" />
      </button>

      {isOpen && (
        <div className="absolute bottom-full left-0 mb-2 w-64 bg-popover border border-border rounded shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-100">
          <div className="p-2 border-b border-border bg-muted/50 text-muted-foreground font-medium">
            Switch Agent
          </div>
          <div className="max-h-64 overflow-y-auto py-1">
            {agents.map(agent => (
              <button
                key={agent.id}
                onClick={() => {
                  onSelect(agent.id);
                  onToggle();
                }}
                className={`w-full text-left px-3 py-2 flex items-center justify-between hover:bg-accent hover:text-accent-foreground transition-colors ${
                  selectedAgent === agent.id ? "bg-accent/50 text-primary" : ""
                }`}
              >
                <div className="flex items-center gap-2">
                  <span>{agent.emoji || "🤖"}</span>
                  <span>{agent.name}</span>
                </div>
                <div className="flex items-center gap-1">
                  {(() => {
                    const pulseClass = getPulseClass(agentStatuses[agent.id]);
                    if (pulseClass) {
                      return <div className={`w-1.5 h-1.5 rounded-full ${pulseClass} mr-1`} />;
                    }
                    if (agent.status === 'active') {
                      return <div className="w-1.5 h-1.5 rounded-full bg-green-500 mr-1" />;
                    }
                    return null;
                  })()}
                  {onEditAgent && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onEditAgent(agent.id);
                        onToggle();
                      }}
                      className="p-1 rounded hover:bg-muted"
                      aria-label={`Edit ${agent.name}`}
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                  )}
                  {onDeleteAgent && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteAgent(agent.id);
                        onToggle();
                      }}
                      className="p-1 rounded hover:bg-muted text-destructive"
                      aria-label={`Delete ${agent.name}`}
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </button>
            ))}
            
            {/* Separator */}
            {onCreateAgent && agents.length > 0 && (
              <div className="border-t border-border my-1" />
            )}
            
            {/* Create Agent Option */}
            {onCreateAgent && (
              <button
                onClick={() => {
                  onCreateAgent();
                  onToggle();
                }}
                className="w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-accent hover:text-accent-foreground transition-colors"
              >
                <Plus className="w-4 h-4 text-primary" />
                <span className="text-primary font-medium">Create New Agent</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
