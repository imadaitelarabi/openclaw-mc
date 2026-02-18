import { ReasoningCard } from './ReasoningCard';
import { ToolCard } from './ToolCard';
import type { ActiveRun, ChatMessage } from '@/types';

interface ActiveRunOverlayProps {
  activeRun: ActiveRun | null;
}

/**
 * ActiveRunOverlay renders the ephemeral streaming state at the bottom of the chat.
 * It displays reasoning, tool execution, or assistant text based on the active run status.
 * Content is committed to chatHistory when lifecycle events occur.
 */
export function ActiveRunOverlay({ activeRun }: ActiveRunOverlayProps) {
  if (!activeRun) return null;

  // Render reasoning stream
  if (activeRun.status === 'thinking' && activeRun.content) {
    const reasoningMessage: ChatMessage = {
      id: 'streaming',
      role: 'reasoning',
      content: activeRun.content,
      timestamp: Date.now(),
      runId: activeRun.runId
    };

    return (
      <div className="flex flex-col items-start">
        <ReasoningCard message={reasoningMessage} isStreaming />
      </div>
    );
  }

  // Render tool execution
  if (activeRun.status === 'tool' && activeRun.tool) {
    const toolMessage: ChatMessage = {
      id: 'streaming-tool',
      role: 'tool',
      content: activeRun.tool.name,
      tool: {
        name: activeRun.tool.name,
        args: activeRun.tool.args,
        result: activeRun.tool.result,
        // Map 'update' to 'start' for ToolCard display - both indicate running state
        status: activeRun.tool.status === 'update' ? 'start' : activeRun.tool.status,
        startTime: activeRun.tool.startTime
      },
      timestamp: Date.now(),
      runId: activeRun.runId
    };

    return (
      <div className="flex flex-col items-start">
        <ToolCard message={toolMessage} />
      </div>
    );
  }

  // Render assistant text stream
  if (activeRun.status === 'text' && activeRun.content) {
    return (
      <div className="flex flex-col items-start">
        <div className="max-w-[85%] rounded-lg p-4 bg-secondary/60 backdrop-blur border border-secondary text-foreground">
          <div className="text-sm md:text-base whitespace-pre-wrap leading-relaxed opacity-90">
            {activeRun.content}
            <span className="inline-block w-2 h-4 ml-1 bg-foreground/50 animate-pulse">▊</span>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
