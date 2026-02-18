import { useState } from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Settings } from 'lucide-react';

interface SettingsDropdownProps {
  onOpenExtensions?: () => void;
}

export function SettingsDropdown({ onOpenExtensions }: SettingsDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <DropdownMenu.Root open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenu.Trigger asChild>
        <button
          className="flex items-center gap-1.5 px-2 py-1 hover:bg-accent rounded text-xs"
          title="Settings"
        >
          <Settings className="w-3.5 h-3.5" />
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          side="top"
          align="end"
          sideOffset={8}
          className="z-[110] min-w-[200px] bg-popover border border-border rounded-md shadow-lg p-1"
        >
          <DropdownMenu.Item
            onSelect={() => {
              onOpenExtensions?.();
              setIsOpen(false);
            }}
            className="w-full text-left px-3 py-1.5 rounded-md outline-none focus:bg-accent hover:bg-accent text-xs"
          >
            Extensions
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
