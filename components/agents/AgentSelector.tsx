import { Zap, ChevronDown, Plus } from 'lucide-react';
import type { Agent } from '@/types';

interface AgentSelectorProps {
  agents: Agent[];
  selectedAgent: string | null;
  activeAgent?: Agent;
  isOpen: boolean;
  onToggle: () => void;
  onSelect: (agentId: string) => void;
  onCreateAgent?: () => void;
}

export function AgentSelector({ 
  agents, 
  selectedAgent, 
  activeAgent, 
  isOpen, 
  onToggle, 
  onSelect,
  onCreateAgent
}: AgentSelectorProps) {
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
                {agent.status === 'active' && (
                  <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
                )}
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
