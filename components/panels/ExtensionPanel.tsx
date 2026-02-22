"use client";

import { useMemo } from "react";
import { useExtensions } from "@/contexts/ExtensionContext";

interface ExtensionPanelProps {
  extensionName: string;
  panelId: string;
}

export function ExtensionPanel({ extensionName, panelId }: ExtensionPanelProps) {
  const { getExtension } = useExtensions();

  const extension = useMemo(() => getExtension(extensionName), [getExtension, extensionName]);

  const PanelComponent = extension?.hooks.panel?.[panelId];

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
    <div className="h-full overflow-auto bg-background text-foreground border-border">
      <PanelComponent extensionName={extensionName} panelId={panelId} />
    </div>
  );
}
