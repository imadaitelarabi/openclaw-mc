import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Search } from 'lucide-react';

interface Model {
  id: string;
  alias?: string;
  provider?: string;
}

interface ModelSelectorProps {
  models: Model[];
  currentModel?: string;
  onChange: (modelId: string, provider?: string) => void;
  disabled?: boolean;
}

export function ModelSelector({ models, currentModel, onChange, disabled }: ModelSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  const currentModelData = models.find(m => m.id === currentModel);
  const displayName = currentModelData?.alias || currentModel?.split('/').pop() || 'Select Model';

  const filteredModels = models.filter(m => 
    m.id.toLowerCase().includes(search.toLowerCase()) ||
    m.alias?.toLowerCase().includes(search.toLowerCase()) ||
    m.provider?.toLowerCase().includes(search.toLowerCase())
  );

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
        <span className="text-xs">🤖</span>
        <span className="font-medium text-xs">{displayName}</span>
        <ChevronDown className="w-3 h-3 opacity-50" />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-2 w-[calc(100vw-24px)] sm:w-72 bg-popover border border-border rounded shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-100 max-w-[320px] z-[130]">
          <div className="p-2 border-b border-border bg-muted/50">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search models..."
                className="w-full pl-7 pr-2 py-1 text-xs bg-background border border-border rounded focus:outline-none focus:border-primary/50"
                autoFocus
              />
            </div>
          </div>
          <div className="max-h-64 overflow-y-auto py-1">
            {filteredModels.length === 0 ? (
              <div className="px-3 py-2 text-xs text-muted-foreground">
                No models found
              </div>
            ) : (
              filteredModels.map(model => (
                <button
                  key={`${model.provider}:${model.id}`}
                  onClick={() => {
                    onChange(model.id, model.provider);
                    setIsOpen(false);
                    setSearch('');
                  }}
                  className={`w-full text-left px-3 py-2 text-xs hover:bg-accent hover:text-accent-foreground transition-colors ${
                    model.id === currentModel ? 'bg-accent/50 text-primary' : ''
                  }`}
                >
                  <div className="font-medium">{model.alias || model.id.split('/').pop()}</div>
                  <div className="text-[10px] text-muted-foreground">{model.id} ({model.provider})</div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
