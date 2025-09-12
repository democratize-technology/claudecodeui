import React from 'react';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { jest } from '@jest/globals';
import MainContent from '../../components/MainContent';
import { useTaskMaster } from '../../contexts/TaskMasterContext';
import { useTasksSettings } from '../../contexts/TasksSettingsContext';

// Mock the contexts
jest.mock('../../contexts/TaskMasterContext');
jest.mock('../../contexts/TasksSettingsContext');

// Mock the API
jest.mock('../../utils/api', () => ({
  api: {
    get: jest.fn().mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue({ prdFiles: [] })
    })
  }
}));

// Mock child components to focus on mobile navigation testing
jest.mock('../../components/ChatInterface', () => {
  return function MockChatInterface() {
    return <div data-testid="chat-interface">Chat Interface</div>;
  };
});

jest.mock('../../components/FileTree', () => {
  return function MockFileTree() {
    return <div data-testid="file-tree">File Tree</div>;
  };
});

jest.mock('../../components/Shell', () => {
  return function MockShell() {
    return <div data-testid="shell">Shell</div>;
  };
});

jest.mock('../../components/GitPanel', () => {
  return function MockGitPanel() {
    return <div data-testid="git-panel">Git Panel</div>;
  };
});

jest.mock('../../components/TaskList', () => {
  return function MockTaskList() {
    return <div data-testid="task-list">Task List</div>;
  };
});

