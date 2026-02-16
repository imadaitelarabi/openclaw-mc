/**
 * File Upload Utilities
 * Helper functions for processing and validating file attachments
 */

import type { ChatAttachment, AttachmentConfig } from '@/types';

/**
 * Convert a File to a ChatAttachment with base64 encoding
 */
export async function fileToAttachment(file: File): Promise<ChatAttachment> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      const dataUri = e.target?.result as string;
      
      // Create preview URL for images
      const previewUrl = file.type.startsWith('image/') 
        ? URL.createObjectURL(file) 
        : undefined;
      
      const attachment: ChatAttachment = {
        name: file.name,
        mimeType: file.type || 'application/octet-stream',
        size: file.size,
        media: dataUri,
        previewUrl,
        uploadStatus: 'success',
      };
      
      resolve(attachment);
    };
    
    reader.onerror = () => {
      reject(new Error(`Failed to read file: ${file.name}`));
    };
    
    reader.readAsDataURL(file);
  });
}

/**
 * Validate file against configuration
 */
export function validateFile(
  file: File,
  config: AttachmentConfig
): { valid: boolean; error?: string } {
  // Check file size
  const maxSizeBytes = config.maxSizeMb * 1024 * 1024;
  if (file.size > maxSizeBytes) {
    return {
      valid: false,
      error: `File size exceeds ${config.maxSizeMb}MB limit`,
    };
  }
  
  // Check file type if allowedTypes is specified
  if (config.allowedTypes && config.allowedTypes.length > 0) {
    const isAllowed = config.allowedTypes.some(type => {
      // Support both MIME types and extensions
      if (type.startsWith('.')) {
        return file.name.toLowerCase().endsWith(type.toLowerCase());
      }
      return file.type.match(new RegExp(type.replace('*', '.*')));
    });
    
    if (!isAllowed) {
      return {
        valid: false,
        error: `File type not allowed: ${file.type || 'unknown'}`,
      };
    }
  }
  
  return { valid: true };
}

/**
 * Convert clipboard items to files
 */
export function getFilesFromClipboard(clipboardData: DataTransfer): File[] {
  const files: File[] = [];
  
  if (clipboardData.items) {
    // Use DataTransferItemList interface
    for (let i = 0; i < clipboardData.items.length; i++) {
      const item = clipboardData.items[i];
      if (item.kind === 'file') {
        const file = item.getAsFile();
        if (file) {
          files.push(file);
        }
      }
    }
  } else if (clipboardData.files) {
    // Fallback to DataTransferFileList
    for (let i = 0; i < clipboardData.files.length; i++) {
      files.push(clipboardData.files[i]);
    }
  }
  
  return files;
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Get file icon based on MIME type
 */
export function getFileIcon(mimeType: string): string {
  if (mimeType.startsWith('image/')) return '🖼️';
  if (mimeType.startsWith('video/')) return '🎥';
  if (mimeType.startsWith('audio/')) return '🎵';
  if (mimeType.includes('pdf')) return '📄';
  if (mimeType.includes('zip') || mimeType.includes('compressed')) return '📦';
  if (mimeType.includes('text')) return '📝';
  return '📎';
}

/**
 * Clean up preview URLs to prevent memory leaks
 */
export function revokePreviewUrls(attachments: ChatAttachment[]): void {
  attachments.forEach(attachment => {
    if (attachment.previewUrl) {
      URL.revokeObjectURL(attachment.previewUrl);
    }
  });
}
