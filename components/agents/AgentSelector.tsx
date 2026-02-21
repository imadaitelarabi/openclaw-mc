import { useState, useEffect, useRef } from "react";
import { Zap, ChevronDown, Pencil, Trash2 } from "lucide-react";
import type { Agent } from "@/types";
import type { AgentRunStatus } from "@/components/panels/PanelHeader";

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
  const [activeIndex, setActiveIndex] = useState(-1);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const totalItems = agents.length + (onCreateAgent ? 1 : 0);
  const agentStartIndex = onCreateAgent ? 1 : 0;

  useEffect(() => {
    if (!isOpen) {
      setActiveIndex(-1);
    } else {
      dropdownRef.current?.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const container = scrollContainerRef.current;
    if (!container) return;
    const activeEl = container.querySelector('[data-active="true"]') as HTMLElement | null;
    if (activeEl) {
      activeEl.scrollIntoView({ block: "nearest" });
    }
  }, [activeIndex, isOpen]);

  const handleTriggerKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!isOpen) onToggle();
      setActiveIndex(0);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (!isOpen) onToggle();
      setActiveIndex(totalItems - 1);
    } else if (e.key === "Escape" && isOpen) {
      e.preventDefault();
      onToggle();
    }
  };

  const handleDropdownKeyDown = (e: React.KeyboardEvent) => {
    if (totalItems === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((prev) => (prev + 1) % totalItems);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((prev) => (prev - 1 + totalItems) % totalItems);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (onCreateAgent && activeIndex === 0) {
        onCreateAgent();
        onToggle();
      } else {
        const agentIndex = activeIndex - agentStartIndex;
        if (agentIndex >= 0 && agentIndex < agents.length) {
          onSelect(agents[agentIndex].id);
          onToggle();
        }
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      onToggle();
    }
  };

  function getPulseClass(status: AgentRunStatus | undefined): string | null {
    if (!status || status === "idle") return null;
    if (status === "thinking" || status === "tool") return "bg-amber-400 animate-pulse";
    if (status === "text") return "bg-blue-400 animate-pulse";
    if (status === "completed") return "bg-green-500";
    return null;
  }
  return (
    <div className="relative">
      <button
        onClick={onToggle}
        onKeyDown={handleTriggerKeyDown}
        className="flex items-center gap-2 hover:bg-white/10 px-2 py-1 rounded cursor-pointer transition-colors"
      >
        <Zap className="w-3 h-3 text-primary" />
        <span className="font-medium">{activeAgent ? activeAgent.name : "Select Agent"}</span>
        <ChevronDown className="w-3 h-3 opacity-50" />
      </button>

      {isOpen && (
        <div
          ref={dropdownRef}
          className="absolute bottom-full left-0 mb-2 w-64 bg-popover border border-border rounded shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-100"
          onKeyDown={handleDropdownKeyDown}
          tabIndex={-1}
        >
          <div className="p-2 border-b border-border bg-muted/50 flex items-center justify-between gap-2">
            <span className="text-muted-foreground font-medium">Switch Agent</span>
            {onCreateAgent && (
              <button
                onClick={() => {
                  onCreateAgent();
                  onToggle();
                }}
                onMouseEnter={() => setActiveIndex(0)}
                className={`px-2 py-1 text-xs rounded transition-colors ${
                  activeIndex === 0
                    ? "bg-primary/90 text-primary-foreground"
                    : "bg-primary text-primary-foreground hover:bg-primary/90"
                }`}
              >
                New
              </button>
            )}
          </div>
          <div ref={scrollContainerRef} className="max-h-64 overflow-y-auto py-1">
            {agents.map((agent, index) => {
              const itemIndex = index + agentStartIndex;
              return (
                <button
                  key={agent.id}
                  data-active={activeIndex === itemIndex}
                  onClick={() => {
                    onSelect(agent.id);
                    onToggle();
                  }}
                  onMouseEnter={() => setActiveIndex(itemIndex)}
                  className={`w-full text-left px-3 py-2 flex items-center justify-between hover:bg-accent hover:text-accent-foreground transition-colors ${
                    selectedAgent === agent.id ? "bg-accent/50 text-primary" : ""
                  } ${activeIndex === itemIndex ? "bg-accent text-accent-foreground" : ""}`}
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
                      if (agent.status === "active") {
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
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
