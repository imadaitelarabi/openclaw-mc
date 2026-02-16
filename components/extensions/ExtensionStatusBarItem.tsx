/**
 * Extension Status Bar Item Component
 * 
 * Renders status bar items from extensions with dropdown support.
 */

import { useState, useRef, useEffect } from 'react';
import * as LucideIcons from 'lucide-react';
import type { StatusBarItem, StatusBarDropdownItem } from '@/types/extension';

interface ExtensionStatusBarItemProps {
  extensionName: string;
  item: StatusBarItem;
  onCopy?: (value: string) => void;
  onOpen?: (url: string) => void;
}

export function ExtensionStatusBarItem({ 
  extensionName, 
  item, 
  onCopy, 
  onOpen 
}: ExtensionStatusBarItemProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Get icon component
  const IconComponent = item.icon 
    ? (LucideIcons as any)[item.icon] || LucideIcons.Box
    : LucideIcons.Box;

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const handleItemClick = (dropdownItem: StatusBarDropdownItem) => {
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

  const renderDropdownItem = (dropdownItem: StatusBarDropdownItem, level: number = 0) => {
    const hasChildren = dropdownItem.children && dropdownItem.children.length > 0;
    
    return (
      <div key={dropdownItem.id} style={{ paddingLeft: `${level * 12}px` }}>
        <button
          onClick={() => handleItemClick(dropdownItem)}
          className="w-full text-left px-3 py-1.5 hover:bg-accent text-xs flex items-center justify-between group"
        >
          <div className="flex-1 min-w-0">
            <div className="text-foreground truncate">{dropdownItem.text}</div>
            {dropdownItem.subtext && (
              <div className="text-muted-foreground text-[10px] truncate">{dropdownItem.subtext}</div>
            )}
          </div>
          {(dropdownItem.copyValue || dropdownItem.openUrl) && (
            <div className="flex gap-1 ml-2 opacity-0 group-hover:opacity-100">
              {dropdownItem.copyValue && (
                <LucideIcons.Copy className="w-3 h-3 text-muted-foreground" />
              )}
              {dropdownItem.openUrl && (
                <LucideIcons.ExternalLink className="w-3 h-3 text-muted-foreground" />
              )}
            </div>
          )}
        </button>
        
        {hasChildren && (
          <div>
            {dropdownItem.children!.map(child => renderDropdownItem(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-2 py-1 hover:bg-accent rounded text-xs"
        title={item.label}
      >
        <IconComponent className="w-3.5 h-3.5" />
        {item.value !== undefined && (
          <span className="text-foreground">{item.value}</span>
        )}
      </button>

      {isOpen && item.items && item.items.length > 0 && (
        <div className="absolute bottom-full left-0 mb-1 bg-popover border border-border rounded shadow-lg min-w-[200px] max-w-[400px] max-h-[400px] overflow-y-auto z-50">
          <div className="py-1">
            {item.items.map(dropdownItem => renderDropdownItem(dropdownItem))}
          </div>
        </div>
      )}
    </div>
  );
}
