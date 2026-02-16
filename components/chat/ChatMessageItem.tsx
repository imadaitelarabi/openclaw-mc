import { useState } from 'react';
import type { ChatMessage } from '@/types';
import { ToolCard } from './ToolCard';
import { ReasoningCard } from './ReasoningCard';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Copy, Check } from 'lucide-react';

interface ChatMessageItemProps {
  message: ChatMessage;
  verboseMode: 'on' | 'off';
}

export function ChatMessageItem({ message, verboseMode }: ChatMessageItemProps) {
  const [copied, setCopied] = useState(false);
  const content = typeof message.content === 'string'
    ? message.content
    : message.content == null
      ? ''
      : JSON.stringify(message.content, null, 2);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy text:', err);
      // Optionally show error feedback to user
    }
  };

  if (message.role === 'tool') {
    // Only show tool cards when verbose mode is 'on'
    if (verboseMode !== 'on') {
      return null;
    }
    return (
      <div className="flex flex-col items-start">
        <ToolCard message={message} />
      </div>
    );
  }

  if (message.role === 'reasoning') {
    return (
      <div className="flex flex-col items-start">
        <ReasoningCard message={message} />
      </div>
    );
  }

  return (
    <div className={`flex flex-col w-full overflow-hidden ${message.role === 'user' ? 'items-end' : 'items-start'}`}>
      <div className={`relative max-w-[95%] sm:max-w-[85%] rounded-lg p-3 md:p-4 group ${
        message.role === 'user' 
          ? 'bg-primary text-primary-foreground' 
          : 'bg-secondary/80 backdrop-blur'
      }`}>
        <div className="markdown-content break-words select-text max-w-none">
          <ReactMarkdown 
            remarkPlugins={[remarkGfm]}
            components={{
              a: ({ node, ...props }) => (
                <a {...props} target="_blank" rel="noopener noreferrer" />
              )
            }}
          >
            {content}
          </ReactMarkdown>
        </div>
        {message.thinking && (
          <details className="mt-3 pt-3 border-t border-white/10">
            <summary className="text-xs cursor-pointer opacity-70 hover:opacity-100">
              💭 Thinking (deprecated)
            </summary>
            <div className="mt-2 text-xs opacity-80 whitespace-pre-wrap">
              {message.thinking}
            </div>
          </details>
        )}
        <button
          onClick={handleCopy}
          className="absolute bottom-2 right-2 p-1.5 rounded opacity-0 group-hover:opacity-100 transition-opacity bg-black/10 dark:bg-white/10 hover:bg-black/20 dark:hover:bg-white/20"
          aria-label="Copy message"
        >
          {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
        </button>
      </div>
    </div>
  );
}
