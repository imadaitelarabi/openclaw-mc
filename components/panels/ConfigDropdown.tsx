import { useState } from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Settings, ChevronLeft } from 'lucide-react';

interface ConfigDropdownProps {
  showTools: boolean;
  showReasoning: boolean;
  onShowToolsChange: (show: boolean) => void;
  onShowReasoningChange: (show: boolean) => void;
  disabled?: boolean;
}

export function ConfigDropdown({
  showTools,
  showReasoning,
  onShowToolsChange,
  onShowReasoningChange,
  disabled = false,
}: ConfigDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <DropdownMenu.Root open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenu.Trigger asChild>
        <button
          disabled={disabled}
          className="p-1 hover:bg-background/50 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          aria-label="Configuration"
          title="Configuration"
        >
          <Settings className="w-4 h-4" />
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          side="bottom"
          align="end"
          sideOffset={8}
          className="z-[110] min-w-[200px] bg-popover border border-border rounded-md shadow-lg p-1"
        >
          {/* Tools Sub-menu */}
          <DropdownMenu.Sub>
            <DropdownMenu.SubTrigger className="w-full text-left px-3 py-1.5 rounded-md outline-none focus:bg-accent hover:bg-accent text-xs flex items-center justify-between gap-2 data-[state=open]:bg-accent">
              <span>Tools</span>
              <ChevronLeft className="w-3 h-3 text-muted-foreground" />
            </DropdownMenu.SubTrigger>

            <DropdownMenu.Portal>
              <DropdownMenu.SubContent
                alignOffset={-4}
                sideOffset={6}
                className="z-[120] min-w-[160px] bg-popover border border-border rounded-md shadow-lg p-1"
              >
                <DropdownMenu.Item
                  onSelect={() => onShowToolsChange(true)}
                  className="w-full text-left px-3 py-1.5 rounded-md outline-none focus:bg-accent hover:bg-accent text-xs flex items-center justify-between gap-2"
                >
                  <span>On</span>
                  {showTools && <div className="w-1.5 h-1.5 rounded-full bg-primary" />}
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  onSelect={() => onShowToolsChange(false)}
                  className="w-full text-left px-3 py-1.5 rounded-md outline-none focus:bg-accent hover:bg-accent text-xs flex items-center justify-between gap-2"
                >
                  <span>Off</span>
                  {!showTools && <div className="w-1.5 h-1.5 rounded-full bg-primary" />}
                </DropdownMenu.Item>
              </DropdownMenu.SubContent>
            </DropdownMenu.Portal>
          </DropdownMenu.Sub>

          {/* Reasoning Sub-menu */}
          <DropdownMenu.Sub>
            <DropdownMenu.SubTrigger className="w-full text-left px-3 py-1.5 rounded-md outline-none focus:bg-accent hover:bg-accent text-xs flex items-center justify-between gap-2 data-[state=open]:bg-accent">
              <span>Reasoning</span>
              <ChevronLeft className="w-3 h-3 text-muted-foreground" />
            </DropdownMenu.SubTrigger>

            <DropdownMenu.Portal>
              <DropdownMenu.SubContent
                alignOffset={-4}
                sideOffset={6}
                className="z-[120] min-w-[160px] bg-popover border border-border rounded-md shadow-lg p-1"
              >
                <DropdownMenu.Item
                  onSelect={() => onShowReasoningChange(true)}
                  className="w-full text-left px-3 py-1.5 rounded-md outline-none focus:bg-accent hover:bg-accent text-xs flex items-center justify-between gap-2"
                >
                  <span>On</span>
                  {showReasoning && <div className="w-1.5 h-1.5 rounded-full bg-primary" />}
                </DropdownMenu.Item>
                <DropdownMenu.Item
                  onSelect={() => onShowReasoningChange(false)}
                  className="w-full text-left px-3 py-1.5 rounded-md outline-none focus:bg-accent hover:bg-accent text-xs flex items-center justify-between gap-2"
                >
                  <span>Off</span>
                  {!showReasoning && <div className="w-1.5 h-1.5 rounded-full bg-primary" />}
                </DropdownMenu.Item>
              </DropdownMenu.SubContent>
            </DropdownMenu.Portal>
          </DropdownMenu.Sub>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
