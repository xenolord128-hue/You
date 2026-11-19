import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error?.message || 'An unexpected error occurred.',
    };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#F5F5F5] text-[#0A0A0A] flex items-center justify-center p-6">
          <div className="max-w-md w-full rounded-3xl border border-[#D9D9D9] bg-white p-8 text-center space-y-4 navy-shadow">
            <p className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-[#808080]">
              PYTHOX WORLD
            </p>
            <h1 className="font-editorial text-2xl font-bold text-[#0A0A0A]">
              Something went wrong
            </h1>
            <p className="text-xs text-[#808080] leading-relaxed">
              We encountered a temporary display issue. Refresh the page or return to the storefront.
            </p>
            <button
              type="button"
              onClick={() => window.location.assign('/')}
              className="px-6 py-3 rounded-full bg-[#0A0A0A] text-white text-xs font-semibold uppercase tracking-[0.14em] hover:bg-[#292929] cursor-pointer"
            >
              Return Home
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
