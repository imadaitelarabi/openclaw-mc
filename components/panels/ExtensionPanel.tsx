"use client";

import { useExtensions } from "@/contexts/ExtensionContext";
import { ExtensionModalProvider } from "@/contexts/ExtensionModalContext";

interface ExtensionPanelProps {
  extensionName: string;
  panelId: string;
  contextPanelId?: string;
}

export function ExtensionPanel({ extensionName, panelId, contextPanelId }: ExtensionPanelProps) {
  const { getExtension } = useExtensions();

  const extension = getExtension(extensionName);

  const PanelComponent = extension?.hooks.panel?.[panelId];
  const modalMap = extension?.hooks.modal;

  if (!extension) {
    return (
      <div className="h-full flex items-center justify-center p-6 text-sm text-muted-foreground">
        Extension not found: {extensionName}
      </div>
    );
  }

  if (!PanelComponent) {
    return (
      <div className="h-full flex items-center justify-center p-6 text-sm text-muted-foreground">
        Panel not found: {panelId}
      </div>
    );
  }

  return (
    <ExtensionModalProvider extensionName={extensionName} modals={modalMap}>
      <div className="h-full overflow-auto bg-background text-foreground border-border">
        <PanelComponent
          extensionName={extensionName}
          panelId={panelId}
          contextPanelId={contextPanelId}
        />
      </div>
    </ExtensionModalProvider>
  );
}
