/**
 * Chat Attachment Types
 * Types for file/image attachments in chat messages
 */

export interface ChatAttachment {
  // File metadata
  name: string;
  mimeType: string;
  size: number;
  
  // File content (base64 encoded data URI)
  media: string;
  
  // Preview URL for images (object URL)
  previewUrl?: string;
  
  // Upload status
  uploadStatus?: 'pending' | 'uploading' | 'success' | 'error';
  error?: string;
}

// Configuration for attachment validation
export interface AttachmentConfig {
  maxSizeMb: number;
  allowedTypes?: string[]; // MIME types or extensions
}

// Default configuration
export const DEFAULT_ATTACHMENT_CONFIG: AttachmentConfig = {
  maxSizeMb: 10, // 10MB default (safe for WebSocket frames)
  allowedTypes: ['image/*'], // Only images allowed
};
