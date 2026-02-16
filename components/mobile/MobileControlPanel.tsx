"use client";

import { ChevronRight, Settings2, Shield, Info, Gauge, Wifi, Globe, Trash2, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Agent, ConnectionStatus } from '@/types';
import { ModelSelector, ThinkingToggle, VerboseToggle, ReasoningToggle } from '../statusbar';

interface MobileControlPanelProps {
  isOpen: boolean;
  onClose: () => void;
  agents: Agent[];
  selectedAgent: string | null;
  activeAgent?: Agent;
  onSelectAgent: (id: string) => void;
  models: any[];
  currentModel?: string;
  thinkingMode: 'off' | 'low' | 'medium' | 'high';
  verboseMode: 'on' | 'off';
  reasoningMode: 'off' | 'stream';
  onModelChange: (model: string, provider?: string) => void;
  onThinkingChange: (val: any) => void;
  onVerboseChange: (val: any) => void;
  onReasoningChange: (val: any) => void;
  
  // Gateway management
  connectionStatus: ConnectionStatus;
  gateways: any[];
  activeGatewayId: string | null;
  onSwitchGateway: (id: string) => void;
  onAddGateway: () => void;
  onRemoveGateway: (id: string) => void;
}

export function MobileControlPanel({
  isOpen,
  onClose,
  agents,
  selectedAgent,
  activeAgent,
  onSelectAgent,
  models,
  currentModel,
  thinkingMode,
  verboseMode,
  reasoningMode,
  onModelChange,
  onThinkingChange,
  onVerboseChange,
  onReasoningChange,
  connectionStatus,
  gateways,
  activeGatewayId,
  onSwitchGateway,
  onAddGateway,
  onRemoveGateway
}: MobileControlPanelProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-background/80 backdrop-blur-md flex flex-col animate-in fade-in duration-200">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <h2 className="text-lg font-bold">Mission Control</h2>
        <button 
          onClick={onClose}
          className="p-2 hover:bg-white/10 rounded-full"
        >
          <ChevronRight className="w-6 h-6 rotate-90" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-8 pb-20">
        {/* Gateway Section */}
        <section>
          <div className="flex items-center gap-2 mb-4 text-muted-foreground">
            <Wifi className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-wider">Gateway Connection</span>
          </div>
          <div className="space-y-2">
            {gateways.map(gateway => (
              <div 
                key={gateway.id}
                className={cn(
                  "flex items-center justify-between p-4 rounded-xl border transition-all",
                  activeGatewayId === gateway.id 
                    ? "bg-primary/10 border-primary/50" 
                    : "bg-secondary/30 border-border"
                )}
                onClick={() => onSwitchGateway(gateway.id)}
              >
                <div className="flex items-center gap-3">
                  <Globe className={cn("w-5 h-5", activeGatewayId === gateway.id ? "text-primary" : "text-muted-foreground")} />
                  <div>
                    <div className="font-bold text-sm">{gateway.name}</div>
                    <div className="text-[10px] opacity-50 truncate max-w-[150px]">{gateway.url}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                   {activeGatewayId === gateway.id && <div className="text-[10px] font-bold text-primary uppercase tracking-tighter">Active</div>}
                   {!gateway.isLocal && (
                     <button 
                       onClick={(e) => {
                         e.stopPropagation();
                         onRemoveGateway(gateway.id);
                       }}
                       className="p-2 text-destructive/50 active:text-destructive"
                     >
                       <Trash2 className="w-4 h-4" />
                     </button>
                   )}
                </div>
              </div>
            ))}
            <button 
              onClick={onAddGateway}
              className="w-full flex items-center justify-center gap-2 p-4 rounded-xl border border-dashed border-border hover:bg-secondary/50 transition-colors text-sm font-bold text-primary"
            >
              <Plus className="w-4 h-4" />
              Add Remote Gateway
            </button>
          </div>
        </section>

        {/* Agent Selection Section */}
        <section>
          <div className="flex items-center gap-2 mb-4 text-muted-foreground">
            <Shield className="w-4 h-4" />
            <span className="text-xs font-bold uppercase tracking-wider">Agents</span>
          </div>
          <div className="grid grid-cols-1 gap-2">
            {agents.map(agent => (
              <button
                key={agent.id}
                onClick={() => onSelectAgent(agent.id)}
                className={cn(
                  "flex items-center justify-between p-4 rounded-xl border transition-all text-left",
                  selectedAgent === agent.id 
                    ? "bg-primary border-primary text-primary-foreground shadow-lg scale-[1.02]" 
                    : "bg-secondary/50 border-border text-foreground hover:bg-secondary"
                )}
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{agent.emoji || "🤖"}</span>
                  <div>
                    <div className="font-bold">{agent.name}</div>
                    <div className={cn(
                      "text-[10px] opacity-70 uppercase tracking-tighter",
                      selectedAgent === agent.id ? "text-primary-foreground" : "text-muted-foreground"
                    )}>
                      {agent.id}
                    </div>
                  </div>
                </div>
                {agent.status === 'active' && (
                  <div className={cn(
                    "w-2 h-2 rounded-full animate-pulse",
                    selectedAgent === agent.id ? "bg-white" : "bg-green-500"
                  )} />
                )}
              </button>
            ))}
          </div>
        </section>

        {/* Active Agent Settings */}
        {selectedAgent && (
          <section className="animate-in slide-in-from-bottom-4 duration-300">
            <div className="flex items-center gap-2 mb-4 text-muted-foreground">
              <Settings2 className="w-4 h-4" />
              <span className="text-xs font-bold uppercase tracking-wider">Configuration</span>
            </div>
            
            <div className="space-y-4 bg-secondary/30 p-4 rounded-2xl border border-border/50">
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-bold text-muted-foreground uppercase ml-1">Model</label>
                <ModelSelector
                  models={models}
                  currentModel={currentModel}
                  onChange={onModelChange}
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase ml-1">Thinking</label>
                  <ThinkingToggle
                    value={thinkingMode}
                    onChange={onThinkingChange}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase ml-1">Verbosity</label>
                  <VerboseToggle
                    value={verboseMode}
                    onChange={onVerboseChange}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-[10px] font-bold text-muted-foreground uppercase ml-1">Reasoning</label>
                  <ReasoningToggle
                    value={reasoningMode}
                    onChange={onReasoningChange}
                  />
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Stats / Info */}
        {activeAgent && (
          <section>
            <div className="flex items-center gap-2 mb-4 text-muted-foreground">
              <Gauge className="w-4 h-4" />
              <span className="text-xs font-bold uppercase tracking-wider">Session Health</span>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl border border-border bg-background/50 flex flex-col gap-1">
                <span className="opacity-50">Status</span>
                <span className="font-bold text-green-500 capitalize">{activeAgent.status}</span>
              </div>
              <div className="p-3 rounded-xl border border-border bg-background/50 flex flex-col gap-1">
                <span className="opacity-50">Identity</span>
                <span className="font-bold truncate">{activeAgent.identity || 'Default'}</span>
              </div>
            </div>
          </section>
        )}
      </div>

      <div className="p-6 border-t border-border bg-background/50">
        <button 
          onClick={onClose}
          className="w-full bg-foreground text-background py-4 rounded-2xl font-bold active:scale-[0.98] transition-transform"
        >
          Close Controls
        </button>
      </div>
    </div>
  );
}
