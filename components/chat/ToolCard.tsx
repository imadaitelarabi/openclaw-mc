import type { ChatMessage } from "@/types";
import { Loader2, CheckCircle, XCircle } from "lucide-react";

interface ToolCardProps {
  message: ChatMessage;
}

export function ToolCard({ message }: ToolCardProps) {
  const { tool } = message;
  if (!tool) return null;

  const isPending = tool.status === "start";
  const isSuccess = tool.status === "end";
  const isError = tool.status === "error";

  // Determine card styling based on state
  const cardClasses = isPending
    ? "bg-amber-500/10 border-amber-500/30 animate-pulse"
    : isError
      ? "bg-red-500/10 border-red-500/30"
      : "bg-emerald-500/10 border-emerald-500/30";

  return (
    <div
      className={`max-w-[85%] rounded-lg p-4 border backdrop-blur transition-all duration-300 ${cardClasses}`}
    >
      <div className="flex items-center gap-2 mb-2">
        {/* Status icon */}
        {isPending && (
          <Loader2 className="w-4 h-4 text-amber-600 dark:text-amber-400 animate-spin" />
        )}
        {isSuccess && <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />}
        {isError && <XCircle className="w-4 h-4 text-red-600 dark:text-red-400" />}

        <span
          className={`text-xs font-mono font-semibold ${
            isPending
              ? "text-amber-700 dark:text-amber-300"
              : isError
                ? "text-red-700 dark:text-red-300"
                : "text-emerald-700 dark:text-emerald-300"
          }`}
        >
          Tool: {tool.name}
        </span>

        {/* Status label */}
        <span
          className={`text-xs ml-auto ${
            isPending
              ? "text-amber-600 dark:text-amber-400"
              : isError
                ? "text-red-600 dark:text-red-400"
                : "text-emerald-600 dark:text-emerald-400"
          }`}
        >
          {isPending && "Running..."}
          {isSuccess && "Completed"}
          {isError && "Failed"}
        </span>
      </div>

      {/* Metadata badges */}
      {(tool.duration !== undefined || tool.exitCode !== undefined) && (
        <div className="flex gap-2 mb-2">
          {tool.duration !== undefined && (
            <span className="text-xs px-2 py-0.5 rounded bg-black/20 text-muted-foreground">
              {tool.duration < 1000
                ? `${tool.duration}ms`
                : `${(tool.duration / 1000).toFixed(2)}s`}
            </span>
          )}
          {tool.exitCode !== undefined && (
            <span
              className={`text-xs px-2 py-0.5 rounded ${
                tool.exitCode === 0
                  ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300"
                  : "bg-red-500/20 text-red-700 dark:text-red-300"
              }`}
            >
              exit: {tool.exitCode}
            </span>
          )}
        </div>
      )}

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

      {/* Error message */}
      {isError && tool.error && (
        <div className="mt-2 p-2 bg-red-500/20 rounded">
          <p className="text-xs text-red-700 dark:text-red-300 font-semibold mb-1">Error:</p>
          <pre className="text-xs text-red-600 dark:text-red-400 whitespace-pre-wrap">
            {tool.error}
          </pre>
        </div>
      )}

      {/* Result section - collapsed by default */}
      {tool.result && !isError && (
        <details className="mt-2">
          <summary className="text-xs cursor-pointer text-muted-foreground hover:text-foreground">
            Result
          </summary>
          <pre className="text-xs mt-2 p-2 bg-black/20 rounded overflow-auto max-h-64">
            {typeof tool.result === "string" ? tool.result : JSON.stringify(tool.result, null, 2)}
          </pre>
        </details>
      )}
    </div>
  );
}
