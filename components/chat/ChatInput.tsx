import { Send, Square, Paperclip } from "lucide-react";
import { useRef, useEffect, useState } from "react";
import type { Agent, ChatAttachment, Note, SkillStatusEntry } from "@/types";
import { DEFAULT_ATTACHMENT_CONFIG } from "@/types/attachment";
import { AttachmentPreview } from "./AttachmentPreview";
import { ChatInputTagDropdown } from "@/components/extensions";
import {
  fileToAttachment,
  validateFile,
  getFilesFromClipboard,
  revokePreviewUrls,
} from "@/lib/file-utils";
import { useToast } from "@/hooks/useToast";
import {
  useExtensionChatInput,
  useNativeChatInput,
  useChatTagging,
  EXTENSION_OPTION_ID_PREFIX,
  NATIVE_PROVIDER_OPTION_ID_PREFIX,
} from "@/hooks";
import type { ChatInputTagOption } from "@/types/extension";
import type { SessionUsage } from "@/hooks/useSessionUsage";

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: (attachments?: ChatAttachment[]) => void;
  activeAgent?: Agent;
  notes?: Note[];
  noteGroups?: string[];
  skills?: SkillStatusEntry[];
  disabled?: boolean;
  isRunning?: boolean;
  onAbort?: () => void;
  tokenUsage?: SessionUsage;
}

