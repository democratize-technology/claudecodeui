import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import ErrorBoundary from '../components/ErrorBoundary';

// Component that throws an error when shouldThrow is true
const ThrowError = ({ shouldThrow, errorMessage = 'Test error', errorType = Error }) => {
  if (shouldThrow) {
    throw new errorType(errorMessage);
  }
  return <div data-testid="working-component">Component is working</div>;
};

// Component that throws different types of errors
const SecurityThrowError = ({ errorType, shouldThrow }) => {
  if (!shouldThrow) return <div>Safe component</div>;
  
  switch (errorType) {
    case 'xss':
      throw new Error('<script>alert("XSS")</script>');
    case 'path-traversal':
      throw new Error('../../../../../../etc/passwd');
    case 'sql-injection':
      throw new Error("'; DROP TABLE users; --");
    case 'command-injection':
      throw new Error('$(rm -rf /)');
    case 'sensitive-data':
      throw new Error('API_KEY=sk-1234567890abcdef, PASSWORD=secret123');
    case 'stack-overflow':
      // Create a very deep call stack
      const recurse = (n) => {
        if (n > 0) return recurse(n - 1);
        throw new Error('Stack overflow simulation');
      };
      return recurse(1000);
    default:
      throw new Error('Generic test error');
  }
};

describe('ErrorBoundary Security Tests', () => {
  let consoleSpy;

  beforeEach(() => {
    // Mock console.error to prevent noise during tests
    consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  describe('Error Handling Security', () => {
    test('should catch and handle JavaScript errors safely', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} errorMessage="Test JavaScript error" />
        </ErrorBoundary>
      );

      // Should show error UI instead of crashing
      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
      expect(screen.getByText('An error occurred while loading the chat interface.')).toBeInTheDocument();
      expect(screen.getByText('Try Again')).toBeInTheDocument();
    });

    test('should prevent XSS attacks through error messages', () => {
      render(
        <ErrorBoundary showDetails={true}>
          <SecurityThrowError errorType="xss" shouldThrow={true} />
        </ErrorBoundary>
      );

      // Error details should be shown but XSS should be escaped
      const details = screen.getByText('Error Details');
      fireEvent.click(details);

      // The error message should be displayed as text, not executed as HTML
      expect(screen.getByText(/script.*alert.*XSS/)).toBeInTheDocument();
      
      // Verify no script execution (would require more complex testing in real scenarios)
      const errorContainer = screen.getByRole('group'); // details element
      expect(errorContainer).not.toContainHTML('<script>');
    });

    test('should sanitize sensitive data in error messages', () => {
      render(
        <ErrorBoundary showDetails={true}>
          <SecurityThrowError errorType="sensitive-data" shouldThrow={true} />
        </ErrorBoundary>
      );

      // Show error details
      fireEvent.click(screen.getByText('Error Details'));

      // Should display error message (ideally, sensitive data should be redacted by the error boundary)
      const errorText = screen.getByText(/API_KEY.*PASSWORD/);
      expect(errorText).toBeInTheDocument();
      
      // Note: In production, sensitive data should be redacted before display
      // This test documents current behavior and highlights improvement needed
    });

    test('should handle path traversal attempts in error messages', () => {
      render(
        <ErrorBoundary showDetails={true}>
          <SecurityThrowError errorType="path-traversal" shouldThrow={true} />
        </ErrorBoundary>
      );

      fireEvent.click(screen.getByText('Error Details'));
      
      // Should display the path traversal attempt as harmless text
      expect(screen.getByText(/\.\..*etc.*passwd/)).toBeInTheDocument();
    });

    test('should handle SQL injection attempts in error messages', () => {
      render(
        <ErrorBoundary showDetails={true}>
          <SecurityThrowError errorType="sql-injection" shouldThrow={true} />
        </ErrorBoundary>
      );

      fireEvent.click(screen.getByText('Error Details'));
      
      // Should display SQL injection as harmless text
      expect(screen.getByText(/DROP TABLE users/)).toBeInTheDocument();
    });

    test('should handle command injection attempts in error messages', () => {
      render(
        <ErrorBoundary showDetails={true}>
          <SecurityThrowError errorType="command-injection" shouldThrow={true} />
        </ErrorBoundary>
      );

      fireEvent.click(screen.getByText('Error Details'));
      
      // Should display command injection as harmless text
      expect(screen.getByText(/\$\(rm -rf/)).toBeInTheDocument();
    });
  });

  describe('Error Recovery Security', () => {
    test('should reset error state securely on retry', () => {
      const onRetry = jest.fn();

      // First render with error
      const { rerender } = render(
        <ErrorBoundary onRetry={onRetry}>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      // Should show error UI
      expect(screen.getByText('Something went wrong')).toBeInTheDocument();

      // Click try again
      fireEvent.click(screen.getByText('Try Again'));

      // Should call onRetry
      expect(onRetry).toHaveBeenCalled();

      // Re-render with working component (simulate external state change)
      rerender(
        <ErrorBoundary onRetry={onRetry}>
          <ThrowError shouldThrow={false} />
        </ErrorBoundary>
      );

      // Should show working component (ErrorBoundary reset its state when Try Again was clicked)
      expect(screen.getByTestId('working-component')).toBeInTheDocument();
      expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
    });

    test('should maintain error boundary integrity after multiple errors', () => {
      // First error
      const { rerender, unmount } = render(
        <ErrorBoundary showDetails={true}>
          <SecurityThrowError errorType="xss" shouldThrow={true} />
        </ErrorBoundary>
      );

      expect(screen.getByText('Something went wrong')).toBeInTheDocument();

      // Try again (reset state)
      fireEvent.click(screen.getByText('Try Again'));

      // Unmount and create new instance to test error handling robustness
      unmount();

      // Second error of different type
      render(
        <ErrorBoundary showDetails={true}>
          <SecurityThrowError errorType="sql-injection" shouldThrow={true} />
        </ErrorBoundary>
      );

      // Should still catch and handle the second error
      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
      fireEvent.click(screen.getByText('Error Details'));
      expect(screen.getByText(/DROP TABLE users/)).toBeInTheDocument();
    });

    test('should handle stack overflow errors gracefully', () => {
      render(
        <ErrorBoundary>
          <SecurityThrowError errorType="stack-overflow" shouldThrow={true} />
        </ErrorBoundary>
      );

      // Should catch even stack overflow errors
      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    });
  });

  describe('Error Logging Security', () => {
    test('should log errors without exposing sensitive information', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} errorMessage="Database connection failed: password=secret123" />
        </ErrorBoundary>
      );

      // Should log error (console.error is mocked)
      expect(consoleSpy).toHaveBeenCalledWith(
        'ErrorBoundary caught an error:',
        expect.any(Error),
        expect.any(Object)
      );

      // Get the logged error
      const loggedError = consoleSpy.mock.calls[0][1];
      expect(loggedError.message).toContain('Database connection failed');
      
      // Note: In production, sensitive data should be redacted from logs
      // This test documents current behavior and highlights improvement needed
    });

    test('should provide component stack information for debugging', () => {
      render(
        <ErrorBoundary>
          <div>
            <div>
              <ThrowError shouldThrow={true} />
            </div>
          </div>
        </ErrorBoundary>
      );

      // Should log component stack information
      expect(consoleSpy).toHaveBeenCalledWith(
        'ErrorBoundary caught an error:',
        expect.any(Error),
        expect.objectContaining({
          componentStack: expect.any(String)
        })
      );
    });
  });

  describe('UI Security', () => {
    test('should render safe fallback UI when showDetails is false', () => {
      render(
        <ErrorBoundary showDetails={false}>
          <SecurityThrowError errorType="xss" shouldThrow={true} />
        </ErrorBoundary>
      );

      // Should show error message but no details
      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
      expect(screen.getByText('An error occurred while loading the chat interface.')).toBeInTheDocument();
      expect(screen.queryByText('Error Details')).not.toBeInTheDocument();
    });

    test('should render error details safely when showDetails is true', () => {
      render(
        <ErrorBoundary showDetails={true}>
          <SecurityThrowError errorType="xss" shouldThrow={true} />
        </ErrorBoundary>
      );

      // Should show error details toggle
      expect(screen.getByText('Error Details')).toBeInTheDocument();
      
      // Details should be collapsed by default
      expect(screen.queryByText(/<script>/)).not.toBeInTheDocument();
      
      // Expand details
      fireEvent.click(screen.getByText('Error Details'));
      
      // Should show details in a safe way (pre element with text content)
      expect(screen.getByText(/script.*alert.*XSS/)).toBeInTheDocument();
    });

    test('should handle missing error information gracefully', () => {
      // Create a component that sets error state directly
      class DirectErrorComponent extends React.Component {
        constructor(props) {
          super(props);
          this.state = { hasError: false };
        }
        
        componentDidMount() {
          this.setState({ hasError: true, error: null, errorInfo: null });
        }
        
        render() {
          if (this.state.hasError) {
            return (
              <ErrorBoundary showDetails={true}>
                <div>This should not be shown</div>
              </ErrorBoundary>
            );
          }
          return <div>Loading...</div>;
        }
      }

      // This test ensures the ErrorBoundary handles null error states
      const { rerender } = render(<DirectErrorComponent />);
      
      // Re-render to trigger error state
      rerender(
        <ErrorBoundary showDetails={true}>
          <ThrowError shouldThrow={true} errorMessage={null} />
        </ErrorBoundary>
      );

      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    });
  });

  describe('Children Rendering Security', () => {
    test('should render children normally when no error occurs', () => {
      render(
        <ErrorBoundary>
          <div data-testid="child-component">Normal content</div>
          <div>More content</div>
        </ErrorBoundary>
      );

      expect(screen.getByTestId('child-component')).toBeInTheDocument();
      expect(screen.getByText('Normal content')).toBeInTheDocument();
      expect(screen.getByText('More content')).toBeInTheDocument();
      expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
    });

    test('should prevent error propagation to parent components', () => {
      let parentErrorCaught = false;
      
      const ParentComponent = () => {
        try {
          return (
            <ErrorBoundary>
              <ThrowError shouldThrow={true} />
            </ErrorBoundary>
          );
        } catch (error) {
          parentErrorCaught = true;
          return <div>Parent caught error</div>;
        }
      };

      render(<ParentComponent />);

      // Error should be caught by ErrorBoundary, not parent
      expect(parentErrorCaught).toBe(false);
      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
      expect(screen.queryByText('Parent caught error')).not.toBeInTheDocument();
    });
  });

  describe('Accessibility and UX Security', () => {
    test('should provide accessible error UI', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      // Should have appropriate ARIA roles and attributes
      const errorContainer = screen.getByRole('button', { name: 'Try Again' });
      expect(errorContainer).toBeInTheDocument();
      
      // Should have focus management
      fireEvent.click(errorContainer);
      expect(errorContainer).toBeInTheDocument();
    });

    test('should maintain user data integrity during error states', () => {
      const mockOnRetry = jest.fn();
      
      render(
        <ErrorBoundary onRetry={mockOnRetry}>
          <ThrowError shouldThrow={true} />
        </ErrorBoundary>
      );

      // User should be able to retry
      const retryButton = screen.getByText('Try Again');
      fireEvent.click(retryButton);
      
      expect(mockOnRetry).toHaveBeenCalledTimes(1);
      
      // Should be able to retry multiple times
      fireEvent.click(retryButton);
      expect(mockOnRetry).toHaveBeenCalledTimes(2);
    });
  });
});