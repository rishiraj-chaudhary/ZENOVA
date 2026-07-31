import { Component } from "react";

/**
 * Catches render errors so one broken component does not blank the whole app.
 *
 * Class component by necessity: React has no hook equivalent of
 * componentDidCatch. `resetKey` lets a route change clear a stuck error, so a
 * user is never trapped on the fallback.
 */
class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, errorInfo) {
    // Replace with Sentry.captureException once error tracking is wired up.
    console.error("Render error:", error, errorInfo.componentStack);
  }

  componentDidUpdate(prevProps) {
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  render() {
    const { error } = this.state;
    const { children, fallback, label = "this section" } = this.props;

    if (!error) return children;
    if (fallback) return fallback(error, () => this.setState({ error: null }));

    return (
      <div
        role="alert"
        className="mx-auto my-8 max-w-md rounded-2xl border border-red-500/30 bg-red-950/20 p-6 text-center"
      >
        <i
          className="fa-solid fa-triangle-exclamation mb-3 text-2xl text-red-400"
          aria-hidden="true"
        />
        <h2 className="text-lg font-semibold text-white">Something went wrong</h2>
        <p className="mt-2 text-sm text-gray-400">
          We couldn&apos;t display {label}. The rest of the app still works.
        </p>

        <div className="mt-5 flex justify-center gap-3">
          <button
            type="button"
            onClick={() => this.setState({ error: null })}
            className="rounded-xl bg-white/10 px-4 py-2 text-sm text-white transition-colors hover:bg-white/20"
          >
            Try again
          </button>
          <button
            type="button"
            onClick={() => window.location.assign("/")}
            className="rounded-xl bg-indigo-500 px-4 py-2 text-sm text-white transition-colors hover:bg-indigo-400"
          >
            Go home
          </button>
        </div>

        {import.meta.env.DEV && (
          <pre className="mt-4 overflow-x-auto rounded-lg bg-black/40 p-3 text-left text-xs text-red-300">
            {error.message}
          </pre>
        )}
      </div>
    );
  }
}

export default ErrorBoundary;
