import React from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import logger from "@/lib/logger";

interface TotpBroadcastPictureBoundaryProps {
  children: React.ReactNode;
  resetKey: string;
  programmeLabel?: string;
}

interface TotpBroadcastPictureBoundaryState {
  error: Error | null;
}

export class TotpBroadcastPictureBoundary extends React.Component<
  TotpBroadcastPictureBoundaryProps,
  TotpBroadcastPictureBoundaryState
> {
  state: TotpBroadcastPictureBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): TotpBroadcastPictureBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    logger.error("Top of the Pops picture renderer stopped safely", {
      message: error.message,
      componentStack: info.componentStack,
      resetKey: this.props.resetKey,
    });
  }

  componentDidUpdate(previousProps: TotpBroadcastPictureBoundaryProps) {
    if (this.state.error && previousProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  private retry = () => this.setState({ error: null });

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div
        className="absolute inset-0 flex items-center justify-center overflow-hidden bg-slate-950 text-white"
        data-totp-picture-recovery
        role="status"
        aria-live="polite"
      >
        <div className="absolute inset-0 opacity-30 [background-image:radial-gradient(circle_at_30%_30%,rgba(34,211,238,.3),transparent_30%),radial-gradient(circle_at_70%_70%,rgba(217,70,239,.3),transparent_34%)]" />
        <div className="relative mx-auto max-w-lg px-6 text-center">
          <AlertTriangle className="mx-auto h-8 w-8 text-amber-300" />
          <p className="mt-3 text-xs font-black uppercase tracking-[0.24em] text-cyan-200">
            {this.props.programmeLabel ?? "Top of the Pops"}
          </p>
          <h3 className="mt-2 text-xl font-black">Studio picture temporarily unavailable</h3>
          <p className="mt-2 text-sm leading-6 text-white/70">
            Audio, captions and programme graphics are continuing while the 3D studio picture recovers.
          </p>
          <Button size="sm" variant="secondary" className="mt-4" onClick={this.retry}>
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Retry picture
          </Button>
        </div>
      </div>
    );
  }
}

export default TotpBroadcastPictureBoundary;
