import { useEffect, useRef, useState } from 'react';
import { ChevronUp, Puzzle } from 'lucide-react';

interface ExtensionOption {
  name: string;
  description?: string;
  enabled: boolean;
}

interface ExtensionsDropdownProps {
  extensions: ExtensionOption[];
  onSelectExtension?: (extensionName: string) => void;
}

export function ExtensionsDropdown({ extensions, onSelectExtension }: ExtensionsDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (!isOpen) {
      return;
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(prev => !prev)}
        className="flex items-center gap-1.5 px-2 py-1 hover:bg-accent rounded text-xs"
        title="Available extensions"
      >
        <Puzzle className="w-3.5 h-3.5" />
        <span>Extensions</span>
        <span className="text-muted-foreground">({extensions.length})</span>
        <ChevronUp className="w-3 h-3 text-muted-foreground" />
      </button>

      {isOpen && (
        <div className="absolute bottom-full right-0 mb-1 bg-popover border border-border rounded shadow-lg min-w-[260px] max-w-[380px] max-h-[320px] overflow-y-auto z-50">
          {extensions.length === 0 ? (
            <div className="px-3 py-2 text-xs text-muted-foreground">No extensions available</div>
          ) : (
            <div className="py-1">
              {extensions.map(extension => (
                <button
                  key={extension.name}
                  onClick={() => {
                    onSelectExtension?.(extension.name);
                    setIsOpen(false);
                  }}
                  className="w-full text-left px-3 py-2 text-xs hover:bg-accent"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-foreground font-medium truncate">{extension.name}</span>
                    <span
                      className={
                        extension.enabled
                          ? 'text-[10px] px-1.5 py-0.5 rounded bg-accent text-foreground'
                          : 'text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground'
                      }
                    >
                      {extension.enabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                  {extension.description && (
                    <div className="text-muted-foreground text-[10px] mt-0.5 truncate">{extension.description}</div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
