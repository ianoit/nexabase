import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({ error, errorInfo });
  }

  public handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  public handleReloadPage = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary-container">
          <div className="error-boundary-card">
            <div className="error-boundary-header">
              <AlertTriangle className="error-boundary-icon" size={28} />
              <div>
                <h3>{this.props.fallbackTitle || 'An unexpected error occurred'}</h3>
                <p className="error-boundary-subtitle">
                  The interface encountered a problem and could not render this section.
                </p>
              </div>
            </div>

            {this.state.error && (
              <div className="error-boundary-details">
                <div className="error-boundary-msg">
                  {this.state.error.name}: {this.state.error.message}
                </div>
                {this.state.error.stack && (
                  <pre className="error-boundary-stack">
                    {this.state.error.stack.split('\n').slice(0, 5).join('\n')}
                  </pre>
                )}
              </div>
            )}

            <div className="error-boundary-actions">
              <button 
                type="button" 
                className="btn primary"
                onClick={this.handleReset}
              >
                <RefreshCw size={13} />
                <span>Try Again</span>
              </button>
              <button 
                type="button" 
                className="btn secondary"
                onClick={this.handleReloadPage}
              >
                <span>Reload Window</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