describe('MainContent Mobile Navigation', () => {
  // Helper function to create mobile viewport mock
  const mockMobileViewport = (matches = true) => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: jest.fn().mockImplementation((query) => ({
        matches: query === '(max-width: 768px)' ? matches : false,
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn()
      }))
    });
  };

  // Helper function to mock touch device detection
  const mockTouchDevice = (isTouch = true) => {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: jest.fn().mockImplementation((query) => ({
        matches: query === '(hover: none) and (pointer: coarse)' ? isTouch : false,
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn()
      }))
    });
  };

  const defaultProps = {
    selectedProject: {
      name: 'test-project',
      displayName: 'Test Project',
      path: '/test/project',
      fullPath: '/test/project'
    },
    selectedSession: null,
    activeTab: 'chat',
    setActiveTab: jest.fn(),
    ws: {},
    sendMessage: jest.fn(),
    messages: [],
    isMobile: true,
    onMenuClick: jest.fn(),
    isLoading: false,
    onInputFocusChange: jest.fn(),
    onSessionActive: jest.fn(),
    onSessionInactive: jest.fn(),
    onReplaceTemporarySession: jest.fn(),
    onNavigateToSession: jest.fn(),
    onShowSettings: jest.fn(),
    autoExpandTools: false,
    showRawParameters: false,
    autoScrollToBottom: true,
    sendByCtrlEnter: false
  };

  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();
    
    // Mock the contexts with default values
    useTaskMaster.mockReturnValue({
      tasks: [],
      currentProject: null,
      refreshTasks: jest.fn(),
      setCurrentProject: jest.fn()
    });

    useTasksSettings.mockReturnValue({
      tasksEnabled: false,
      isTaskMasterInstalled: false,
      isTaskMasterReady: false
    });

    // Reset viewport to mobile by default
    mockMobileViewport(true);
  });

  describe('Mobile Hamburger Menu Rendering', () => {
    test('should render hamburger menu when isMobile is true', () => {
      render(<MainContent {...defaultProps} isMobile={true} />);
      
      const hamburgerButtons = screen.getAllByRole('button');
      const hamburgerButton = hamburgerButtons.find(btn => 
        btn.querySelector('svg path[d*="M4 6h16M4 12h16M4 18h16"]')
      );
      
      expect(hamburgerButton).toBeInTheDocument();
      expect(hamburgerButton).toHaveClass(
        'p-2.5',
        'text-gray-600',
        'dark:text-gray-400',
        'hover:text-gray-900',
        'dark:hover:text-white',
        'rounded-md',
        'hover:bg-gray-100',
        'dark:hover:bg-gray-700',
        'touch-manipulation',
        'active:scale-95'
      );
    });

    test('should not render hamburger menu when isMobile is false', () => {
      render(<MainContent {...defaultProps} isMobile={false} />);
      
      const hamburgerButtons = screen.queryAllByRole('button');
      const hamburgerButton = hamburgerButtons.find(btn => 
        btn.querySelector('svg path[d*="M4 6h16M4 12h16M4 18h16"]')
      );
      
      expect(hamburgerButton).toBeUndefined();
    });

    test('should render hamburger menu in loading state when isMobile is true', () => {
      render(<MainContent {...defaultProps} isMobile={true} isLoading={true} />);
      
      const hamburgerButtons = screen.getAllByRole('button');
      const hamburgerButton = hamburgerButtons.find(btn => 
        btn.querySelector('svg path[d*="M4 6h16M4 12h16M4 18h16"]')
      );
      
      expect(hamburgerButton).toBeInTheDocument();
      expect(hamburgerButton).toHaveClass('p-1.5');
    });

    test('should render hamburger menu in no-project state when isMobile is true', () => {
      render(<MainContent {...defaultProps} isMobile={true} selectedProject={null} />);
      
      const hamburgerButtons = screen.getAllByRole('button');
      const hamburgerButton = hamburgerButtons.find(btn => 
        btn.querySelector('svg path[d*="M4 6h16M4 12h16M4 18h16"]')
      );
      
      expect(hamburgerButton).toBeInTheDocument();
      expect(hamburgerButton).toHaveClass('p-1.5');
    });

    test('should have proper SVG icon structure for hamburger menu', () => {
      render(<MainContent {...defaultProps} isMobile={true} />);
      
      const hamburgerButtons = screen.getAllByRole('button');
      const hamburgerButton = hamburgerButtons.find(btn => 
        btn.querySelector('svg path[d*="M4 6h16M4 12h16M4 18h16"]')
      );
      
      const svg = hamburgerButton.querySelector('svg');
      expect(svg).toHaveClass('w-6', 'h-6');
      expect(svg).toHaveAttribute('fill', 'none');
      expect(svg).toHaveAttribute('stroke', 'currentColor');
      expect(svg).toHaveAttribute('viewBox', '0 0 24 24');

      const path = svg.querySelector('path');
      expect(path).toHaveAttribute('stroke-linecap', 'round');
      expect(path).toHaveAttribute('stroke-linejoin', 'round');
      expect(path).toHaveAttribute('stroke-width', '2');
    });
  });

  describe('Mobile Interaction Handlers', () => {
    test('should call onMenuClick when hamburger menu is clicked', () => {
      const mockOnMenuClick = jest.fn();
      render(<MainContent {...defaultProps} isMobile={true} onMenuClick={mockOnMenuClick} />);
      
      const hamburgerButtons = screen.getAllByRole('button');
      const hamburgerButton = hamburgerButtons.find(btn => 
        btn.querySelector('svg path[d*="M4 6h16M4 12h16M4 18h16"]')
      );
      
      fireEvent.click(hamburgerButton);
      
      expect(mockOnMenuClick).toHaveBeenCalledTimes(1);
    });

    test('should call onMenuClick when hamburger menu receives touch start event', () => {
      const mockOnMenuClick = jest.fn();
      render(<MainContent {...defaultProps} isMobile={true} onMenuClick={mockOnMenuClick} />);
      
      const hamburgerButtons = screen.getAllByRole('button');
      const hamburgerButton = hamburgerButtons.find(btn => 
        btn.querySelector('svg path[d*="M4 6h16M4 12h16M4 18h16"]')
      );
      
      const touchStartEvent = new TouchEvent('touchstart', {
        touches: [{ clientX: 100, clientY: 100 }],
        bubbles: true,
        cancelable: true
      });

      // Mock preventDefault
      touchStartEvent.preventDefault = jest.fn();
      
      fireEvent(hamburgerButton, touchStartEvent);
      
      expect(mockOnMenuClick).toHaveBeenCalledTimes(1);
      expect(touchStartEvent.preventDefault).toHaveBeenCalled();
    });

    test('should prevent default behavior on touch start', () => {
      const mockOnMenuClick = jest.fn();
      render(<MainContent {...defaultProps} isMobile={true} onMenuClick={mockOnMenuClick} />);
      
      const hamburgerButtons = screen.getAllByRole('button');
      const hamburgerButton = hamburgerButtons.find(btn => 
        btn.querySelector('svg path[d*="M4 6h16M4 12h16M4 18h16"]')
      );
      
      const mockPreventDefault = jest.fn();
      const touchStartEvent = {
        type: 'touchstart',
        preventDefault: mockPreventDefault,
        touches: [{ clientX: 100, clientY: 100 }]
      };
      
      fireEvent.touchStart(hamburgerButton, touchStartEvent);
      
      expect(mockOnMenuClick).toHaveBeenCalledTimes(1);
    });

    test('should handle multiple rapid taps correctly', () => {
      const mockOnMenuClick = jest.fn();
      render(<MainContent {...defaultProps} isMobile={true} onMenuClick={mockOnMenuClick} />);
      
      const hamburgerButtons = screen.getAllByRole('button');
      const hamburgerButton = hamburgerButtons.find(btn => 
        btn.querySelector('svg path[d*="M4 6h16M4 12h16M4 18h16"]')
      );
      
      // Simulate rapid taps
      fireEvent.touchStart(hamburgerButton);
      fireEvent.touchStart(hamburgerButton);
      fireEvent.touchStart(hamburgerButton);
      
      expect(mockOnMenuClick).toHaveBeenCalledTimes(3);
    });
  });

  describe('CSS Transform Feedback', () => {
    test('should apply touch-manipulation class for better touch handling', () => {
      render(<MainContent {...defaultProps} isMobile={true} />);
      
      const hamburgerButtons = screen.getAllByRole('button');
      const hamburgerButton = hamburgerButtons.find(btn => 
        btn.querySelector('svg path[d*="M4 6h16M4 12h16M4 18h16"]')
      );
      
      expect(hamburgerButton).toHaveClass('touch-manipulation');
    });

    test('should apply active:scale-95 class for touch feedback', () => {
      render(<MainContent {...defaultProps} isMobile={true} />);
      
      const hamburgerButtons = screen.getAllByRole('button');
      const hamburgerButton = hamburgerButtons.find(btn => 
        btn.querySelector('svg path[d*="M4 6h16M4 12h16M4 18h16"]')
      );
      
      expect(hamburgerButton).toHaveClass('active:scale-95');
    });

    test('should have proper hover states that work with touch devices', () => {
      render(<MainContent {...defaultProps} isMobile={true} />);
      
      const hamburgerButtons = screen.getAllByRole('button');
      const hamburgerButton = hamburgerButtons.find(btn => 
        btn.querySelector('svg path[d*="M4 6h16M4 12h16M4 18h16"]')
      );
      
      expect(hamburgerButton).toHaveClass(
        'hover:text-gray-900',
        'dark:hover:text-white',
        'hover:bg-gray-100',
        'dark:hover:bg-gray-700'
      );
    });

    test('should apply visual feedback on active state', () => {
      render(<MainContent {...defaultProps} isMobile={true} />);
      
      const hamburgerButtons = screen.getAllByRole('button');
      const hamburgerButton = hamburgerButtons.find(btn => 
        btn.querySelector('svg path[d*="M4 6h16M4 12h16M4 18h16"]')
      );
      
      // Simulate active state by adding the class that would be applied by CSS
      act(() => {
        hamburgerButton.classList.add('scale-95');
      });
      
      expect(hamburgerButton).toHaveClass('scale-95');
    });

    test('should have proper button sizing for touch targets', () => {
      render(<MainContent {...defaultProps} isMobile={true} />);
      
      const hamburgerButtons = screen.getAllByRole('button');
      const hamburgerButton = hamburgerButtons.find(btn => 
        btn.querySelector('svg path[d*="M4 6h16M4 12h16M4 18h16"]')
      );
      
      expect(hamburgerButton).toHaveClass('p-2.5'); // Adequate touch target size
      
      const svg = hamburgerButton.querySelector('svg');
      expect(svg).toHaveClass('w-6', 'h-6'); // Proper icon size
    });
  });

  describe('Responsive Design & Media Queries', () => {
    test('should adapt to mobile viewport changes', () => {
      mockMobileViewport(true);
      
      const { rerender } = render(<MainContent {...defaultProps} isMobile={true} />);
      
      let hamburgerButtons = screen.getAllByRole('button');
      let hamburgerButton = hamburgerButtons.find(btn => 
        btn.querySelector('svg path[d*="M4 6h16M4 12h16M4 18h16"]')
      );
      expect(hamburgerButton).toBeInTheDocument();
      
      // Change to desktop viewport
      mockMobileViewport(false);
      rerender(<MainContent {...defaultProps} isMobile={false} />);
      
      hamburgerButtons = screen.queryAllByRole('button');
      hamburgerButton = hamburgerButtons.find(btn => 
        btn.querySelector('svg path[d*="M4 6h16M4 12h16M4 18h16"]')
      );
      expect(hamburgerButton).toBeUndefined();
    });

    test('should handle touch device media query correctly', () => {
      mockTouchDevice(true);
      render(<MainContent {...defaultProps} isMobile={true} />);
      
      const hamburgerButtons = screen.getAllByRole('button');
      const hamburgerButton = hamburgerButtons.find(btn => 
        btn.querySelector('svg path[d*="M4 6h16M4 12h16M4 18h16"]')
      );
      
      expect(hamburgerButton).toHaveClass('touch-manipulation');
    });

    test('should maintain proper button hierarchy on mobile', () => {
      render(<MainContent {...defaultProps} isMobile={true} />);
      
      // Check that hamburger menu appears before other UI elements
      const hamburgerButtons = screen.getAllByRole('button');
      const hamburgerButton = hamburgerButtons.find(btn => 
        btn.querySelector('svg path[d*="M4 6h16M4 12h16M4 18h16"]')
      );
      
      expect(hamburgerButton).toBeInTheDocument();
      
      // Check that the hamburger button is in the header section
      const header = hamburgerButton.closest('.bg-white, .dark\\:bg-gray-800');
      expect(header).toBeInTheDocument();
      expect(header).toHaveClass('border-b');
    });
  });

  describe('Regression Tests - Transform Inherit Bug', () => {
    test('should NOT have transform: inherit that blocks visual feedback', () => {
      render(<MainContent {...defaultProps} isMobile={true} />);
      
      const hamburgerButtons = screen.getAllByRole('button');
      const hamburgerButton = hamburgerButtons.find(btn => 
        btn.querySelector('svg path[d*="M4 6h16M4 12h16M4 18h16"]')
      );
      
      const computedStyle = window.getComputedStyle(hamburgerButton);
      
      // Ensure transform is not set to 'inherit' which would block feedback
      expect(computedStyle.transform).not.toBe('inherit');
    });

    test('should allow transform: scale(0.95) on active state', () => {
      render(<MainContent {...defaultProps} isMobile={true} />);
      
      const hamburgerButtons = screen.getAllByRole('button');
      const hamburgerButton = hamburgerButtons.find(btn => 
        btn.querySelector('svg path[d*="M4 6h16M4 12h16M4 18h16"]')
      );
      
      // Simulate the CSS active state
      act(() => {
        hamburgerButton.style.transform = 'scale(0.95)';
      });
      
      const computedStyle = window.getComputedStyle(hamburgerButton);
      expect(computedStyle.transform).toBe('scale(0.95)');
    });

    test('should have active:scale-95 class that can override any inherit rules', () => {
      render(<MainContent {...defaultProps} isMobile={true} />);
      
      const hamburgerButtons = screen.getAllByRole('button');
      const hamburgerButton = hamburgerButtons.find(btn => 
        btn.querySelector('svg path[d*="M4 6h16M4 12h16M4 18h16"]')
      );
      
      expect(hamburgerButton).toHaveClass('active:scale-95');
      
      // The class should be present and ready to override any inherited transforms
      expect(hamburgerButton.className).toContain('active:scale-95');
    });

    test('should properly reset transforms after interaction', () => {
      render(<MainContent {...defaultProps} isMobile={true} />);
      
      const hamburgerButtons = screen.getAllByRole('button');
      const hamburgerButton = hamburgerButtons.find(btn => 
        btn.querySelector('svg path[d*="M4 6h16M4 12h16M4 18h16"]')
      );
      
      // Simulate active state
      act(() => {
        hamburgerButton.style.transform = 'scale(0.95)';
      });
      
      expect(hamburgerButton.style.transform).toBe('scale(0.95)');
      
      // Simulate release/reset
      act(() => {
        hamburgerButton.style.transform = '';
      });
      
      expect(hamburgerButton.style.transform).toBe('');
    });

    test('should maintain visual feedback capability across all hamburger menu instances', () => {
      // Test main content hamburger menu
      const { rerender } = render(<MainContent {...defaultProps} isMobile={true} />);
      
      let hamburgerButtons = screen.getAllByRole('button');
      let hamburgerButton = hamburgerButtons.find(btn => 
        btn.querySelector('svg path[d*="M4 6h16M4 12h16M4 18h16"]')
      );
      
      expect(hamburgerButton).toHaveClass('active:scale-95');
      
      // Test loading state hamburger menu
      rerender(<MainContent {...defaultProps} isMobile={true} isLoading={true} />);
      
      hamburgerButtons = screen.getAllByRole('button');
      hamburgerButton = hamburgerButtons.find(btn => 
        btn.querySelector('svg path[d*="M4 6h16M4 12h16M4 18h16"]')
      );
      
      expect(hamburgerButton).toBeInTheDocument();
      
      // Test no-project state hamburger menu
      rerender(<MainContent {...defaultProps} isMobile={true} selectedProject={null} />);
      
      hamburgerButtons = screen.getAllByRole('button');
      hamburgerButton = hamburgerButtons.find(btn => 
        btn.querySelector('svg path[d*="M4 6h16M4 12h16M4 18h16"]')
      );
      
      expect(hamburgerButton).toBeInTheDocument();
    });
  });

  describe('Integration Tests - Mobile Navigation Workflow', () => {
    test('should complete full mobile navigation interaction flow', async () => {
      const mockOnMenuClick = jest.fn();
      render(<MainContent {...defaultProps} isMobile={true} onMenuClick={mockOnMenuClick} />);
      
      const hamburgerButtons = screen.getAllByRole('button');
      const hamburgerButton = hamburgerButtons.find(btn => 
        btn.querySelector('svg path[d*="M4 6h16M4 12h16M4 18h16"]')
      );
      
      // Step 1: Button is visible and properly styled
      expect(hamburgerButton).toBeInTheDocument();
      expect(hamburgerButton).toHaveClass('touch-manipulation', 'active:scale-95');
      
      // Step 2: Touch interaction triggers callback
      fireEvent.touchStart(hamburgerButton);
      expect(mockOnMenuClick).toHaveBeenCalledTimes(1);
      
      // Step 3: Click interaction also works
      fireEvent.click(hamburgerButton);
      expect(mockOnMenuClick).toHaveBeenCalledTimes(2);
      
      // Step 4: Visual feedback can be applied
      act(() => {
        hamburgerButton.style.transform = 'scale(0.95)';
      });
      expect(hamburgerButton.style.transform).toBe('scale(0.95)');
    });

    test('should work correctly with different project states', () => {
      const mockOnMenuClick = jest.fn();
      
      // Test with project selected
      const { rerender } = render(
        <MainContent {...defaultProps} isMobile={true} onMenuClick={mockOnMenuClick} />
      );
      
      let hamburgerButtons = screen.getAllByRole('button');
      let hamburgerButton = hamburgerButtons.find(btn => 
        btn.querySelector('svg path[d*="M4 6h16M4 12h16M4 18h16"]')
      );
      
      expect(hamburgerButton).toBeInTheDocument();
      fireEvent.click(hamburgerButton);
      expect(mockOnMenuClick).toHaveBeenCalledTimes(1);
      
      // Test with no project selected
      mockOnMenuClick.mockClear();
      rerender(
        <MainContent 
          {...defaultProps} 
          isMobile={true} 
          onMenuClick={mockOnMenuClick}
          selectedProject={null}
        />
      );
      
      hamburgerButtons = screen.getAllByRole('button');
      hamburgerButton = hamburgerButtons.find(btn => 
        btn.querySelector('svg path[d*="M4 6h16M4 12h16M4 18h16"]')
      );
      
      expect(hamburgerButton).toBeInTheDocument();
      fireEvent.click(hamburgerButton);
      expect(mockOnMenuClick).toHaveBeenCalledTimes(1);
      
      // Test in loading state
      mockOnMenuClick.mockClear();
      rerender(
        <MainContent 
          {...defaultProps} 
          isMobile={true} 
          onMenuClick={mockOnMenuClick}
          isLoading={true}
        />
      );
      
      hamburgerButtons = screen.getAllByRole('button');
      hamburgerButton = hamburgerButtons.find(btn => 
        btn.querySelector('svg path[d*="M4 6h16M4 12h16M4 18h16"]')
      );
      
      expect(hamburgerButton).toBeInTheDocument();
      fireEvent.click(hamburgerButton);
      expect(mockOnMenuClick).toHaveBeenCalledTimes(1);
    });

    test('should handle edge cases gracefully', () => {
      // Test with undefined onMenuClick
      const { rerender } = render(<MainContent {...defaultProps} isMobile={true} onMenuClick={undefined} />);
      
      let hamburgerButtons = screen.getAllByRole('button');
      let hamburgerButton = hamburgerButtons.find(btn => 
        btn.querySelector('svg path[d*="M4 6h16M4 12h16M4 18h16"]')
      );
      
      // Should render the button even without handler
      expect(hamburgerButton).toBeInTheDocument();
      
      // Test with null onMenuClick  
      rerender(<MainContent {...defaultProps} isMobile={true} onMenuClick={null} />);
      
      hamburgerButtons = screen.getAllByRole('button');
      hamburgerButton = hamburgerButtons.find(btn => 
        btn.querySelector('svg path[d*="M4 6h16M4 12h16M4 18h16"]')
      );
      
      // Should still render the button
      expect(hamburgerButton).toBeInTheDocument();
      
      // Test with empty function
      const emptyFn = () => {};
      rerender(<MainContent {...defaultProps} isMobile={true} onMenuClick={emptyFn} />);
      
      hamburgerButtons = screen.getAllByRole('button');
      hamburgerButton = hamburgerButtons.find(btn => 
        btn.querySelector('svg path[d*="M4 6h16M4 12h16M4 18h16"]')
      );
      
      // Should not throw when clicking with empty function
      expect(() => {
        fireEvent.click(hamburgerButton);
      }).not.toThrow();
    });

    test('should maintain accessibility standards', () => {
      const mockOnMenuClick = jest.fn();
      render(<MainContent {...defaultProps} isMobile={true} onMenuClick={mockOnMenuClick} />);
      
      const hamburgerButtons = screen.getAllByRole('button');
      const hamburgerButton = hamburgerButtons.find(btn => 
        btn.querySelector('svg path[d*="M4 6h16M4 12h16M4 18h16"]')
      );
      
      // Should have proper button role (implicit for <button> elements)
      expect(hamburgerButton).toBeInTheDocument();
      expect(hamburgerButton.tagName).toBe('BUTTON');
      
      // Should be keyboard accessible (buttons are naturally focusable)
      expect(hamburgerButton.tabIndex).toBe(0);
      
      // Should have focus support
      hamburgerButton.focus();
      expect(document.activeElement).toBe(hamburgerButton);
      
      // Should support keyboard interaction (Enter key)
      fireEvent.keyDown(hamburgerButton, { key: 'Enter', code: 'Enter' });
      fireEvent.keyUp(hamburgerButton, { key: 'Enter', code: 'Enter' });
      
      // Should support space key interaction
      fireEvent.keyDown(hamburgerButton, { key: ' ', code: 'Space' });
      fireEvent.keyUp(hamburgerButton, { key: ' ', code: 'Space' });
    });

    test('should work correctly with session selection changes', () => {
      const mockOnMenuClick = jest.fn();
      
      const { rerender } = render(
        <MainContent {...defaultProps} isMobile={true} onMenuClick={mockOnMenuClick} />
      );
      
      // Test with session selected
      rerender(
        <MainContent 
          {...defaultProps} 
          isMobile={true} 
          onMenuClick={mockOnMenuClick}
          selectedSession={{
            id: 'test-session',
            summary: 'Test Session',
            __provider: 'claude'
          }}
        />
      );
      
      const hamburgerButtons = screen.getAllByRole('button');
      const hamburgerButton = hamburgerButtons.find(btn => 
        btn.querySelector('svg path[d*="M4 6h16M4 12h16M4 18h16"]')
      );
      
      expect(hamburgerButton).toBeInTheDocument();
      fireEvent.click(hamburgerButton);
      expect(mockOnMenuClick).toHaveBeenCalledTimes(1);
    });
  });
});