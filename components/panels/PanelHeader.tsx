import { X, Plus, RefreshCw } from 'lucide-react';
import { ConfigDropdown } from './ConfigDropdown';
import { ModelSelector } from '../statusbar/ModelSelector';

interface Model {
  id: string;
  alias?: string;
  provider?: string;
}

interface PanelHeaderProps {
  title: string;
  isActive: boolean;
  onClose: () => void;
  onClick: () => void;
  showCloseButton?: boolean;
  onResetSession?: () => void;
  agentId?: string;
  
  // Chat panel specific props
  showTools?: boolean;
  showReasoning?: boolean;
  onShowToolsChange?: (show: boolean) => void;
  onShowReasoningChange?: (show: boolean) => void;
  models?: Model[];
  currentModel?: string;
  onModelChange?: (modelId: string, provider?: string) => void;
  onRefreshChat?: () => void;
}

export function PanelHeader({ 
  title, 
  isActive, 
  onClose, 
  onClick, 
  showCloseButton = true,
  onResetSession,
  agentId,
  showTools,
  showReasoning,
  onShowToolsChange,
  onShowReasoningChange,
  models,
  currentModel,
  onModelChange,
  onRefreshChat,
}: PanelHeaderProps) {
  const handleResetClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onResetSession && window.confirm('Are you sure you want to start a new session? This will clear your chat history.')) {
      onResetSession();
    }
  };

  const handleRefreshClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onRefreshChat) {
      onRefreshChat();
    }
  };

  const isChatPanel = agentId && (showTools !== undefined || showReasoning !== undefined);

  return (
    <div 
      className={`h-10 flex items-center justify-between px-4 border-b cursor-pointer transition-colors ${
        isActive 
          ? 'bg-accent border-primary text-foreground' 
          : 'bg-muted/50 border-border text-muted-foreground hover:bg-muted'
      }`}
      onClick={onClick}
    >
      <span className="font-medium text-sm truncate">{title}</span>
      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
        {/* Model Selector - only for chat panels */}
        {isChatPanel && models && currentModel && onModelChange && (
          <>
            <ModelSelector
              models={models}
              currentModel={currentModel}
              onChange={onModelChange}
            />
            <div className="h-4 w-px bg-border mx-1" />
          </>
        )}
        
        {/* Config Dropdown - only for chat panels */}
        {isChatPanel && showTools !== undefined && showReasoning !== undefined && 
         onShowToolsChange && onShowReasoningChange && (
          <ConfigDropdown
            showTools={showTools}
            showReasoning={showReasoning}
            onShowToolsChange={onShowToolsChange}
            onShowReasoningChange={onShowReasoningChange}
          />
        )}
        
        {/* Refresh Button - only for chat panels with refresh handler */}
        {isChatPanel && onRefreshChat && (
          <button
            onClick={handleRefreshClick}
            className="p-1 hover:bg-background/50 rounded transition-colors"
            aria-label="Refresh chat"
            title="Refresh chat"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        )}
        
        {/* New Session Button - only for chat panels with agentId */}
        {agentId && onResetSession && (
          <button
            onClick={handleResetClick}
            className="p-1 hover:bg-background/50 rounded transition-colors"
            aria-label="Start new session"
            title="Start new session"
          >
            <Plus className="w-4 h-4" />
          </button>
        )}
        
        {showCloseButton && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="p-1 hover:bg-background/50 rounded transition-colors"
            aria-label="Close panel"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
