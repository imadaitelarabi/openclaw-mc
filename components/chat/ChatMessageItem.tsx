import { useState, memo, useCallback } from "react";
import type { ChatMessage } from "@/types";
import { ToolCard } from "./ToolCard";
import { ReasoningCard } from "./ReasoningCard";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Copy, Check } from "lucide-react";
import { usePanels } from "@/contexts/PanelContext";
import { chatLinkMatcherRegistry } from "@/lib/chat-link-matcher-registry";

interface ChatMessageItemProps {
  message: ChatMessage;
  showTools: boolean;
}

export const ChatMessageItem = memo(
  function ChatMessageItem({ message, showTools }: ChatMessageItemProps) {
    const [copied, setCopied] = useState(false);
    const { openPanel } = usePanels();
    const content =
      typeof message.content === "string"
        ? message.content
        : message.content == null
          ? ""
          : JSON.stringify(message.content, null, 2);
    const isAssistantError =
      message.role === "assistant" &&
      (message.stopReason === "error" || Boolean(message.errorMessage));
    const assistantErrorText = message.errorMessage || content || "Request failed";

    const handleCopy = async () => {
      try {
        await navigator.clipboard.writeText(isAssistantError ? assistantErrorText : content);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        console.error("Failed to copy text:", err);
        // Optionally show error feedback to user
      }
    };

    const handleLinkClick = useCallback(
      (e: React.MouseEvent<HTMLAnchorElement>) => {
        // Cmd/Ctrl-click should open in a new tab as normal
        if (e.metaKey || e.ctrlKey) return;

        const href = e.currentTarget.href;
        if (!href) return;

        const result = chatLinkMatcherRegistry.match(href);
        if (!result) return;

        e.preventDefault();
        openPanel(result.panelType, result.panelData);
      },
      [openPanel]
    );

    if (message.role === "tool") {
      // Only show tool cards when showTools is true
      if (!showTools) {
        return null;
      }
      return (
        <div className="flex flex-col items-start">
          <ToolCard message={message} />
        </div>
      );
    }

    if (message.role === "reasoning") {
      return (
        <div className="flex flex-col items-start">
          <ReasoningCard message={message} />
        </div>
      );
    }

    return (
      <div
        className={`flex flex-col w-full overflow-hidden ${message.role === "user" ? "items-end" : "items-start"}`}
      >
        <div
          className={`relative max-w-[95%] sm:max-w-[85%] rounded-lg p-3 md:p-4 group ${
            message.role === "user"
              ? "bg-primary text-primary-foreground"
              : isAssistantError
                ? "bg-destructive/10 border border-destructive/20 text-destructive"
                : "bg-secondary/80 backdrop-blur"
          }`}
        >
          {/* Display attachments if present */}
          {message.attachments && message.attachments.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-2">
              {message.attachments.map((attachment, index) => (
                <div
                  key={`${attachment.fileName || "attachment"}-${index}`}
                  className="relative rounded overflow-hidden border border-white/20"
                >
                  {/* Only render if it's a valid image data URI */}
                  {attachment.content.startsWith("data:image/") && (
                    <img
                      src={attachment.content}
                      alt={attachment.fileName || "Image attachment"}
                      className="max-w-xs max-h-48 object-contain"
                      title={attachment.fileName || "Image attachment"}
                    />
                  )}
                </div>
              ))}
            </div>
          )}
          {isAssistantError ? (
            <div className="flex items-start gap-2 text-sm">
              <span aria-hidden="true" className="mt-0.5">
                ❌
              </span>
              <div className="min-w-0">
                <p className="font-medium">Request failed</p>
                <p className="mt-1 whitespace-pre-wrap break-words opacity-90">
                  {assistantErrorText}
                </p>
              </div>
            </div>
          ) : (
            <div className="markdown-content break-words select-text max-w-none">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  a: ({ node: _node, ...props }) => (
                    <a
                      {...props}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={handleLinkClick}
                      className={
                        message.role === "user"
                          ? "!text-foreground underline hover:opacity-90"
                          : undefined
                      }
                    />
                  ),
                }}
              >
                {content}
              </ReactMarkdown>
            </div>
          )}
          {message.thinking && (
            <details className="mt-3 pt-3 border-t border-white/10">
              <summary className="text-xs cursor-pointer opacity-70 hover:opacity-100">
                💭 Thinking (deprecated)
              </summary>
              <div className="mt-2 text-xs opacity-80 whitespace-pre-wrap">{message.thinking}</div>
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
  },
  (prevProps, nextProps) => {
    // Custom comparison for better memoization
    // Return true if props are equal (component should NOT re-render)

    // Message ID is the primary identifier - if it changed, it's a different message
    if (prevProps.message.id !== nextProps.message.id) {
      return false;
    }

    // Check if showTools changed (affects rendering of tool messages)
    if (prevProps.showTools !== nextProps.showTools) {
      return false;
    }

    // For the same message ID, check if content changed (e.g., streaming updates)
    if (prevProps.message.content !== nextProps.message.content) {
      return false;
    }

    if (prevProps.message.stopReason !== nextProps.message.stopReason) {
      return false;
    }

    if (prevProps.message.errorMessage !== nextProps.message.errorMessage) {
      return false;
    }

    // Check if tool existence changed
    const prevHasTool = !!prevProps.message.tool;
    const nextHasTool = !!nextProps.message.tool;
    if (prevHasTool !== nextHasTool) {
      return false;
    }

    // Check if tool properties changed (status, result, error, name, or args)
    if (prevHasTool && nextHasTool) {
      const prevTool = prevProps.message.tool!;
      const nextTool = nextProps.message.tool!;
      if (
        prevTool.status !== nextTool.status ||
        prevTool.result !== nextTool.result ||
        prevTool.error !== nextTool.error ||
        prevTool.name !== nextTool.name ||
        prevTool.args !== nextTool.args
      ) {
        return false;
      }
    }

    // All relevant fields are equal, no need to re-render
    return true;
  }
);
