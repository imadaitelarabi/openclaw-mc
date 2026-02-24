import { ShieldAlert, Settings } from "lucide-react";

interface PairingRequiredProps {
  message?: string | null;
  onOpenGatewaySetup: () => void;
}

export function PairingRequired({ message, onOpenGatewaySetup }: PairingRequiredProps) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 bg-background relative overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-destructive/5 rounded-full blur-3xl -z-10" />

      <div className="w-full max-w-xl space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-destructive/10 mb-4">
            <ShieldAlert className="w-8 h-8 text-destructive" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Gateway Pairing Required</h1>
          <p className="text-muted-foreground">
            Approve this device in Gateway, then reconnect from setup.
          </p>
        </div>

        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive leading-relaxed">
          {message ||
            "Pairing required. Open your gateway host and approve the pending pairing request for this device."}
        </div>

        <div className="rounded-xl border border-border bg-secondary/30 p-4 space-y-2">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Gateway host commands
          </p>
          <pre className="text-xs leading-relaxed overflow-x-auto bg-background/60 rounded-lg p-3">
            {`openclaw devices list
openclaw devices approve <request-id>`}
          </pre>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Run these on the gateway server, approve the pending request ID, then return here and
            reconnect.
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <button
            onClick={onOpenGatewaySetup}
            className="w-full bg-primary text-primary-foreground font-bold py-4 rounded-xl flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition-all"
          >
            <Settings className="w-5 h-5" />
            Go to Gateway Setup
          </button>
        </div>
      </div>
    </div>
  );
}
