import { useState, useRef, useEffect } from "react";
import { ChevronDown, BrainCircuit } from "lucide-react";

interface ThinkingSelectorProps {
  value: "off" | "low" | "medium" | "high";
  onChange: (value: "off" | "low" | "medium" | "high") => void;
  disabled?: boolean;
}

const THINKING_MODES = [
  { value: "off" as const, label: "Off", desc: "No reasoning" },
  { value: "low" as const, label: "Low", desc: "Fast reasoning" },
  { value: "medium" as const, label: "Med", desc: "Balanced" },
  { value: "high" as const, label: "High", desc: "Deep reasoning" },
];

export function ThinkingToggle({ value, onChange, disabled }: ThinkingSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(() =>
    THINKING_MODES.findIndex((m) => m.value === value)
  );
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentMode = THINKING_MODES.find((m) => m.value === value) || THINKING_MODES[0];

  // Sync activeIndex when menu opens
  useEffect(() => {
    if (isOpen) {
      setActiveIndex(THINKING_MODES.findIndex((m) => m.value === value));
    }
  }, [isOpen, value]);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((prev) => (prev + 1) % THINKING_MODES.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((prev) => (prev - 1 + THINKING_MODES.length) % THINKING_MODES.length);
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (activeIndex >= 0 && activeIndex < THINKING_MODES.length) {
          onChange(THINKING_MODES[activeIndex].value);
          setIsOpen(false);
        }
      } else if (e.key === "Escape") {
        e.preventDefault();
        setIsOpen(false);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, activeIndex, onChange]);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled}
        className="flex items-center gap-2 hover:bg-white/10 px-2 py-1 rounded cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        aria-label="Thinking level"
        title="Thinking level"
      >
        <BrainCircuit className="w-3.5 h-3.5" />
        <span className="font-medium text-xs">{currentMode.label}</span>
        <ChevronDown className="w-3 h-3 opacity-50" />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-48 bg-popover border border-border rounded shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-100 z-[130]">
          <div className="py-1">
            {THINKING_MODES.map((mode, index) => (
              <button
                key={mode.value}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => {
                  onChange(mode.value);
                  setIsOpen(false);
                }}
                className={`w-full text-left px-3 py-2 text-xs hover:bg-accent hover:text-accent-foreground transition-colors flex items-center justify-between ${
                  index === activeIndex
                    ? "bg-accent text-accent-foreground"
                    : value === mode.value
                      ? "bg-accent/50 text-primary"
                      : ""
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
