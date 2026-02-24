import { useState } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Wifi, WifiOff, Plus, Check, ChevronUp, Trash2, Globe } from "lucide-react";
import type { ConnectionStatus } from "@/types";

interface Gateway {
  id: string;
  name: string;
  url: string;
  isLocal?: boolean;
}

interface GatewaySwitcherProps {
  status: ConnectionStatus;
  gateways: Gateway[];
  activeId: string | null;
  onSwitch: (id: string) => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
}

export function GatewaySwitcher({
  status,
  gateways,
  activeId,
  onSwitch,
  onAdd,
  onRemove,
}: GatewaySwitcherProps) {
  const [open, setOpen] = useState(false);

  return (
    <DropdownMenu.Root open={open} onOpenChange={setOpen}>
      <DropdownMenu.Trigger asChild>
        <button
          className={`flex items-center gap-1.5 px-2 py-1 rounded hover:bg-accent transition-colors outline-none ${
            status === "connected"
              ? "text-primary"
              : status === "no-config"
                ? "text-muted-foreground"
                : "text-destructive"
          }`}
        >
          {status === "connected" ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
          <span className="font-medium">
            {status === "connected"
              ? "Connected"
              : status === "no-config"
                ? "No Gateway"
                : status === "pairing-required"
                  ? "Pairing Required"
                  : "Disconnected"}
          </span>
          <ChevronUp
            className={`w-3 h-3 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          />
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          sideOffset={8}
          align="end"
          className="z-[100] min-w-[220px] bg-popover border border-border p-1.5 rounded-xl shadow-xl animate-in fade-in slide-in-from-bottom-2 duration-200"
        >
          <DropdownMenu.Label className="px-2 py-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Gateways
          </DropdownMenu.Label>

          {status === "pairing-required" && (
            <div className="mx-2 mb-2 p-2 rounded-lg border border-destructive/30 bg-destructive/10 text-[10px] leading-relaxed text-destructive">
              Pairing approval needed in Gateway before this client can connect.
            </div>
          )}

          <div className="max-h-[300px] overflow-y-auto space-y-0.5">
            {gateways.map((gateway) => (
              <div key={gateway.id} className="flex items-center gap-1">
                <DropdownMenu.Item
                  onSelect={() => onSwitch(gateway.id)}
                  className="flex-1 flex items-center gap-2 px-2 py-2 text-xs rounded-lg outline-none focus:bg-accent cursor-pointer transition-colors"
                >
                  <Globe
                    className={`w-3.5 h-3.5 ${gateway.id === activeId ? "text-primary" : "text-muted-foreground"}`}
                  />
                  <div className="flex flex-col">
                    <span className="font-bold">{gateway.name}</span>
                    <span className="text-[10px] opacity-50 truncate max-w-[140px]">
                      {gateway.url}
                    </span>
                  </div>
                  {gateway.id === activeId && (
                    <Check className="w-3.5 h-3.5 ml-auto text-primary" />
                  )}
                </DropdownMenu.Item>

                {!gateway.isLocal && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemove(gateway.id);
                    }}
                    className="p-2 hover:bg-destructive/10 hover:text-destructive rounded-lg transition-colors group"
                  >
                    <Trash2 className="w-3.5 h-3.5 opacity-50 group-hover:opacity-100" />
                  </button>
                )}
              </div>
            ))}
          </div>

          <DropdownMenu.Separator className="h-px bg-border my-1.5" />

          <DropdownMenu.Item
            onSelect={onAdd}
            className="flex items-center gap-2 px-2 py-2 text-xs rounded-lg outline-none focus:bg-accent cursor-pointer transition-colors text-primary font-bold"
          >
            <Plus className="w-3.5 h-3.5" />
            Connect Remote Gateway
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
