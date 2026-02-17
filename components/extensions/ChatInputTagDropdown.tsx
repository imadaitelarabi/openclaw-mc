/**
 * Chat Input Tag Dropdown Component
 * 
 * Renders tag suggestions from extensions.
 */

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ChevronRight, Loader2 } from 'lucide-react';
import type { ChatInputTagOption } from '@/types/extension';

interface ChatInputTagDropdownProps {
  options: ChatInputTagOption[];
  onSelect: (option: ChatInputTagOption) => void;
  onClose: () => void;
  isLoading?: boolean;
  position?: { top: number; left: number };
  inputRef?: React.RefObject<HTMLTextAreaElement>;
}

export function ChatInputTagDropdown({ 
  options, 
  onSelect, 
  onClose,
  isLoading = false,
  position,
  inputRef
}: ChatInputTagDropdownProps) {
  const PANEL_WIDTH = 280;
  const PANEL_GAP = 8;
  const DROPDOWN_GAP = 8; // Gap above/below input element
  const DROPDOWN_Z_INDEX = 9999; // High z-index to appear above all panels
  const ESTIMATED_ITEM_HEIGHT = 60; // Approximate height per menu item
  const DROPDOWN_PADDING = 20; // Additional padding for borders/spacing
  const MAX_DROPDOWN_HEIGHT = 280; // Maximum dropdown height before scrolling

  const [activePath, setActivePath] = useState<number[]>([]);
  const [dropdownPosition, setDropdownPosition] = useState<{ top: number; left: number; positionAbove: boolean } | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Calculate dropdown position based on input ref
  // Note: Tracks options.length for performance - position only updates when number of options changes
  // Full options comparison would cause unnecessary recalculations on every keystroke
  // Trade-off: If options change content but maintain same count, position won't update
  // This is acceptable since item heights are relatively uniform
  // Edge case: Loading state has different height but is temporary, so estimation is sufficient
  useEffect(() => {
    const updatePosition = () => {
      if (inputRef?.current) {
        const rect = inputRef.current.getBoundingClientRect();
        
        // Estimate dropdown height based on number of options
        const estimatedDropdownHeight = Math.min(
          options.length * ESTIMATED_ITEM_HEIGHT + DROPDOWN_PADDING, 
          MAX_DROPDOWN_HEIGHT
        );
        
        // Determine vertical position: try above first (preferred), fall back to below
        // When positioned above, dropdown extends upward from anchor point due to transform
        const spaceAbove = rect.top - DROPDOWN_GAP;
        let dropdownTop: number;
        let positionAbove: boolean;
        
        if (spaceAbove >= estimatedDropdownHeight) {
          // Enough space above input for dropdown
          dropdownTop = rect.top - DROPDOWN_GAP;
          positionAbove = true;
        } else {
          // Not enough space above, position below input instead
          dropdownTop = rect.bottom + DROPDOWN_GAP;
          positionAbove = false;
        }
        
        setDropdownPosition({
          top: dropdownTop,
          left: rect.left,
          positionAbove
        });
      }
    };

    updatePosition();
    
    // Update position on window resize or scroll
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);
    
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [inputRef, options.length]);

  const getNodeAtPath = (source: ChatInputTagOption[], path: number[]) => {
    let current: ChatInputTagOption | null = null;
    let items = source;

    for (const index of path) {
      current = items[index] || null;
      if (!current) {
        return null;
      }
      items = current.children || [];
    }

    return current;
  };

  const getItemsAtPath = (source: ChatInputTagOption[], parentPath: number[]) => {
    if (parentPath.length === 0) {
      return source;
    }

    const parentNode = getNodeAtPath(source, parentPath);
    return parentNode?.children || [];
  };

  const getFirstPath = (source: ChatInputTagOption[]) => {
    if (source.length === 0) {
      return [] as number[];
    }
    return [0];
  };

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (options.length === 0) {
        if (event.key === 'Escape') {
          event.preventDefault();
          onClose();
        }
        return;
      }

      const path = activePath.length > 0 ? activePath : getFirstPath(options);
      const currentNode = getNodeAtPath(options, path);

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        const parentPath = path.slice(0, -1);
        const siblings = getItemsAtPath(options, parentPath);
        const currentIndex = path[path.length - 1] ?? 0;
        const nextIndex = (currentIndex + 1) % siblings.length;
        setActivePath([...parentPath, nextIndex]);
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        const parentPath = path.slice(0, -1);
        const siblings = getItemsAtPath(options, parentPath);
        const currentIndex = path[path.length - 1] ?? 0;
        const nextIndex = (currentIndex - 1 + siblings.length) % siblings.length;
        setActivePath([...parentPath, nextIndex]);
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        if (currentNode?.children && currentNode.children.length > 0) {
          setActivePath([...path, 0]);
        }
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        if (path.length > 1) {
          setActivePath(path.slice(0, -1));
        }
      } else if (event.key === 'Enter' || event.key === 'Tab') {
        event.preventDefault();
        if (!currentNode) {
          return;
        }

        if (currentNode.children && currentNode.children.length > 0) {
          setActivePath([...path, 0]);
        } else {
          onSelect(currentNode);
        }
      } else if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [options, activePath, onSelect, onClose]);

  // Reset active path when options change
  useEffect(() => {
    setActivePath(getFirstPath(options));
  }, [options]);

  if (options.length === 0 && !isLoading) {
    return null;
  }

  if (!dropdownPosition && inputRef) {
    return null; // Wait for position calculation
  }

  const renderMenuPanel = (items: ChatInputTagOption[], parentPath: number[] = [], level = 0) => {
    return (
      <div
        style={{
          width: `${PANEL_WIDTH}px`,
        }}
        className="bg-popover border border-border rounded-md shadow-lg"
      >
        <div className="py-1 max-h-[260px] overflow-y-auto">
          {items.map((option, index) => {
            const currentPath = [...parentPath, index];
            const isActive = currentPath.every((segment, i) => activePath[i] === segment) && activePath.length > 0;
            const hasChildren = Boolean(option.children && option.children.length > 0);

            return (
              <button
                key={option.id}
                onMouseEnter={() => setActivePath(currentPath)}
                onClick={() => {
                  if (hasChildren) {
                    setActivePath([...currentPath, 0]);
                    return;
                  }
                  onSelect(option);
                }}
                className={`w-full text-left px-3 py-2 text-sm flex items-start gap-2 justify-between ${
                  isActive ? 'bg-accent' : 'hover:bg-accent/50'
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-foreground truncate">{option.label}</div>
                  {option.description && (
                    <div className="text-xs text-muted-foreground truncate mt-0.5">
                      {option.description}
                    </div>
                  )}
                  <div className="text-xs text-muted-foreground font-mono truncate mt-0.5">
                    {option.tag}
                  </div>
                </div>

                {hasChildren && <ChevronRight className="w-3.5 h-3.5 mt-0.5 text-muted-foreground" />}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  const panels: ChatInputTagOption[][] = [];
  let panelParentPath: number[] = [];
  let panelItems = options;

  panels.push(panelItems);

  for (let depth = 0; depth < activePath.length; depth++) {
    const index = activePath[depth];
    const node = panelItems[index];

    if (!node || !node.children || node.children.length === 0) {
      break;
    }

    panelParentPath = [...panelParentPath, index];
    panelItems = node.children;
    panels.push(panelItems);
  }

  const dropdown = (
    <div 
      ref={dropdownRef}
      className="fixed"
      style={{
        top: dropdownPosition ? `${dropdownPosition.top}px` : undefined,
        left: dropdownPosition ? `${dropdownPosition.left}px` : undefined,
        transform: dropdownPosition?.positionAbove ? 'translateY(-100%)' : undefined,
        zIndex: DROPDOWN_Z_INDEX,
      }}
    >
      {isLoading && options.length === 0 ? (
        <div className="bg-popover border border-border rounded-md shadow-lg px-3 py-2 text-xs text-muted-foreground flex items-center gap-2">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          Loading suggestions...
        </div>
      ) : (
        <div className="flex items-start" style={{ gap: `${PANEL_GAP}px` }}>
          {panels.map((panelOptions, level) => (
            <div key={`panel-${level}-${activePath.slice(0, level).join('-')}`}>
              {renderMenuPanel(panelOptions, activePath.slice(0, level), level)}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // Use Portal to render dropdown at document root level to escape panel stacking context
  if (typeof document !== 'undefined') {
    return createPortal(dropdown, document.body);
  }

  return null;
}
