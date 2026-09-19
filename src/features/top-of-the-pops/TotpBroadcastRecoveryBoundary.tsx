import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RefreshCw, Tv2 } from "lucide-react";

export interface TotpBroadcastRecoveryBoundaryProps {
  resetKey: string;
  bandName: string;
  songTitle: string;
  chartRank?: number | null;
  presenterName?: string | null;
  presenterText?: string | null;
  children: ReactNode;
}

interface TotpBroadcastRecoveryBoundaryState {
  failed: boolean;
  detail: string | null;
}

/**
 * Local recovery boundary for the television picture.
 *
 * A WebGL/Three.js failure must never take the whole Top of the Pops page down.
 * Audio, controls and programme timing live outside this boundary, so the
 * viewer can continue with a stable branded fallback frame.
 */
export class TotpBroadcastRecoveryBoundary extends Component<
  TotpBroadcastRecoveryBoundaryProps,
  TotpBroadcastRecoveryBoundaryState
> {
  state: TotpBroadcastRecoveryBoundaryState = { failed: false, detail: null };

  static getDerivedStateFromError(error: unknown): TotpBroadcastRecoveryBoundaryState {
    return {
      failed: true,
      detail: error instanceof Error ? error.message : "Unknown 3D renderer error",
    };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error("[TOTP] 3D broadcast picture failed; using recovery frame", error, info.componentStack);
  }

  componentDidUpdate(previous: TotpBroadcastRecoveryBoundaryProps) {
    if (previous.resetKey !== this.props.resetKey && this.state.failed) {
      this.setState({ failed: false, detail: null });
    }
  }

  private retry = () => {
    this.setState({ failed: false, detail: null });
  };

  render() {
    if (!this.state.failed) return this.props.children;

    const { bandName, songTitle, chartRank, presenterName, presenterText } = this.props;
    return (
      <div
        className="relative flex h-full min-h-[20rem] w-full items-center justify-center overflow-hidden bg-slate-950 text-white"
        data-totp-broadcast-recovery
        role="status"
        aria-live="polite"
      >
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_38%,rgba(217,70,239,.22),transparent_38%),linear-gradient(135deg,rgba(8,145,178,.16),transparent_45%)]" />
        <div className="pointer-events-none absolute inset-0 opacity-[0.06] [background-image:repeating-linear-gradient(0deg,transparent_0,transparent_3px,rgba(255,255,255,.3)_4px)]" />
        <div className="relative z-10 w-[min(54rem,88%)] text-center">
          <div className="mx-auto mb-5 flex w-fit items-center gap-2 border-l-4 border-cyan-300 bg-fuchsia-700/90 px-4 py-2 text-xs font-black tracking-[0.18em] shadow-lg">
            <Tv2 className="h-4 w-4" /> TOP OF THE POPS · ROCKMUNDO TV
          </div>
          <p className="text-[10px] font-black uppercase tracking-[0.28em] text-cyan-200">
            Studio picture temporarily unavailable
          </p>
          <h2 className="mt-3 text-3xl font-black uppercase tracking-tight sm:text-5xl">{bandName}</h2>
          <p className="mt-2 text-lg font-semibold text-white/80 sm:text-2xl">“{songTitle}”</p>
          {Number.isFinite(Number(chartRank)) ? (
            <p className="mt-3 text-sm font-black tracking-[0.18em] text-fuchsia-200">UK CHART #{chartRank}</p>
          ) : null}
          {presenterText ? (
            <p className="mx-auto mt-6 max-w-2xl border-t border-white/20 pt-4 text-sm leading-relaxed text-white/85 sm:text-base">
              <span className="mr-2 font-black uppercase tracking-wide text-cyan-200">{presenterName || "Presenter"}:</span>
              {presenterText}
            </p>
          ) : (
            <p className="mx-auto mt-6 max-w-xl text-sm text-white/70">
              The programme is continuing with audio and broadcast graphics while the studio picture recovers.
            </p>
          )}
          <button
            type="button"
            className="mt-6 inline-flex items-center gap-2 rounded-md border border-white/25 bg-white/10 px-4 py-2 text-xs font-semibold hover:bg-white/15 focus:outline-none focus:ring-2 focus:ring-cyan-300"
            onClick={this.retry}
            data-totp-broadcast-retry
          >
            <RefreshCw className="h-4 w-4" /> Retry studio picture
          </button>
          <div className="mt-4 flex items-center justify-center gap-2 text-[10px] uppercase tracking-[0.15em] text-white/45">
            <AlertTriangle className="h-3 w-3" /> Audio and programme timing are unaffected
          </div>
        </div>
        <span className="sr-only" data-totp-broadcast-error>{this.state.detail}</span>
      </div>
    );
  }
}

export default TotpBroadcastRecoveryBoundary;
