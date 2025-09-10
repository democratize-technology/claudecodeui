import React from 'react';
import { render, screen } from '@testing-library/react';
import ProtectedRoute from '../components/ProtectedRoute.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';

// Mock the auth context
jest.mock('../contexts/AuthContext.jsx', () => ({
  useAuth: jest.fn()
}));

// Mock the form components
jest.mock('../components/SetupForm', () => {
  return function MockSetupForm() {
    return <div data-testid='setup-form'>Setup Form</div>;
  };
});

jest.mock('../components/LoginForm', () => {
  return function MockLoginForm() {
    return <div data-testid='login-form'>Login Form</div>;
  };
});

const TestContent = () => <div data-testid='protected-content'>Protected Content</div>;

describe('ProtectedRoute', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should show loading screen when isLoading is true', () => {
    useAuth.mockReturnValue({
      user: null,
      isLoading: true,
      needsSetup: false
    });

    render(
      <ProtectedRoute>
        <TestContent />
      </ProtectedRoute>
    );

    expect(screen.getByText('Claude Code UI')).toBeInTheDocument();
    expect(screen.getByText('Loading...')).toBeInTheDocument();
    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
    expect(screen.queryByTestId('setup-form')).not.toBeInTheDocument();
    expect(screen.queryByTestId('login-form')).not.toBeInTheDocument();
  });

  it('should show setup form when needsSetup is true', () => {
    useAuth.mockReturnValue({
      user: null,
      isLoading: false,
      needsSetup: true
    });

    render(
      <ProtectedRoute>
        <TestContent />
      </ProtectedRoute>
    );

    expect(screen.getByTestId('setup-form')).toBeInTheDocument();
    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
    expect(screen.queryByTestId('login-form')).not.toBeInTheDocument();
    expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
  });

  it('should show login form when user is null and not loading', () => {
    useAuth.mockReturnValue({
      user: null,
      isLoading: false,
      needsSetup: false
    });

    render(
      <ProtectedRoute>
        <TestContent />
      </ProtectedRoute>
    );

    expect(screen.getByTestId('login-form')).toBeInTheDocument();
    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
    expect(screen.queryByTestId('setup-form')).not.toBeInTheDocument();
    expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
  });

  it('should show protected content when user is authenticated', () => {
    const mockUser = { id: 1, username: 'testuser' };

    useAuth.mockReturnValue({
      user: mockUser,
      isLoading: false,
      needsSetup: false
    });

    render(
      <ProtectedRoute>
        <TestContent />
      </ProtectedRoute>
    );

    expect(screen.getByTestId('protected-content')).toBeInTheDocument();
    expect(screen.queryByTestId('setup-form')).not.toBeInTheDocument();
    expect(screen.queryByTestId('login-form')).not.toBeInTheDocument();
    expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
  });

  it('should render multiple children when user is authenticated', () => {
    const mockUser = { id: 1, username: 'testuser' };

    useAuth.mockReturnValue({
      user: mockUser,
      isLoading: false,
      needsSetup: false
    });

    render(
      <ProtectedRoute>
        <div data-testid='child-1'>Child 1</div>
        <div data-testid='child-2'>Child 2</div>
      </ProtectedRoute>
    );

    expect(screen.getByTestId('child-1')).toBeInTheDocument();
    expect(screen.getByTestId('child-2')).toBeInTheDocument();
  });

  describe('Loading screen', () => {
    beforeEach(() => {
      useAuth.mockReturnValue({
        user: null,
        isLoading: true,
        needsSetup: false
      });
    });

    it('should display the correct loading animation elements', () => {
      render(
        <ProtectedRoute>
          <TestContent />
        </ProtectedRoute>
      );

      // Check for loading dots - there should be 3 animated dots
      const dots = screen.getAllByText('', { selector: '.animate-bounce' });
      expect(dots).toHaveLength(3);
    });

    it('should have proper styling classes for the loading screen', () => {
      render(
        <ProtectedRoute>
          <TestContent />
        </ProtectedRoute>
      );

      const loadingContainer = screen.getByText('Claude Code UI').closest('div.min-h-screen');
      expect(loadingContainer).toHaveClass(
        'min-h-screen',
        'bg-background',
        'flex',
        'items-center',
        'justify-center',
        'p-4'
      );
    });

    it('should display the Claude Code UI branding', () => {
      render(
        <ProtectedRoute>
          <TestContent />
        </ProtectedRoute>
      );

      expect(screen.getByText('Claude Code UI')).toBeInTheDocument();
      expect(screen.getByText('Claude Code UI')).toHaveClass(
        'text-2xl',
        'font-bold',
        'text-foreground',
        'mb-2'
      );
    });
  });

  describe('Authentication flow priority', () => {
    it('should prioritize loading over setup when both isLoading and needsSetup are true', () => {
      useAuth.mockReturnValue({
        user: null,
        isLoading: true,
        needsSetup: true
      });

      render(
        <ProtectedRoute>
          <TestContent />
        </ProtectedRoute>
      );

      expect(screen.getByText('Loading...')).toBeInTheDocument();
      expect(screen.queryByTestId('setup-form')).not.toBeInTheDocument();
    });

    it('should prioritize setup over login when needsSetup is true', () => {
      useAuth.mockReturnValue({
        user: null,
        isLoading: false,
        needsSetup: true
      });

      render(
        <ProtectedRoute>
          <TestContent />
        </ProtectedRoute>
      );

      expect(screen.getByTestId('setup-form')).toBeInTheDocument();
      expect(screen.queryByTestId('login-form')).not.toBeInTheDocument();
    });

    it('should prioritize setup over user authentication when needsSetup is true', () => {
      const mockUser = { id: 1, username: 'testuser' };

      useAuth.mockReturnValue({
        user: mockUser,
        isLoading: false,
        needsSetup: true // Setup takes priority over user presence
      });

      render(
        <ProtectedRoute>
          <TestContent />
        </ProtectedRoute>
      );

      expect(screen.getByTestId('setup-form')).toBeInTheDocument();
      expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
    });
  });

  describe('Edge cases', () => {
    it('should handle undefined user gracefully', () => {
      useAuth.mockReturnValue({
        user: undefined,
        isLoading: false,
        needsSetup: false
      });

      render(
        <ProtectedRoute>
          <TestContent />
        </ProtectedRoute>
      );

      expect(screen.getByTestId('login-form')).toBeInTheDocument();
    });

    it('should handle empty user object as authenticated', () => {
      useAuth.mockReturnValue({
        user: {}, // Empty but truthy object
        isLoading: false,
        needsSetup: false
      });

      render(
        <ProtectedRoute>
          <TestContent />
        </ProtectedRoute>
      );

      expect(screen.getByTestId('protected-content')).toBeInTheDocument();
    });

    it('should render without children', () => {
      const mockUser = { id: 1, username: 'testuser' };

      useAuth.mockReturnValue({
        user: mockUser,
        isLoading: false,
        needsSetup: false
      });

      const { container } = render(<ProtectedRoute />);

      // Should render without error, but with no children (undefined is returned)
      expect(container.firstChild).toBeNull();
    });
  });
});
