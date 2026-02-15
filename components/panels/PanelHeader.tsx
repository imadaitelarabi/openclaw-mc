import { X } from 'lucide-react';

interface PanelHeaderProps {
  title: string;
  isActive: boolean;
  onClose: () => void;
  onClick: () => void;
}

export function PanelHeader({ title, isActive, onClose, onClick }: PanelHeaderProps) {
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
    </div>
  );
}
