"use client";

import { useState } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Check, ChevronDown } from "lucide-react";

export interface FilterDropdownOption {
  value: string;
  label: string;
}

interface FilterDropdownProps {
  value: string;
  placeholder: string;
  options: FilterDropdownOption[];
  onChange: (value: string) => void;
  widthClassName?: string;
  includeEmptyOption?: boolean;
  disabled?: boolean;
  searchable?: boolean;
}

export function FilterDropdown({
  value,
  placeholder,
  options,
  onChange,
  widthClassName,
  includeEmptyOption = true,
  disabled = false,
  searchable = false,
}: FilterDropdownProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const selectedLabel = options.find((option) => option.value === value)?.label || placeholder;

  const filteredOptions =
    searchable && searchQuery
      ? options.filter((opt) => opt.label.toLowerCase().includes(searchQuery.toLowerCase()))
      : options;

  return (
    <DropdownMenu.Root
      onOpenChange={(open) => {
        if (!open) setSearchQuery("");
      }}
    >
      <DropdownMenu.Trigger asChild>
        <button
          disabled={disabled}
          className={`px-2 py-1 text-xs border border-border rounded bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-ring hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-between gap-2 ${widthClassName || ""}`}
        >
          <span className="truncate">{selectedLabel}</span>
          <ChevronDown className="w-3 h-3 text-muted-foreground flex-shrink-0" />
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          sideOffset={6}
          align="start"
          className="z-[120] min-w-[180px] bg-popover border border-border rounded-md shadow-lg"
        >
          {searchable && (
            <div className="p-1.5 border-b border-border">
              <input
                type="text"
                placeholder="Search…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.stopPropagation()}
                autoFocus
                className="w-full px-2 py-1 text-xs border border-border rounded bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          )}

          <div className="max-h-[240px] overflow-y-auto p-1">
            {includeEmptyOption && (
              <DropdownMenu.Item
                onSelect={() => onChange("")}
                className="w-full text-left px-3 py-1.5 rounded-md outline-none focus:bg-accent hover:bg-accent text-xs flex items-center justify-between gap-2"
              >
                <span>{placeholder}</span>
                {!value && <Check className="w-3 h-3 text-primary" />}
              </DropdownMenu.Item>
            )}

            {filteredOptions.map((option) => (
              <DropdownMenu.Item
                key={option.value}
                onSelect={() => onChange(option.value)}
                className="w-full text-left px-3 py-1.5 rounded-md outline-none focus:bg-accent hover:bg-accent text-xs flex items-center justify-between gap-2"
              >
                <span className="truncate">{option.label}</span>
                {value === option.value && <Check className="w-3 h-3 text-primary" />}
              </DropdownMenu.Item>
            ))}

            {filteredOptions.length === 0 && (
              <div className="px-3 py-1.5 text-xs text-muted-foreground">No options</div>
            )}
          </div>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
