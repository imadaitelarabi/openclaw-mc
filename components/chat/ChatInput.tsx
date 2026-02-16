import { Send } from 'lucide-react';
import { useRef, useEffect } from 'react';
import type { Agent } from '@/types';

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  activeAgent?: Agent;
  disabled?: boolean;
}

export function ChatInput({ value, onChange, onSend, activeAgent, disabled }: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Reset height when value is empty
  useEffect(() => {
    if (!value && textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [value]);

  const handleSend = () => {
    onSend();
    // Reset height after sending
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  return (
    <div className="p-3 md:p-4 border-t border-border bg-background/50 backdrop-blur">
      <div className="max-w-4xl mx-auto flex gap-2 md:gap-3 items-end">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            e.target.style.height = 'auto';
            e.target.style.height = Math.min(e.target.scrollHeight, 200) + 'px';
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder={`Message ${activeAgent?.name || 'agent'}...`}
          className="flex-1 bg-secondary/50 border border-border rounded-lg px-3 py-2 md:px-4 md:py-3 focus:outline-none focus:border-primary/50 font-sans resize-none overflow-y-auto max-h-[200px] min-h-[40px] md:min-h-[46px] text-sm md:text-base"
          rows={1}
          autoFocus
          disabled={disabled}
        />
        <button
          onClick={handleSend}
          disabled={!value.trim() || disabled}
          className="bg-primary text-primary-foreground p-2.5 md:px-4 md:py-3 rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
        >
          <Send className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
