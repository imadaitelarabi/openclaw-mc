import type { ChatMessage } from '@/types';

interface ToolCardProps {
  message: ChatMessage;
}

export function ToolCard({ message }: ToolCardProps) {
  const { tool } = message;
  if (!tool) return null;

  return (
    <div className="max-w-[85%] rounded-lg p-4 bg-amber-500/10 border border-amber-500/30 backdrop-blur">
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-2 h-2 rounded-full ${
          tool.status === 'end' ? 'bg-amber-600' : 'bg-amber-500 animate-pulse'
        }`} />
        <span className="text-xs font-mono text-amber-700 dark:text-amber-300 font-semibold">
          Tool: {tool.name}
        </span>
        <span className="text-xs text-muted-foreground ml-auto">
          {tool.status === 'end' ? '✓' : '⋯'}
        </span>
      </div>
      
      {tool.args && (
        <details className="mt-2">
          <summary className="text-xs cursor-pointer text-muted-foreground hover:text-foreground">
            Arguments
          </summary>
          <pre className="text-xs mt-2 p-2 bg-black/20 rounded overflow-x-auto">
            {JSON.stringify(tool.args, null, 2)}
          </pre>
        </details>
      )}
      
      {tool.result && (
        <details className="mt-2">
          <summary className="text-xs cursor-pointer text-muted-foreground hover:text-foreground">
            Result
          </summary>
          <pre className="text-xs mt-2 p-2 bg-black/20 rounded overflow-x-auto max-h-64">
            {typeof tool.result === 'string' 
              ? tool.result 
              : JSON.stringify(tool.result, null, 2)}
          </pre>
        </details>
      )}
    </div>
  );
}
