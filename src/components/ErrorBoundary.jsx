import { Component } from 'react';

export class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('RouteReel crashed:', error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="crash">
        <div className="crash-card">
          <h2>Something went wrong</h2>
          <p>{this.state.error.message || 'An unexpected error occurred.'}</p>
          <p className="hint">Your project is saved, so reloading won't lose your route or settings.</p>
          <button className="btn primary wide" onClick={() => window.location.reload()}>Reload</button>
        </div>
      </div>
    );
  }
}
