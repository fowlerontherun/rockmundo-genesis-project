import React from "react";
import { GigViewerFallback } from "./GigViewerFallback";
import logger from "@/lib/logger";
import { normalizeGigExperienceFailure } from "../diagnostics";

interface GigViewerErrorBoundaryProps {
  children: React.ReactNode;
  onResult?: () => void;
  onClose?: () => void;
  resetKey?: string;
}

export class GigViewerErrorBoundary extends React.Component<GigViewerErrorBoundaryProps, { error: unknown | null }> {
  state: { error: unknown | null } = { error: null };

  static getDerivedStateFromError(error: unknown) {
    return { error };
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo) {
    const failure = normalizeGigExperienceFailure(
      this.props.resetKey ?? "viewer",
      "renderer",
      "React gig viewer error boundary",
      error,
    );
    logger.error("Gig viewer renderer stopped safely", {
      ...failure,
      componentStack: info.componentStack,
    });
  }

  componentDidUpdate(previousProps: GigViewerErrorBoundaryProps) {
    if (this.state.error && previousProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  private retry = () => this.setState({ error: null });

  render() {
    if (this.state.error) {
      const failure = normalizeGigExperienceFailure(
        this.props.resetKey ?? "viewer",
        "renderer",
        "React gig viewer error boundary",
        this.state.error,
      );
      return (
        <GigViewerFallback
          title="Viewer failed"
          body="The stage viewer stopped safely. Retry it, or use the report once an authoritative result is ready."
          diagnosticReference={failure.reference}
          onRetry={this.retry}
          onResult={this.props.onResult}
          onClose={this.props.onClose}
        />
      );
    }
    return this.props.children;
  }
}
