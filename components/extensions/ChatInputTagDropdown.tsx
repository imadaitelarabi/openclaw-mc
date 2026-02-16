/**
 * Chat Input Tag Dropdown Component
 * 
 * Renders tag suggestions from extensions.
 */

import { useState, useEffect, useRef } from 'react';
import type { ChatInputTagOption } from '@/types/extension';

interface ChatInputTagDropdownProps {
  options: ChatInputTagOption[];
  onSelect: (option: ChatInputTagOption) => void;
  onClose: () => void;
  position?: { top: number; left: number };
}

export function ChatInputTagDropdown({ 
  options, 
  onSelect, 
  onClose,
  position 
}: ChatInputTagDropdownProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);

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
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setSelectedIndex(prev => (prev + 1) % options.length);
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        setSelectedIndex(prev => (prev - 1 + options.length) % options.length);
      } else if (event.key === 'Enter') {
        event.preventDefault();
        if (options[selectedIndex]) {
          onSelect(options[selectedIndex]);
        }
      } else if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [options, selectedIndex, onSelect, onClose]);

  // Reset selected index when options change
  useEffect(() => {
    setSelectedIndex(0);
  }, [options]);

  if (options.length === 0) {
    return null;
  }

  const renderOption = (option: ChatInputTagOption, index: number, level: number = 0) => {
    const isSelected = index === selectedIndex;
    
    return (
      <div key={option.id}>
        <button
          onClick={() => onSelect(option)}
          className={`w-full text-left px-3 py-2 text-sm flex items-start gap-2 ${
            isSelected ? 'bg-accent' : 'hover:bg-accent/50'
          }`}
          style={{ paddingLeft: `${12 + level * 16}px` }}
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
        </button>
        
        {option.children && option.children.length > 0 && (
          <div>
            {option.children.map((child, childIndex) => 
              renderOption(child, index + childIndex + 1, level + 1)
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <div 
      ref={dropdownRef}
      className="absolute bottom-full left-0 mb-2 bg-popover border border-border rounded-lg shadow-lg w-full max-w-md max-h-[300px] overflow-y-auto z-50"
      style={position}
    >
      <div className="py-1">
        {options.map((option, index) => renderOption(option, index))}
      </div>
    </div>
  );
}
