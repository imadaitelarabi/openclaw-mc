import { useState } from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Settings, ChevronRight } from 'lucide-react';

interface ExtensionOption {
  name: string;
  description?: string;
  enabled: boolean;
}

interface SettingsDropdownProps {
  extensions?: ExtensionOption[];
  onSelectExtension?: (extensionName: string) => void;
}

export function SettingsDropdown({
  extensions = [],
  onSelectExtension,
}: SettingsDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);

  const sortedExtensions = [...extensions].sort((first, second) =>
    first.name.localeCompare(second.name)
  );

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
          <DropdownMenu.Sub>
            <DropdownMenu.SubTrigger className="w-full text-left px-3 py-1.5 rounded-md outline-none focus:bg-accent hover:bg-accent text-xs flex items-center justify-between gap-2 data-[state=open]:bg-accent">
              <span>Extensions</span>
              <ChevronRight className="w-3 h-3 text-muted-foreground" />
            </DropdownMenu.SubTrigger>

            <DropdownMenu.Portal>
              <DropdownMenu.SubContent
                side="left"
                alignOffset={-4}
                sideOffset={6}
                className="z-[120] min-w-[260px] max-w-[360px] max-h-[320px] overflow-y-auto bg-popover border border-border rounded-md shadow-lg p-1"
              >
                {sortedExtensions.length === 0 ? (
                  <div className="px-3 py-2 text-xs text-muted-foreground">No extensions available</div>
                ) : (
                  sortedExtensions.map((extension) => (
                    <DropdownMenu.Item
                      key={extension.name}
                      onSelect={() => {
                        onSelectExtension?.(extension.name);
                        setIsOpen(false);
                      }}
                      className="w-full text-left px-3 py-1.5 rounded-md outline-none focus:bg-accent hover:bg-accent text-xs flex items-center justify-between gap-2"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-foreground truncate">{extension.name}</div>
                        {extension.description && (
                          <div className="text-muted-foreground text-[10px] truncate">{extension.description}</div>
                        )}
                      </div>
                      <span
                        className={
                          extension.enabled
                            ? 'text-[10px] px-1.5 py-0.5 rounded bg-accent text-foreground'
                            : 'text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground'
                        }
                      >
                        {extension.enabled ? 'Enabled' : 'Disabled'}
                      </span>
                    </DropdownMenu.Item>
                  ))
                )}
              </DropdownMenu.SubContent>
            </DropdownMenu.Portal>
          </DropdownMenu.Sub>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
