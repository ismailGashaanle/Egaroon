import { Component } from 'react';
import Logo from './Logo';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('E-Garoon render error:', error, info);
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null });
    window.location.assign('/');
  };

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    this.props.onReset?.();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    if (this.props.fallback) {
      if (typeof this.props.fallback === 'function') {
        return this.props.fallback({
          error: this.state.error,
          reset: this.handleReset,
        });
      }
      return this.props.fallback;
    }

    const message = this.state.error?.message;

    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-warmwhite px-4 text-center dark:bg-dark-bg">
        <Logo showWordmark={false} size="lg" />
        <h1 className="mt-6 font-display text-2xl font-bold text-charcoal dark:text-dark-text">
          Something went offside
        </h1>
        <p className="mt-2 max-w-sm text-sm text-muted dark:text-dark-muted">
          E-Garoon hit an unexpected error. Reload to get back on the pitch.
        </p>
        {import.meta.env.DEV && message ? (
          <pre className="mt-4 max-w-lg overflow-auto rounded-xl bg-charcoal/5 p-3 text-left text-xs text-status-cancelled-text dark:bg-white/5">
            {message}
          </pre>
        ) : null}
        <button
          type="button"
          onClick={this.handleReload}
          className="mt-6 rounded-xl bg-forest px-5 py-2.5 text-sm font-semibold text-white shadow-soft hover:bg-forest-dark"
        >
          Back home
        </button>
      </div>
    );
  }
}
