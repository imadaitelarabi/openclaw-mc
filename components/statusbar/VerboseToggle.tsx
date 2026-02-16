import { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';

interface VerboseSelectorProps {
  value: 'on' | 'off';
  onChange: (value: 'on' | 'off') => void;
  disabled?: boolean;
}

const VERBOSE_MODES = [
  { value: 'on' as const, label: 'On', desc: 'Show tool calls' },
  { value: 'off' as const, label: 'Off', desc: 'Hide tool calls' },
];

export function VerboseToggle({ value, onChange, disabled }: VerboseSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentMode = VERBOSE_MODES.find(m => m.value === value) || VERBOSE_MODES[1]; // Default to 'Off'

  // Close on click outside
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

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled}
        className="flex items-center gap-2 hover:bg-white/10 px-2 py-1 rounded cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <span className="text-xs">📊</span>
        <span className="font-medium text-xs">{currentMode.label}</span>
        <ChevronDown className="w-3 h-3 opacity-50" />
      </button>

      {isOpen && (
        <div className="absolute bottom-full left-0 mb-2 w-48 bg-popover border border-border rounded shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-100 z-50">
          <div className="py-1">
            {VERBOSE_MODES.map(mode => (
              <button
                key={mode.value}
                onClick={() => {
                  onChange(mode.value);
                  setIsOpen(false);
                }}
                className={`w-full text-left px-3 py-2 text-xs hover:bg-accent hover:text-accent-foreground transition-colors flex items-center justify-between ${
                  value === mode.value ? 'bg-accent/50 text-primary' : ''
                }`}
              >
                <div>
                  <div className="font-medium">{mode.label}</div>
                  <div className="text-[10px] text-muted-foreground">{mode.desc}</div>
                </div>
                {value === mode.value && <div className="w-1.5 h-1.5 rounded-full bg-primary" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
