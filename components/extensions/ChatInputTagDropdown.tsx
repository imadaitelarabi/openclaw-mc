/**
 * Chat Input Tag Dropdown Component
 * 
 * Renders tag suggestions from extensions.
 */

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
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

  const [currentPath, setCurrentPath] = useState<number[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
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

  const getCurrentItems = (source: ChatInputTagOption[], path: number[]) => {
    return getItemsAtPath(source, path);
  };

  const getCurrentLabel = (source: ChatInputTagOption[], path: number[]) => {
    if (path.length === 0) {
      return 'Extensions';
    }

    const node = getNodeAtPath(source, path);
    return node?.label ?? 'Extensions';
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

      const currentItems = getCurrentItems(options, currentPath);
      if (currentItems.length === 0) {
        return;
      }

      const clampedActiveIndex = Math.min(activeIndex, currentItems.length - 1);
      const currentNode = currentItems[clampedActiveIndex];

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setActiveIndex(prev => (prev + 1) % currentItems.length);
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        setActiveIndex(prev => (prev - 1 + currentItems.length) % currentItems.length);
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        if (currentNode?.children && currentNode.children.length > 0) {
          setCurrentPath(prev => [...prev, clampedActiveIndex]);
          setActiveIndex(0);
        }
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        if (currentPath.length > 0) {
          const parentIndex = currentPath[currentPath.length - 1];
          setCurrentPath(prev => prev.slice(0, -1));
          setActiveIndex(parentIndex);
        }
      } else if (event.key === 'Enter' || event.key === 'Tab') {
        event.preventDefault();
        if (!currentNode) {
          return;
        }

        if (currentNode.children && currentNode.children.length > 0) {
          setCurrentPath(prev => [...prev, clampedActiveIndex]);
          setActiveIndex(0);
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
  }, [options, currentPath, activeIndex, onSelect, onClose]);

  // Reset navigation when options change
  useEffect(() => {
    setCurrentPath([]);
    setActiveIndex(0);
  }, [options]);

  // Clamp active index when current level items change
  useEffect(() => {
    const currentItems = getCurrentItems(options, currentPath);
    if (currentItems.length === 0) {
      setActiveIndex(0);
      return;
    }

    if (activeIndex >= currentItems.length) {
      setActiveIndex(currentItems.length - 1);
    }
  }, [options, currentPath, activeIndex]);

  if (options.length === 0 && !isLoading) {
    return null;
  }

  if (!dropdownPosition && inputRef) {
    return null; // Wait for position calculation
  }

  const currentItems = getCurrentItems(options, currentPath);
  const currentLabel = getCurrentLabel(options, currentPath);
  const canGoBack = currentPath.length > 0;

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
        <div
          style={{
            width: `${PANEL_WIDTH}px`,
          }}
          className="bg-popover border border-border rounded-md shadow-lg"
        >
          <div className="px-3 py-2 border-b border-border flex items-center justify-between gap-2">
            <button
              onClick={() => {
                if (!canGoBack) return;
                const parentIndex = currentPath[currentPath.length - 1];
                setCurrentPath(prev => prev.slice(0, -1));
                setActiveIndex(parentIndex);
              }}
              className={`text-xs flex items-center gap-1 ${
                canGoBack ? 'text-foreground hover:text-foreground/80' : 'text-muted-foreground/60 cursor-default'
              }`}
              disabled={!canGoBack}
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              Back
            </button>
            <div className="text-xs text-muted-foreground truncate">{currentLabel}</div>
          </div>

          <div className="py-1 max-h-[260px] overflow-y-auto">
            {currentItems.map((option, index) => {
              const hasChildren = Boolean(option.children && option.children.length > 0);
              const isActive = index === activeIndex;

              return (
                <button
                  key={option.id}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => {
                    if (hasChildren) {
                      setCurrentPath(prev => [...prev, index]);
                      setActiveIndex(0);
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
      )}
    </div>
  );

  // Use Portal to render dropdown at document root level to escape panel stacking context
  if (typeof document !== 'undefined') {
    return createPortal(dropdown, document.body);
  }

  return null;
}
