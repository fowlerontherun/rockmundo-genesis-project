import React from "react";
import { GigViewerFallback } from "./GigViewerFallback";

interface GigViewerErrorBoundaryProps {
  children: React.ReactNode;
  onResult?: () => void;
  onClose?: () => void;
  resetKey?: string;
}

export class GigViewerErrorBoundary extends React.Component<GigViewerErrorBoundaryProps, { error: boolean }> {
  state = { error: false };

  static getDerivedStateFromError() {
    return { error: true };
  }

  componentDidCatch(error: unknown) {
    console.error("[gig-viewer] renderer failure", error);
  }

  componentDidUpdate(previousProps: GigViewerErrorBoundaryProps) {
    if (this.state.error && previousProps.resetKey !== this.props.resetKey) {
      this.setState({ error: false });
    }
  }

  private retry = () => this.setState({ error: false });

  render() {
    if (this.state.error) {
      return (
        <GigViewerFallback
          title="Viewer failed"
          body="The stage viewer stopped safely. Retry it, or use the report once an authoritative result is ready."
          onRetry={this.retry}
          onResult={this.props.onResult}
          onClose={this.props.onClose}
        />
      );
    }
    return this.props.children;
  }
}
