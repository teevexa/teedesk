import React, { Component, ErrorInfo, ReactNode } from 'react';
import { ErrorHandler } from './ErrorHandler';

interface Props {
  children: ReactNode;
  title?: string;
}

interface State {
  error: Error | null;
}

/**
 * A narrower-scoped sibling to ErrorBoundary — catches errors within one
 * dashboard section (e.g. Analytics) without unmounting the whole app shell
 * (nav, other tabs stay usable). The top-level ErrorBoundary in App.tsx
 * still catches anything above/outside these boundaries.
 */
export class SectionErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Section error:', error, errorInfo);
  }

  reset = () => this.setState({ error: null });

  render() {
    if (this.state.error) {
      return <ErrorHandler error={this.state.error} resetError={this.reset} title={this.props.title} />;
    }
    return this.props.children;
  }
}
