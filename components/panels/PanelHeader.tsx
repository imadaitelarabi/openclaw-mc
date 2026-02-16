import { X, RotateCcw } from 'lucide-react';

interface PanelHeaderProps {
  title: string;
  isActive: boolean;
  onClose: () => void;
  onClick: () => void;
  showCloseButton?: boolean;
  onResetSession?: () => void;
  agentId?: string;
}

export function PanelHeader({ 
  title, 
  isActive, 
  onClose, 
  onClick, 
  showCloseButton = true,
  onResetSession,
  agentId
}: PanelHeaderProps) {
  const handleResetClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onResetSession && window.confirm('Are you sure you want to start a new session? This will clear your chat history.')) {
      onResetSession();
    }
  };

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
      <div className="flex items-center gap-1">
        {/* New Session Button - only for chat panels with agentId */}
        {agentId && onResetSession && (
          <button
            onClick={handleResetClick}
            className="p-1 hover:bg-background/50 rounded transition-colors"
            aria-label="Start new session"
            title="Start new session"
          >
            <RotateCcw className="w-4 h-4" />
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
