import { Send, Square, Paperclip } from 'lucide-react';
import { useRef, useEffect, useState } from 'react';
import type { Agent, ChatAttachment } from '@/types';
import { DEFAULT_ATTACHMENT_CONFIG } from '@/types/attachment';
import { AttachmentPreview } from './AttachmentPreview';
import { 
  fileToAttachment, 
  validateFile, 
  getFilesFromClipboard,
  revokePreviewUrls,
} from '@/lib/file-utils';
import { useToast } from '@/hooks/useToast';

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: (attachments?: ChatAttachment[]) => void;
  activeAgent?: Agent;
  disabled?: boolean;
  isRunning?: boolean;
  onAbort?: () => void;
}

export function ChatInput({ value, onChange, onSend, activeAgent, disabled, isRunning, onAbort }: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const attachmentsRef = useRef<ChatAttachment[]>([]);
  const [attachments, setAttachments] = useState<ChatAttachment[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const { toast } = useToast();

  // Reset height when value is empty
  useEffect(() => {
    if (!value && textareaRef.current) {
      textareaRef.current.style.height = 'auto';
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

  const handleSend = () => {
    onSend(attachments.length > 0 ? attachments : undefined);
    // Clear attachments after sending
    revokePreviewUrls(attachments);
    setAttachments([]);
    // Reset height after sending
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
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
          title: 'Invalid file',
          description: validation.error,
          variant: 'destructive',
        });
        continue;
      }

      try {
        const attachment = await fileToAttachment(file);
        setAttachments(prev => [...prev, attachment]);
        toast({
          title: 'File attached',
          description: file.name,
          variant: 'success',
        });
      } catch (error) {
        toast({
          title: 'Failed to attach file',
          description: (error as Error).message,
          variant: 'destructive',
        });
      }
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      processFiles(files);
    }
    // Reset input so same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
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
    setAttachments(prev => {
      const removed = prev[index];
      if (removed.previewUrl) {
        URL.revokeObjectURL(removed.previewUrl);
      }
      return prev.filter((_, i) => i !== index);
    });
  };

  return (
    <div className="p-3 md:p-4 border-t border-border bg-background/50 backdrop-blur">
      <div className="max-w-4xl mx-auto">
        {/* Attachment Preview */}
        <AttachmentPreview
          attachments={attachments}
          onRemove={handleRemoveAttachment}
        />

        {/* Input Container */}
        <div 
          className={`flex gap-2 md:gap-3 items-end ${isDragging ? 'ring-2 ring-primary rounded-lg' : ''}`}
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
            onPaste={handlePaste}
            placeholder={`Message ${activeAgent?.name || 'agent'}...`}
            className="flex-1 bg-secondary/50 border border-border rounded-lg px-3 py-2 md:px-4 md:py-3 focus:outline-none focus:border-primary/50 font-sans resize-none overflow-y-auto max-h-[200px] min-h-[40px] md:min-h-[46px] text-sm md:text-base"
            rows={1}
            autoFocus
            disabled={disabled}
          />
          <button
            onClick={handleButtonClick}
            disabled={Boolean(disabled) || (!isRunning && !value.trim() && attachments.length === 0)}
            className="bg-primary text-primary-foreground p-2.5 md:px-4 md:py-3 rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
            title={isRunning ? 'Stop generation' : 'Send message'}
          >
            {isRunning ? <Square className="w-5 h-5" /> : <Send className="w-5 h-5" />}
          </button>
        </div>
      </div>
    </div>
  );
}
