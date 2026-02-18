"use client";

import { useEffect, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { AlertTriangle, Info, AlertCircle, Loader2 } from 'lucide-react';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
  loading?: boolean;
}

const variantStyles = {
  danger: {
    icon: AlertCircle,
    iconColor: 'text-red-500',
    buttonBg: 'bg-red-500 hover:bg-red-600',
  },
  warning: {
    icon: AlertTriangle,
    iconColor: 'text-yellow-500',
    buttonBg: 'bg-yellow-500 hover:bg-yellow-600',
  },
  info: {
    icon: Info,
    iconColor: 'text-blue-500',
    buttonBg: 'bg-blue-500 hover:bg-blue-600',
  },
};

export function ConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'info',
  loading: externalLoading = false,
}: ConfirmationModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const variantConfig = variantStyles[variant];
  const Icon = variantConfig.icon;
  const isProcessing = isLoading || externalLoading;

  // Reset loading state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setIsLoading(false);
    }
  }, [isOpen]);

  const handleConfirm = async () => {
    setIsLoading(true);
    try {
      const result = onConfirm();
      if (result instanceof Promise) {
        await result;
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isProcessing) {
      e.preventDefault();
      handleConfirm();
    }
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && !isProcessing && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 animate-in fade-in" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md bg-background border border-border rounded-lg shadow-lg p-6 animate-in fade-in zoom-in-95"
          onKeyDown={handleKeyDown}
          onPointerDownOutside={(e) => isProcessing && e.preventDefault()}
          onEscapeKeyDown={(e) => isProcessing && e.preventDefault()}
        >
          <div className="flex items-start gap-4">
            <div className={`flex-shrink-0 ${variantConfig.iconColor}`}>
              <Icon className="w-6 h-6" />
            </div>
            <div className="flex-1 min-w-0">
              <Dialog.Title className="text-lg font-semibold text-foreground mb-2">
                {title}
              </Dialog.Title>
              <Dialog.Description className="text-sm text-muted-foreground mb-6">
                {message}
              </Dialog.Description>
              <div className="flex items-center justify-end gap-3">
                <button
                  onClick={onClose}
                  disabled={isProcessing}
                  className="px-4 py-2 text-sm font-medium text-foreground bg-muted hover:bg-muted/80 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  type="button"
                >
                  {cancelText}
                </button>
                <button
                  onClick={handleConfirm}
                  disabled={isProcessing}
                  className={`px-4 py-2 text-sm font-medium text-white ${variantConfig.buttonBg} rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2`}
                  type="button"
                >
                  {isProcessing && <Loader2 className="w-4 h-4 animate-spin" />}
                  {confirmText}
                </button>
              </div>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
