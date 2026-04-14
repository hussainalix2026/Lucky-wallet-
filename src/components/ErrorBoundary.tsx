import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-zinc-50 p-6 text-center">
          <div className="bg-white p-8 rounded-3xl shadow-xl border border-zinc-200 max-w-xs">
            <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-zinc-900 mb-2">Something went wrong</h2>
            <p className="text-zinc-500 text-sm mb-6">
              An unexpected error occurred. Please try refreshing the page.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="w-full bg-emerald-500 text-white py-3 rounded-2xl font-bold hover:bg-emerald-600 transition-colors shadow-lg shadow-emerald-200"
            >
              Reload App
            </button>
            {this.state.error && (
              <pre className="mt-6 p-4 bg-zinc-100 rounded-xl text-[10px] overflow-auto text-zinc-500 max-h-32 text-left">
                {this.state.error.message}
              </pre>
            )}
          </div>
        </div>
      );
    }

    return (this as any).props.children;
  }
}
