/**
 * AttachmentPreview Component
 * Displays preview of attached files with remove functionality
 */

import { X } from 'lucide-react';
import type { ChatAttachment } from '@/types';
import { formatFileSize, getFileIcon } from '@/lib/file-utils';

interface AttachmentPreviewProps {
  attachments: ChatAttachment[];
  onRemove: (index: number) => void;
}

export function AttachmentPreview({ attachments, onRemove }: AttachmentPreviewProps) {
  if (attachments.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 mb-2">
      {attachments.map((attachment, index) => (
        <div
          key={`${attachment.name}-${index}`}
          className="relative group bg-secondary/50 border border-border rounded-lg p-2 flex items-center gap-2 max-w-xs"
        >
          {/* Preview thumbnail for images */}
          {attachment.previewUrl ? (
            <img
              src={attachment.previewUrl}
              alt={attachment.name}
              className="w-12 h-12 object-cover rounded"
            />
          ) : (
            <div className="w-12 h-12 flex items-center justify-center text-2xl">
              {getFileIcon(attachment.mimeType)}
            </div>
          )}

          {/* File info */}
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate" title={attachment.name}>
              {attachment.name}
            </div>
            <div className="text-xs text-muted-foreground">
              {formatFileSize(attachment.size)}
            </div>
          </div>

          {/* Remove button */}
          <button
            onClick={() => onRemove(index)}
            className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/90"
            title="Remove attachment"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      ))}
    </div>
  );
}
