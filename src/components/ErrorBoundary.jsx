import { Component } from 'react';

/**
 * Reusable React error boundary.
 *
 * Props:
 *   label     {string}   - Section name shown in fallback UI (e.g. "Investments")
 *   fallback  {function} - Optional render prop: ({ error, reset }) => ReactNode
 *   children  {ReactNode}
 *
 * Usage:
 *   <ErrorBoundary key={tab} label="Investments">
 *     <InvestmentHoldings />
 *   </ErrorBoundary>
 *
 * Pass key={tab} so the boundary auto-resets when the user navigates away.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
    this.reset = this.reset.bind(this);
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', this.props.label || '', error, info.componentStack);
  }

  reset() {
    this.setState({ hasError: false, error: null });
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback({ error: this.state.error, reset: this.reset });
      }
      return (
        <div className="error-boundary-fallback">
          <div className="ebf-icon">⚠</div>
          <div className="ebf-title">
            {this.props.label ? `${this.props.label} failed to load` : 'Something went wrong'}
          </div>
          <div className="ebf-msg">
            {this.state.error?.message || 'An unexpected error occurred in this section.'}
          </div>
          <button className="btn-ghost small" onClick={this.reset}>Try again</button>
        </div>
      );
    }
    return this.props.children;
  }
}
