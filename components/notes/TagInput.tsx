/**
 * Tag Input Component
 * Allows selecting multiple tags with autocomplete and inline creation
 */

"use client";

import { useState, useRef, useEffect, useCallback } from 'react';
import { X, Tag } from 'lucide-react';
import { asRgba, getTagColor } from '@/lib/tag-colors';

interface TagInputProps {
  selectedTags: string[];
  allTags: string[];
  tagColors?: Record<string, string>;
  onChange: (tags: string[]) => void;
  disabled?: boolean;
}

export function TagInput({ selectedTags, allTags, tagColors, onChange, disabled }: TagInputProps) {
  const [inputValue, setInputValue] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const filteredSuggestions = allTags.filter(
    tag =>
      !selectedTags.includes(tag) &&
      tag.toLowerCase().includes(inputValue.toLowerCase())
  );

  const showCreateOption =
    inputValue.trim().length > 0 &&
    !allTags.some(t => t.toLowerCase() === inputValue.trim().toLowerCase()) &&
    !selectedTags.some(t => t.toLowerCase() === inputValue.trim().toLowerCase());

  const addTag = useCallback(
    (tag: string) => {
      const trimmed = tag.trim();
      if (!trimmed || selectedTags.includes(trimmed)) return;
      onChange([...selectedTags, trimmed]);
      setInputValue('');
    },
    [selectedTags, onChange]
  );

  const removeTag = useCallback(
    (tag: string) => {
      onChange(selectedTags.filter(t => t !== tag));
    },
    [selectedTags, onChange]
  );

  useEffect(() => {
    const handleDocumentClick = (event: MouseEvent) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleDocumentClick);
    return () => document.removeEventListener('mousedown', handleDocumentClick);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (inputValue.trim()) {
        addTag(inputValue);
      }
    } else if (e.key === 'Backspace' && !inputValue && selectedTags.length > 0) {
      removeTag(selectedTags[selectedTags.length - 1]);
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      inputRef.current?.blur();
    }
  };

  const hasDropdown = isOpen && (filteredSuggestions.length > 0 || showCreateOption);

  return (
    <div className="relative" ref={containerRef}>
      <div
        className={`flex flex-wrap gap-1 items-center bg-secondary/50 border border-border rounded-lg px-2 py-1.5 cursor-text ${disabled ? 'opacity-50' : 'hover:border-primary/30'}`}
        onClick={() => {
          if (!disabled) {
            inputRef.current?.focus();
            setIsOpen(true);
          }
        }}
      >
        <Tag className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
        {selectedTags.map(tag => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
            style={{
              backgroundColor: asRgba(getTagColor(tag, tagColors), 0.2),
              color: getTagColor(tag, tagColors),
            }}
          >
            {tag}
            {!disabled && (
              <button
                type="button"
                onClick={e => {
                  e.stopPropagation();
                  removeTag(tag);
                }}
                className="hover:text-destructive transition-colors"
                aria-label={`Remove tag ${tag}`}
              >
                <X className="w-2.5 h-2.5" />
              </button>
            )}
          </span>
        ))}
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={hasDropdown}
          aria-autocomplete="list"
          value={inputValue}
          onChange={e => {
            setInputValue(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={selectedTags.length === 0 ? 'Add tags...' : ''}
          className="flex-1 min-w-[80px] bg-transparent outline-none text-xs placeholder:text-muted-foreground"
          disabled={disabled}
        />
      </div>

      {hasDropdown && (
        <div className="absolute bottom-full mb-1 left-0 right-0 bg-popover border border-border rounded shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-100 z-50">
          <div role="listbox" aria-label="Tag suggestions" className="max-h-40 overflow-y-auto py-1">
            {filteredSuggestions.map(tag => (
              <button
                key={tag}
                type="button"
                role="option"
                aria-selected={false}
                onMouseDown={e => {
                  e.preventDefault();
                  addTag(tag);
                }}
                className="w-full px-3 py-1.5 text-left text-xs hover:bg-accent hover:text-accent-foreground transition-colors flex items-center gap-2"
              >
                <Tag className="w-3 h-3 text-muted-foreground" />
                <span style={{ color: getTagColor(tag, tagColors) }}>{tag}</span>
              </button>
            ))}
            {showCreateOption && (
              <button
                type="button"
                role="option"
                aria-selected={false}
                onMouseDown={e => {
                  e.preventDefault();
                  addTag(inputValue.trim());
                }}
                className="w-full px-3 py-1.5 text-left text-xs hover:bg-accent hover:text-accent-foreground transition-colors flex items-center gap-2 border-t border-border"
              >
                <span className="text-muted-foreground">Create tag:</span>
                <span className="font-medium">{inputValue.trim()}</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
