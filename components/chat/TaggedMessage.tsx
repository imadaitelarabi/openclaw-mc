/**
 * Tagged Message Component
 * Renders tagged messages with appropriate styling
 */

import { parseTaggedMessage } from '@/lib/event-formatting';
import { ReasoningCard } from './ReasoningCard';
import { ToolCard } from './ToolCard';
import type { ChatMessage } from '@/types';

interface TaggedMessageProps {
  content: string;
  runId?: string;
  timestamp: number;
}

export function TaggedMessage({ content, runId, timestamp }: TaggedMessageProps) {
  const parsed = parseTaggedMessage(content);

  // Render trace/reasoning blocks
  if (parsed.type === 'trace') {
    const message: ChatMessage = {
      id: runId ? `${runId}-trace` : `trace-${timestamp}`,
      role: 'reasoning',
      content: parsed.content,
      timestamp,
      runId
    };
    return <ReasoningCard message={message} />;
  }

  // Render tool calls
  if (parsed.type === 'tool') {
    const message: ChatMessage = {
      id: runId ? `${runId}-tool` : `tool-${timestamp}`,
      role: 'tool',
      content: parsed.toolName || 'unknown',
      tool: {
        name: parsed.toolName || 'unknown',
        args: parsed.toolArgs,
        status: 'start'
      },
      timestamp,
      runId
    };
    return <ToolCard message={message} />;
  }

  // Render tool results
  if (parsed.type === 'tool-result') {
    const message: ChatMessage = {
      id: runId ? `${runId}-tool-result` : `tool-result-${timestamp}`,
      role: 'tool',
      content: parsed.content,
      tool: {
        name: 'Result',
        result: parsed.content,
        status: 'end',
        ...(parsed.toolMeta && { meta: parsed.toolMeta })
      },
      timestamp,
      runId
    };
    return (
      <div className="max-w-[85%] rounded-lg p-4 bg-emerald-500/10 border border-emerald-500/30 backdrop-blur">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-2 h-2 rounded-full bg-emerald-600" />
          <span className="text-xs font-mono text-emerald-700 dark:text-emerald-300 font-semibold">
            ✓ Tool Result
          </span>
        </div>
        
        {parsed.toolMeta && (
          <div className="mb-2 flex flex-wrap gap-2 text-xs text-emerald-700 dark:text-emerald-300">
            {parsed.toolMeta.exitCode !== undefined && (
              <span className="px-2 py-0.5 bg-emerald-500/20 rounded">
                Exit: {parsed.toolMeta.exitCode}
              </span>
            )}
            {parsed.toolMeta.duration !== undefined && (
              <span className="px-2 py-0.5 bg-emerald-500/20 rounded">
                {parsed.toolMeta.duration}ms
              </span>
            )}
            {parsed.toolMeta.cwd && (
              <span className="px-2 py-0.5 bg-emerald-500/20 rounded truncate max-w-[200px]">
                {parsed.toolMeta.cwd}
              </span>
            )}
          </div>
        )}
        
        <details className="mt-2">
          <summary className="text-xs cursor-pointer text-muted-foreground hover:text-foreground">
            Output
          </summary>
          <pre className="text-xs mt-2 p-2 bg-black/20 rounded overflow-x-auto max-h-64">
            {parsed.content}
          </pre>
        </details>
      </div>
    );
  }

  // Render meta (usually hidden, just for debugging)
  if (parsed.type === 'meta') {
    return (
      <div className="max-w-[85%] rounded-lg p-2 bg-slate-500/10 border border-slate-500/20 backdrop-blur">
        <div className="text-xs font-mono text-slate-600 dark:text-slate-400">
          📊 Meta: {parsed.content}
        </div>
      </div>
    );
  }

  // Plain message (fallback)
  return (
    <div className="max-w-[85%] rounded-lg p-4 bg-secondary/80 backdrop-blur">
      <div className="text-sm whitespace-pre-wrap leading-relaxed">
        {parsed.content}
      </div>
    </div>
  );
}
