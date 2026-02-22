"use client";

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
}

export function FilterDropdown({
  value,
  placeholder,
  options,
  onChange,
  widthClassName,
  includeEmptyOption = true,
  disabled = false,
}: FilterDropdownProps) {
  const selectedLabel = options.find((option) => option.value === value)?.label || placeholder;

  return (
    <DropdownMenu.Root>
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
          className="z-[120] min-w-[180px] max-h-[280px] overflow-y-auto bg-popover border border-border rounded-md shadow-lg p-1"
        >
          {includeEmptyOption && (
            <DropdownMenu.Item
              onSelect={() => onChange("")}
              className="w-full text-left px-3 py-1.5 rounded-md outline-none focus:bg-accent hover:bg-accent text-xs flex items-center justify-between gap-2"
            >
              <span>{placeholder}</span>
              {!value && <Check className="w-3 h-3 text-primary" />}
            </DropdownMenu.Item>
          )}

          {options.map((option) => (
            <DropdownMenu.Item
              key={option.value}
              onSelect={() => onChange(option.value)}
              className="w-full text-left px-3 py-1.5 rounded-md outline-none focus:bg-accent hover:bg-accent text-xs flex items-center justify-between gap-2"
            >
              <span className="truncate">{option.label}</span>
              {value === option.value && <Check className="w-3 h-3 text-primary" />}
            </DropdownMenu.Item>
          ))}

          {options.length === 0 && (
            <div className="px-3 py-1.5 text-xs text-muted-foreground">No options</div>
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
