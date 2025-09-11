import React from 'react';
import { processErrorBoundaryError, ERROR_SEVERITY } from '../utils/errorHandling.jsx';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { 
      hasError: false, 
      error: null, 
      errorInfo: null, 
      processedError: null,
      retryCount: 0
    };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Process error with standardized error handling
    const processedError = processErrorBoundaryError(error, errorInfo);
    
    // Store both original and processed error information
    this.setState({
      error: error,
      errorInfo: errorInfo,
      processedError: processedError
    });

    // Call onError callback if provided for custom error reporting
    if (this.props.onError) {
      this.props.onError(processedError);
    }
  }

  componentDidUpdate(prevProps) {
    // Reset error state when children change after a manual reset attempt
    // This helps with cases where parent components re-render with new children
    // Only reset if we manually clicked "Try Again" (retryCount > 0) and props changed
    if (
      this.state.hasError && 
      this.state.retryCount > 0 && 
      prevProps.children !== this.props.children
    ) {
      this.setState({
        hasError: false,
        error: null,
        errorInfo: null,
        processedError: null
      });
    }
  }

  render() {
    if (this.state.hasError) {
      // Fallback UI
      return (
        <div className='flex flex-col items-center justify-center p-8 text-center'>
          <div className='bg-red-50 border border-red-200 rounded-lg p-6 max-w-md'>
            <div className='flex items-center mb-4'>
              <div className='flex-shrink-0'>
                <svg className='h-5 w-5 text-red-400' viewBox='0 0 20 20' fill='currentColor'>
                  <path
                    fillRule='evenodd'
                    d='M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z'
                    clipRule='evenodd'
                  />
                </svg>
              </div>
              <h3 className='ml-3 text-sm font-medium text-red-800'>Something went wrong</h3>
            </div>
            <div className='text-sm text-red-700'>
              {/* Show user-friendly message from standardized error handling */}
              <p className='mb-2'>
                {this.state.processedError?.userMessage || 'An error occurred while loading the interface.'}
              </p>
              
              {/* Show error ID for tracking */}
              {this.state.processedError?.id && (
                <p className='text-xs text-red-600 mb-2 font-mono'>
                  Error ID: {this.state.processedError.id}
                </p>
              )}
              
              {/* Show severity indicator */}
              {this.state.processedError?.severity && (
                <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium mb-2 ${
                  this.state.processedError.severity === ERROR_SEVERITY.CRITICAL ? 'bg-red-200 text-red-800' :
                  this.state.processedError.severity === ERROR_SEVERITY.HIGH ? 'bg-orange-200 text-orange-800' :
                  'bg-yellow-200 text-yellow-800'
                }`}>
                  {this.state.processedError.severity.toUpperCase()} ERROR
                </div>
              )}
              
              {this.props.showDetails && this.state.error && (
                <details className='mt-4'>
                  <summary className='cursor-pointer text-xs font-mono'>Technical Details</summary>
                  <div className='mt-2 text-xs bg-red-100 p-2 rounded overflow-auto max-h-40'>
                    <div className='mb-2'>
                      <strong>Error:</strong> {this.state.error.toString()}
                    </div>
                    {this.state.processedError?.category && (
                      <div className='mb-2'>
                        <strong>Category:</strong> {this.state.processedError.category}
                      </div>
                    )}
                    {this.state.processedError?.timestamp && (
                      <div className='mb-2'>
                        <strong>Time:</strong> {new Date(this.state.processedError.timestamp).toLocaleString()}
                      </div>
                    )}
                    {this.state.errorInfo && this.state.errorInfo.componentStack && (
                      <div>
                        <strong>Component Stack:</strong>
                        <pre className='mt-1 whitespace-pre-wrap'>{this.state.errorInfo.componentStack}</pre>
                      </div>
                    )}
                  </div>
                </details>
              )}
            </div>
            <div className='mt-4'>
              <button
                onClick={() => {
                  // Call onRetry callback before state update
                  if (this.props.onRetry) this.props.onRetry();
                  
                  // Use functional setState to prevent race conditions
                  // This ensures atomic state update with correct retryCount increment
                  this.setState(prevState => ({
                    hasError: false,
                    error: null,
                    errorInfo: null,
                    processedError: null,
                    retryCount: prevState.retryCount + 1
                  }));
                }}
                className='bg-red-600 text-white px-4 py-2 rounded text-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500'
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
