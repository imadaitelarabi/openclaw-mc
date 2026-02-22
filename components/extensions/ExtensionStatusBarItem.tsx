/**
 * Extension Status Bar Item Component
 *
 * Renders status bar items from extensions with dropdown support.
 */

import { useState } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import * as LucideIcons from "lucide-react";
import type { StatusBarItem, StatusBarDropdownItem } from "@/types/extension";

interface ExtensionStatusBarItemProps {
  extensionName: string;
  item: StatusBarItem;
  onCopy?: (value: string) => void;
  onOpen?: (url: string) => void;
  onOpenPanel?: (extensionName: string, panelId: string) => void;
}

export function ExtensionStatusBarItem({
  extensionName,
  item,
  onCopy,
  onOpen,
  onOpenPanel,
}: ExtensionStatusBarItemProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Get icon component
  const IconComponent = item.icon
    ? (LucideIcons as any)[item.icon] || LucideIcons.Box
    : LucideIcons.Box;

  const handleItemSelect = (dropdownItem: StatusBarDropdownItem) => {
    // Panel open action (host-handled)
    if (dropdownItem.openPanelId && onOpenPanel) {
      onOpenPanel(extensionName, dropdownItem.openPanelId);
      setIsOpen(false);
      return;
    }

    // Primary action: copy if available
    if (dropdownItem.copyValue && onCopy) {
      onCopy(dropdownItem.copyValue);
    }

    // Secondary action: open if available
    if (dropdownItem.openUrl && onOpen) {
      onOpen(dropdownItem.openUrl);
    }
    setIsOpen(false);
  };

  const renderMenuItems = (items: StatusBarDropdownItem[]) => {
    return (
      <>
        {items.map((dropdownItem) => {
          const hasChildren = Boolean(dropdownItem.children && dropdownItem.children.length > 0);

          if (hasChildren) {
            return (
              <DropdownMenu.Sub key={dropdownItem.id}>
                <DropdownMenu.SubTrigger className="w-full text-left px-3 py-1.5 rounded-md outline-none focus:bg-accent hover:bg-accent text-xs flex items-center justify-between gap-2 data-[state=open]:bg-accent">
                  <div className="flex-1 min-w-0">
                    <div className="text-foreground truncate">{dropdownItem.text}</div>
                    {dropdownItem.subtext && (
                      <div className="text-muted-foreground text-[10px] truncate">
                        {dropdownItem.subtext}
                      </div>
                    )}
                  </div>
                  <LucideIcons.ChevronLeft className="w-3 h-3 text-muted-foreground" />
                </DropdownMenu.SubTrigger>

                <DropdownMenu.Portal>
                  <DropdownMenu.SubContent
                    side="left"
                    alignOffset={-4}
                    sideOffset={6}
                    className="z-[120] min-w-[260px] max-w-[340px] max-h-[320px] overflow-y-auto bg-popover border border-border rounded-md shadow-lg p-1"
                  >
                    {renderMenuItems(dropdownItem.children!)}
                  </DropdownMenu.SubContent>
                </DropdownMenu.Portal>
              </DropdownMenu.Sub>
            );
          }

          return (
            <DropdownMenu.Item
              key={dropdownItem.id}
              onSelect={() => handleItemSelect(dropdownItem)}
              className="w-full text-left px-3 py-1.5 rounded-md outline-none focus:bg-accent hover:bg-accent text-xs flex items-center justify-between gap-2 group"
            >
              <div className="flex-1 min-w-0">
                <div className="text-foreground truncate">{dropdownItem.text}</div>
                {dropdownItem.subtext && (
                  <div className="text-muted-foreground text-[10px] truncate">
                    {dropdownItem.subtext}
                  </div>
                )}
              </div>

              {(dropdownItem.copyValue || dropdownItem.openUrl || dropdownItem.openPanelId) && (
                <div className="flex gap-1 opacity-0 group-hover:opacity-100">
                  {dropdownItem.copyValue && (
                    <LucideIcons.Copy className="w-3 h-3 text-muted-foreground" />
                  )}
                  {dropdownItem.openUrl && (
                    <LucideIcons.ExternalLink className="w-3 h-3 text-muted-foreground" />
                  )}
                  {dropdownItem.openPanelId && (
                    <LucideIcons.PanelRight className="w-3 h-3 text-muted-foreground" />
                  )}
                </div>
              )}
            </DropdownMenu.Item>
          );
        })}
      </>
    );
  };

  return (
    <DropdownMenu.Root open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenu.Trigger asChild>
        <button
          className="flex items-center gap-1.5 px-2 py-1 hover:bg-accent rounded text-xs"
          title={item.label}
        >
          <IconComponent className="w-3.5 h-3.5" />
          {item.value !== undefined && <span className="text-foreground">{item.value}</span>}
        </button>
      </DropdownMenu.Trigger>

      {item.items && item.items.length > 0 && (
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            side="top"
            align="end"
            sideOffset={8}
            className="z-[110] min-w-[260px] max-w-[340px] max-h-[320px] overflow-y-auto bg-popover border border-border rounded-md shadow-lg p-1"
          >
            {renderMenuItems(item.items)}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      )}
    </DropdownMenu.Root>
  );
}
