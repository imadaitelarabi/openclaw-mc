import { ShieldAlert, Settings, ExternalLink } from "lucide-react";

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

        <div className="flex flex-col gap-3">
          <button
            onClick={onOpenGatewaySetup}
            className="w-full bg-primary text-primary-foreground font-bold py-4 rounded-xl flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition-all"
          >
            <Settings className="w-5 h-5" />
            Go to Gateway Setup
          </button>

          <a
            href="https://docs.openclaw.ai/gateway/protocol#device-identity-pairing"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full border border-border text-foreground font-bold py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-secondary transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
            Pairing approval docs
          </a>
        </div>
      </div>
    </div>
  );
}