export function ChatInput({
  value,
  onChange,
  onSend,
  activeAgent,
  notes = [],
  noteGroups = [],
  skills = [],
  disabled,
  isRunning,
  onAbort,
  tokenUsage,
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const attachmentsRef = useRef<ChatAttachment[]>([]);
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [tagOptions, setTagOptions] = useState<ChatInputTagOption[]>([]);
  const { toast } = useToast();
  const { searchTags: searchExtensionTags, isLoading: isExtensionTagLoading } =
    useExtensionChatInput();
  const { searchTags: searchNativeTags, isLoading: isNativeTagLoading } = useNativeChatInput({
    notes,
    groups: noteGroups,
    skills,
  });
  const { isTagging, tagQuery, handleInput, insertTag, cancelTagging } = useChatTagging();

  const activeTagTrigger = isTagging ? tagQuery.trim().charAt(0) : "";
  const isTagLoading = activeTagTrigger === "#" ? isNativeTagLoading : isExtensionTagLoading;
  const isTagDropdownOpen = isTagging && (isTagLoading || tagOptions.length > 0);

  // Reset height when value is empty
  useEffect(() => {
    if (!value && textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [value]);

  // Keep latest attachments for unmount cleanup
  useEffect(() => {
    attachmentsRef.current = attachments;
  }, [attachments]);

  // Clean up preview URLs on unmount
  useEffect(() => {
    return () => {
      revokePreviewUrls(attachmentsRef.current);
    };
  }, []);

  // Fetch tag options when user types @... (extensions) or #... (native)
  useEffect(() => {
    let cancelled = false;

    const loadTagOptions = async () => {
      if (!isTagging || !tagQuery) {
        setTagOptions([]);
        return;
      }

      const trigger = tagQuery.trim().charAt(0);
      if (trigger !== "@" && trigger !== "#") {
        setTagOptions([]);
        return;
      }

      const options =
        trigger === "#" ? await searchNativeTags(tagQuery) : await searchExtensionTags(tagQuery);

      if (!cancelled) {
        setTagOptions(options);
      }
    };

    loadTagOptions();

    return () => {
      cancelled = true;
    };
  }, [isTagging, tagQuery, searchExtensionTags, searchNativeTags]);

  const autoResizeTextarea = () => {
    requestAnimationFrame(() => {
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
        textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
      }
    });
  };

  const handleSend = () => {
    onSend(attachments.length > 0 ? attachments : undefined);
    // Clear attachments after sending
    revokePreviewUrls(attachments);
    setAttachments([]);
    // Reset height after sending
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleButtonClick = () => {
    if (isRunning && onAbort) {
      onAbort();
    } else {
      handleSend();
    }
  };

  const processFiles = async (files: File[]) => {
    for (const file of files) {
      // Validate file
      const validation = validateFile(file, DEFAULT_ATTACHMENT_CONFIG);
      if (!validation.valid) {
        toast({
          title: "Invalid file",
          description: validation.error,
          variant: "destructive",
        });
        continue;
      }

      try {
        const attachment = await fileToAttachment(file);
        setAttachments((prev) => [...prev, attachment]);
        toast({
          title: "File attached",
          description: file.name,
          variant: "success",
        });
      } catch (error) {
        toast({
          title: "Failed to attach file",
          description: (error as Error).message,
          variant: "destructive",
        });
      }
    }
  };

  const attachNoteImage = async (imageUrl: string) => {
    try {
      const response = await fetch(imageUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch note image (${response.status})`);
      }

      const blob = await response.blob();
      const parsedUrl = new URL(imageUrl, window.location.origin);
      const fileName = decodeURIComponent(
        parsedUrl.pathname.split("/").pop() || `note-image-${Date.now()}.png`
      );
      const file = new File([blob], fileName, {
        type: blob.type || "image/png",
      });

      const validation = validateFile(file, DEFAULT_ATTACHMENT_CONFIG);
      if (!validation.valid) {
        throw new Error(validation.error || "Invalid note image");
      }

      const attachment = await fileToAttachment(file);
      setAttachments((prev) => [...prev, attachment]);

      toast({
        title: "Note image attached",
        description: fileName,
        variant: "success",
      });
    } catch (error) {
      toast({
        title: "Failed to attach note image",
        description: (error as Error).message,
        variant: "destructive",
      });
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      processFiles(files);
    }
    // Reset input so same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      processFiles(files);
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const files = getFilesFromClipboard(e.clipboardData);
    if (files.length > 0) {
      e.preventDefault();
      processFiles(files);
    }
  };

  const handleRemoveAttachment = (index: number) => {
    setAttachments((prev) => {
      const removed = prev[index];
      if (removed.previewUrl) {
        URL.revokeObjectURL(removed.previewUrl);
      }
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleSelectTagOption = (option: ChatInputTagOption) => {
    const isExtensionProviderOption = option.id.startsWith(EXTENSION_OPTION_ID_PREFIX);
    const isNativeProviderOption = option.id.startsWith(NATIVE_PROVIDER_OPTION_ID_PREFIX);
    const isProviderSelection = isExtensionProviderOption || isNativeProviderOption;

    const isNativeNoteOption = option.meta?.kind === "native-note";

    let newPosition = 0;
    const insertValue = isProviderSelection
      ? option.tag
      : isNativeNoteOption
        ? `<note>\n${option.value?.trim() ? option.value : ""}\n</note>`
        : option.value?.trim()
          ? option.value
          : option.tag;

    const insertedValue = insertTag(value, insertValue, (cursorPosition: number) => {
      newPosition = cursorPosition;
    });

    // Keep mention mode active after selecting a provider-level option
    if (isProviderSelection) {
      const cursorBeforeInsertedSpace = Math.max(0, newPosition - 1);
      const valueForLevel2 = `${insertedValue.slice(0, cursorBeforeInsertedSpace)}${insertedValue.slice(newPosition)}`;

      onChange(valueForLevel2);
      autoResizeTextarea();

      requestAnimationFrame(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
          textareaRef.current.setSelectionRange(
            cursorBeforeInsertedSpace,
            cursorBeforeInsertedSpace
          );
          handleInput(valueForLevel2, cursorBeforeInsertedSpace);
        }
      });

      return;
    }

    onChange(insertedValue);
    autoResizeTextarea();
    setTagOptions([]);

    if (
      option.meta?.kind === "native-note" &&
      typeof option.meta.imageUrl === "string" &&
      option.meta.imageUrl
    ) {
      void attachNoteImage(option.meta.imageUrl);
    }

    requestAnimationFrame(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(newPosition, newPosition);
      }
    });
  };

  const handleCloseTagDropdown = () => {
    cancelTagging();
    setTagOptions([]);
  };

  return (
    <div className="p-3 md:p-4 border-t border-border bg-background/50 backdrop-blur">
      <div className="max-w-4xl mx-auto">
        {/* Attachment Preview */}
        <AttachmentPreview attachments={attachments} onRemove={handleRemoveAttachment} />

        {/* Token Usage Indicator */}
        {tokenUsage &&
          (() => {
            const { totalTokens, modelContextWindow, isUnlimited, isLoading, error } = tokenUsage;

            if (isLoading) {
              return (
                <div className="text-xs text-muted-foreground mb-1.5 transition-colors duration-300">
                  Loading usage…
                </div>
              );
            }

            if (error) {
              return (
                <div className="text-xs text-muted-foreground mb-1.5 transition-colors duration-300">
                  Usage unavailable
                </div>
              );
            }

            if (isUnlimited) {
              return (
                <div className="text-xs text-muted-foreground mb-1.5 transition-colors duration-300">
                  Unlimited context
                </div>
              );
            }

            if (totalTokens === null || modelContextWindow === null || modelContextWindow === 0) {
              return (
                <div className="text-xs text-muted-foreground mb-1.5 transition-colors duration-300">
                  Usage unavailable
                </div>
              );
            }

            const percentage = (totalTokens / modelContextWindow) * 100;
            const totalK = Math.floor(totalTokens / 1000);
            const contextK = Math.floor(modelContextWindow / 1000);
            const colorClass =
              percentage >= 90
                ? "text-destructive"
                : percentage >= 70
                  ? "text-yellow-500"
                  : "text-green-500";

            return (
              <div className={`text-xs mb-1.5 transition-colors duration-300 ${colorClass}`}>
                {totalK}k / {contextK}k tokens
              </div>
            );
          })()}

        {/* Input Container */}
        <div
          className={`relative flex gap-2 md:gap-3 items-end ${isDragging ? "ring-2 ring-primary rounded-lg" : ""}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
            disabled={disabled}
          />

          {/* Attachment button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={disabled}
            className="bg-secondary/50 border border-border p-2.5 md:px-3 md:py-3 rounded-lg hover:bg-secondary transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
            title={`Attach images (max ${DEFAULT_ATTACHMENT_CONFIG.maxSizeMb}MB)`}
          >
            <Paperclip className="w-5 h-5" />
          </button>

          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => {
              const newValue = e.target.value;
              onChange(newValue);
              handleInput(newValue, e.target.selectionStart ?? newValue.length);

              autoResizeTextarea();
            }}
            onKeyDown={(e) => {
              if (
                isTagDropdownOpen &&
                [
                  "ArrowDown",
                  "ArrowUp",
                  "ArrowLeft",
                  "ArrowRight",
                  "Enter",
                  "Escape",
                  "Tab",
                ].includes(e.key)
              ) {
                e.preventDefault();
                return;
              }

              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            onPaste={handlePaste}
            placeholder={`Message ${activeAgent?.name || "agent"}...`}
            className="flex-1 bg-secondary/50 border border-border rounded-lg px-3 py-2 md:px-4 md:py-3 focus:outline-none focus:border-primary/50 font-sans resize-none overflow-y-auto max-h-[200px] min-h-[40px] md:min-h-[46px] text-sm md:text-base"
            rows={1}
            autoFocus
            disabled={disabled}
          />

          {isTagDropdownOpen && (
            <ChatInputTagDropdown
              options={tagOptions}
              onSelect={handleSelectTagOption}
              onClose={handleCloseTagDropdown}
              isLoading={isTagLoading}
              inputRef={textareaRef}
            />
          )}

          <button
            onClick={handleButtonClick}
            disabled={
              Boolean(disabled) || (!isRunning && !value.trim() && attachments.length === 0)
            }
            className={`p-2.5 md:px-4 md:py-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0 ${
              isRunning
                ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                : "bg-primary text-primary-foreground hover:bg-primary/90"
            }`}
            title={isRunning ? "Stop generation" : "Send message"}
          >
            {isRunning ? <Square className="w-5 h-5" /> : <Send className="w-5 h-5" />}
          </button>
        </div>
      </div>
    </div>
  );
}
