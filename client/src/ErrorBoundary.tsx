import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Catches React render errors and shows a fallback instead of a blank screen.
 * Helps diagnose client-side crashes when the app fails to load.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Traceability Explorer error:', error, info);
  }

  render(): ReactNode {
    if (this.state.hasError && this.state.error) {
      return (
        <div
          className="flex min-h-screen flex-col items-center justify-center gap-4 bg-domino-bg p-8 font-sans"
          role="alert"
        >
          <h1 className="text-xl font-semibold text-domino-error">
            Something went wrong
          </h1>
          <p className="max-w-lg text-center text-domino-text-body">
            {this.state.error.message}
          </p>
          <details className="max-w-2xl overflow-auto rounded border border-domino-border bg-domino-container p-4 text-left text-sm text-domino-text-body">
            <summary className="cursor-pointer font-medium">
              Technical details
            </summary>
            <pre className="mt-2 whitespace-pre-wrap break-words">
              {this.state.error.stack}
            </pre>
          </details>
          <button
            type="button"
            onClick={() => this.setState({ hasError: false, error: null })}
            className="rounded border border-domino-primary bg-domino-primary px-4 py-2 text-white hover:opacity-90"
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
