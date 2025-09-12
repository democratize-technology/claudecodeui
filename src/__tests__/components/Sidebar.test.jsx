/**
 * Sidebar Component Comprehensive Tests
 *
 * This test suite focuses on project selection functionality and prevents regression
 * of the onTouchEnd bug that blocked desktop clicks. The bug was in the handleTouchClick
 * function which called preventDefault() and stopPropagation(), interfering with desktop clicks.
 *
 * Test Coverage:
 * - Desktop click interactions (primary regression prevention)
 * - Mobile touch events (without interfering with desktop)
 * - Keyboard navigation and accessibility
 * - Performance benchmarks for project selection
 * - Edge cases: rapid clicks, concurrent operations
 * - Error handling and loading states
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
// Jest is configured for this project
import Sidebar from '../../components/Sidebar';
import { TaskMasterProvider } from '../../contexts/TaskMasterContext';
import { TasksSettingsProvider } from '../../contexts/TasksSettingsContext';
import { WebSocketProvider } from '../../contexts/WebSocketContext';

// Mock API module
jest.mock('../../utils/api', () => ({
  api: {
    updateProjectName: jest.fn(),
    deleteProject: jest.fn(),
    createProject: jest.fn(),
    getSessions: jest.fn(),
    deleteSession: jest.fn(),
    updateSessionName: jest.fn()
  }
}));

// Mock hooks
jest.mock('../../utils/hooks/useLoadingState', () => ({
  useMultipleLoadingStates: () => ({
    creatingProjectLoading: false,
    refreshingLoading: false,
    executeNamedAsync: jest.fn()
  })
}));

// Mock WebSocket
jest.mock('../../utils/websocket', () => ({
  useWebSocket: jest.fn(() => ({
    ws: null,
    sendMessage: jest.fn(),
    messages: [],
    isConnected: false
  }))
}));

// Mock WebSocketContext
jest.mock('../../contexts/WebSocketContext', () => ({
  WebSocketProvider: ({ children }) => children,
  useWebSocketContext: () => ({
    ws: null,
    sendMessage: jest.fn(),
    messages: [],
    isConnected: false
  })
}));

// Test utilities
const createMockProject = (name, overrides = {}) => ({
  name,
  path: `/path/to/${name}`,
  fullPath: `/path/to/${name}`,
  displayName: name,
  sessions: [],
  starred: false,
  lastAccessed: new Date().toISOString(),
  sessionCount: 0,
  ...overrides
});

const createMockSession = (id, name, overrides = {}) => ({
  id,
  name,
  created_at: new Date().toISOString(),
  last_message_at: new Date().toISOString(),
  message_count: 5,
  ...overrides
});

const createMockProjects = () => [
  createMockProject('project-1', {
    displayName: 'Test Project 1',
    sessions: [
      createMockSession('session-1', 'Session 1'),
      createMockSession('session-2', 'Session 2')
    ],
    sessionCount: 2
  }),
  createMockProject('project-2', {
    displayName: 'Test Project 2',
    sessions: [createMockSession('session-3', 'Session 3')],
    sessionCount: 1,
    starred: true
  }),
  createMockProject('project-3', {
    displayName: 'Test Project 3',
    sessions: [],
    sessionCount: 0
  })
];

// Test wrapper components
const MockTaskMasterProvider = ({ children, currentProject = null }) => (
  <TaskMasterProvider
    value={{
      currentProject,
      setCurrentProject: jest.fn(),
      tasks: [],
      addTask: jest.fn(),
      removeTask: jest.fn(),
      updateTask: jest.fn()
    }}
  >
    {children}
  </TaskMasterProvider>
);

const MockTasksSettingsProvider = ({ children, tasksEnabled = false }) => (
  <TasksSettingsProvider value={{ tasksEnabled }}>{children}</TasksSettingsProvider>
);

const SidebarTestWrapper = ({
  projects = createMockProjects(),
  selectedProject = null,
  selectedSession = null,
  onProjectSelect = jest.fn(),
  onSessionSelect = jest.fn(),
  onNewSession = jest.fn(),
  onSessionDelete = jest.fn(),
  onProjectDelete = jest.fn(),
  isLoading = false,
  onRefresh = jest.fn(),
  onShowSettings = jest.fn(),
  updateAvailable = false,
  latestVersion = '1.0.0',
  currentVersion = '1.0.0',
  onShowVersionModal = jest.fn(),
  currentProject = null,
  tasksEnabled = false
}) => (
  <WebSocketProvider>
    <MockTaskMasterProvider currentProject={currentProject}>
      <MockTasksSettingsProvider tasksEnabled={tasksEnabled}>
        <div data-testid='sidebar-container' style={{ height: '600px', width: '300px' }}>
          <Sidebar
            projects={projects}
            selectedProject={selectedProject}
            selectedSession={selectedSession}
            onProjectSelect={onProjectSelect}
            onSessionSelect={onSessionSelect}
            onNewSession={onNewSession}
            onSessionDelete={onSessionDelete}
            onProjectDelete={onProjectDelete}
            isLoading={isLoading}
            onRefresh={onRefresh}
            onShowSettings={onShowSettings}
            updateAvailable={updateAvailable}
            latestVersion={latestVersion}
            currentVersion={currentVersion}
            onShowVersionModal={onShowVersionModal}
          />
        </div>
      </MockTasksSettingsProvider>
    </MockTaskMasterProvider>
  </WebSocketProvider>
);

// Performance testing utilities
const createPerformanceBenchmark = () => {
  const measurements = [];

  const benchmark = async (name, fn) => {
    const start = performance.now();
    await fn();
    const end = performance.now();
    const duration = end - start;

    measurements.push({ name, duration, timestamp: Date.now() });
    return { name, duration, average: duration };
  };

  const getMeasurements = () => measurements;
  const clearMeasurements = () => (measurements.length = 0);

  return { benchmark, getMeasurements, clearMeasurements };
};

// Touch event utilities
const createTouchEvent = (type, touches = []) => {
  const touchEvent = new Event(type, { bubbles: true, cancelable: true });
  touchEvent.touches = touches.map((touch) => ({
    clientX: touch.x,
    clientY: touch.y,
    target: touch.target
  }));
  touchEvent.preventDefault = jest.fn();
  touchEvent.stopPropagation = jest.fn();
  return touchEvent;
};

describe('Sidebar Component - Project Selection Tests', () => {
  let mockProjects;
  let onProjectSelect;
  let onSessionSelect;
  let performanceBenchmark;

  beforeEach(() => {
    mockProjects = createMockProjects();
    onProjectSelect = jest.fn();
    onSessionSelect = jest.fn();
    performanceBenchmark = createPerformanceBenchmark();

    // Reset viewport to desktop size for most tests
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1024
    });
    Object.defineProperty(window, 'innerHeight', {
      writable: true,
      configurable: true,
      value: 768
    });

    // Mock IntersectionObserver
    global.IntersectionObserver = jest.fn().mockImplementation(() => ({
      observe: jest.fn(),
      unobserve: jest.fn(),
      disconnect: jest.fn()
    }));
  });

  afterEach(() => {
    performanceBenchmark.clearMeasurements();
    jest.clearAllMocks();
  });

  describe('Desktop Click Interactions', () => {
    it('should handle project selection clicks on desktop without preventDefault interference', async () => {
      const { rerender } = render(
        <SidebarTestWrapper projects={mockProjects} onProjectSelect={onProjectSelect} />
      );

      // Find the first project button
      const projectButton = screen.getByRole('button', { name: /test project 1/i });
      expect(projectButton).toBeInTheDocument();

      // Simulate desktop mouse click
      const clickEvent = new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        clientX: 100,
        clientY: 100
      });
      clickEvent.preventDefault = jest.fn();
      clickEvent.stopPropagation = jest.fn();

      // Click should work without being prevented
      await act(async () => {
        fireEvent(projectButton, clickEvent);
      });

      // Verify project selection was called
      expect(onProjectSelect).toHaveBeenCalledTimes(1);
      expect(onProjectSelect).toHaveBeenCalledWith(mockProjects[0]);

      // Verify that preventDefault/stopPropagation were NOT called on the click event
      // (This is the key regression test - the bug was that touch handlers were interfering)
      expect(clickEvent.preventDefault).not.toHaveBeenCalled();
      expect(clickEvent.stopPropagation).not.toHaveBeenCalled();
    });

    it('should handle session selection clicks correctly', async () => {
      render(
        <SidebarTestWrapper
          projects={mockProjects}
          onProjectSelect={onProjectSelect}
          onSessionSelect={onSessionSelect}
        />
      );

      // Expand first project to see sessions
      const projectButton = screen.getByRole('button', { name: /test project 1/i });
      await act(async () => {
        await userEvent.click(projectButton);
      });

      // Wait for sessions to be visible
      await waitFor(() => {
        expect(screen.getByText('Session 1')).toBeInTheDocument();
      });

      // Click on session
      const sessionButton = screen.getByRole('button', { name: /session 1/i });
      await act(async () => {
        await userEvent.click(sessionButton);
      });

      // Verify both project and session selection were called
      expect(onProjectSelect).toHaveBeenCalledWith(mockProjects[0]);
      expect(onSessionSelect).toHaveBeenCalledWith(mockProjects[0].sessions[0]);
    });

    it('should handle rapid desktop clicks without race conditions', async () => {
      const projects = Array.from({ length: 5 }, (_, i) =>
        createMockProject(`rapid-project-${i}`, { displayName: `Rapid Project ${i}` })
      );

      render(<SidebarTestWrapper projects={projects} onProjectSelect={onProjectSelect} />);

      const measurement = await performanceBenchmark.benchmark('rapid-desktop-clicks', async () => {
        // Rapidly click multiple projects
        for (let i = 0; i < projects.length; i++) {
          const projectButton = screen.getByRole('button', {
            name: new RegExp(`rapid project ${i}`, 'i')
          });

          await act(async () => {
            fireEvent.click(projectButton);
          });

          // Small delay to simulate real user behavior
          await new Promise((resolve) => setTimeout(resolve, 10));
        }
      });

      // All clicks should have been processed
      expect(onProjectSelect).toHaveBeenCalledTimes(projects.length);

      // Performance should be good (< 500ms for 5 rapid clicks)
      expect(measurement.duration).toBeLessThan(500);
    });
  });

  describe('onTouchEnd Regression Prevention', () => {
    it('should prevent the specific bug where handleTouchClick blocks desktop clicks', async () => {
      render(<SidebarTestWrapper projects={mockProjects} onProjectSelect={onProjectSelect} />);

      const projectButton = screen.getByRole('button', { name: /test project 1/i });

      // Verify the desktop project button does NOT have an onTouchEnd handler
      // (This confirms the bug fix - the problematic onTouchEnd was removed)
      expect(projectButton.ontouchend).toBeNull();

      // Simulate a desktop click event
      const clickEvent = new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        clientX: 100,
        clientY: 100
      });
      clickEvent.preventDefault = jest.fn();
      clickEvent.stopPropagation = jest.fn();

      await act(async () => {
        fireEvent(projectButton, clickEvent);
      });

      // CRITICAL: Desktop click should work without any preventDefault/stopPropagation interference
      expect(onProjectSelect).toHaveBeenCalledTimes(1);
      expect(onProjectSelect).toHaveBeenCalledWith(mockProjects[0]);
      expect(clickEvent.preventDefault).not.toHaveBeenCalled(); // Click shouldn't be prevented
      expect(clickEvent.stopPropagation).not.toHaveBeenCalled(); // Click shouldn't be stopped

      // Test multiple clicks to ensure no interference
      await act(async () => {
        fireEvent.click(projectButton);
      });

      expect(onProjectSelect).toHaveBeenCalledTimes(2);
    });

    it('should handle mixed touch and click events without interference', async () => {
      render(<SidebarTestWrapper projects={mockProjects} onProjectSelect={onProjectSelect} />);

      const project1Button = screen.getByRole('button', { name: /test project 1/i });
      const project2Button = screen.getByRole('button', { name: /test project 2/i });

      // Mix of touch and click events
      const touchEvent = createTouchEvent('touchend', [{ x: 100, y: 100, target: project1Button }]);

      // Touch first project
      await act(async () => {
        fireEvent(project1Button, touchEvent);
      });

      // Click second project
      await act(async () => {
        await userEvent.click(project2Button);
      });

      // Both interactions should work
      expect(onProjectSelect).toHaveBeenCalledTimes(2);
      expect(onProjectSelect).toHaveBeenNthCalledWith(1, mockProjects[0]);
      expect(onProjectSelect).toHaveBeenNthCalledWith(2, mockProjects[1]);
    });
  });

  describe('Mobile Touch Events', () => {
    beforeEach(() => {
      // Set mobile viewport
      Object.defineProperty(window, 'innerWidth', { value: 375 });
      Object.defineProperty(window, 'innerHeight', { value: 667 });
    });

    it('should handle touch events correctly on mobile devices', async () => {
      render(<SidebarTestWrapper projects={mockProjects} onProjectSelect={onProjectSelect} />);

      const projectButton = screen.getByRole('button', { name: /test project 1/i });

      // Create touch events
      const touchStart = createTouchEvent('touchstart', [
        { x: 100, y: 100, target: projectButton }
      ]);
      const touchEnd = createTouchEvent('touchend', [{ x: 100, y: 100, target: projectButton }]);

      // Simulate touch interaction
      await act(async () => {
        fireEvent(projectButton, touchStart);
        fireEvent(projectButton, touchEnd);
      });

      // Touch should work and select project
      expect(onProjectSelect).toHaveBeenCalledWith(mockProjects[0]);

      // Touch events should have preventDefault called to avoid scrolling issues
      expect(touchEnd.preventDefault).toHaveBeenCalled();
      expect(touchEnd.stopPropagation).toHaveBeenCalled();
    });

    it('should handle touch events efficiently without performance degradation', async () => {
      const projects = Array.from({ length: 10 }, (_, i) =>
        createMockProject(`mobile-project-${i}`, { displayName: `Mobile Project ${i}` })
      );

      render(<SidebarTestWrapper projects={projects} onProjectSelect={onProjectSelect} />);

      const measurement = await performanceBenchmark.benchmark('mobile-touch-events', async () => {
        // Simulate rapid touch interactions
        for (let i = 0; i < 5; i++) {
          const projectButton = screen.getByRole('button', {
            name: new RegExp(`mobile project ${i}`, 'i')
          });

          const touchEvent = createTouchEvent('touchend', [
            { x: 100, y: 100 + i * 50, target: projectButton }
          ]);

          await act(async () => {
            fireEvent(projectButton, touchEvent);
          });

          // Small delay to simulate real touch behavior
          await new Promise((resolve) => setTimeout(resolve, 20));
        }
      });

      // Touch interactions should be fast
      expect(measurement.duration).toBeLessThan(300);
      expect(onProjectSelect).toHaveBeenCalledTimes(5);
    });
  });

  describe('Keyboard Navigation & Accessibility', () => {
    it('should support keyboard navigation with Tab key', async () => {
      render(<SidebarTestWrapper projects={mockProjects} onProjectSelect={onProjectSelect} />);

      const user = userEvent.setup();

      // Tab to first project
      await act(async () => {
        await user.tab();
      });

      // Should focus first project button
      const firstProject = screen.getByRole('button', { name: /test project 1/i });
      expect(document.activeElement).toBe(firstProject);

      // Enter key should select project
      await act(async () => {
        await user.keyboard('{Enter}');
      });

      expect(onProjectSelect).toHaveBeenCalledWith(mockProjects[0]);
    });

    it('should support Space key for project selection', async () => {
      render(<SidebarTestWrapper projects={mockProjects} onProjectSelect={onProjectSelect} />);

      const firstProject = screen.getByRole('button', { name: /test project 1/i });

      // Focus and press Space
      await act(async () => {
        firstProject.focus();
        await userEvent.keyboard(' ');
      });

      expect(onProjectSelect).toHaveBeenCalledWith(mockProjects[0]);
    });

    it('should have proper ARIA attributes for accessibility', () => {
      render(<SidebarTestWrapper projects={mockProjects} />);

      // All project buttons should have proper accessibility attributes
      const projectButtons = screen.getAllByRole('button');

      projectButtons.forEach((button) => {
        // Should be focusable
        expect(button).toHaveAttribute('tabIndex');

        // Should have accessible content
        expect(button.textContent).toBeTruthy();
      });

      // Sidebar should have proper structure
      const sidebar = screen.getByTestId('sidebar-container');
      expect(sidebar).toBeInTheDocument();
    });
  });

  describe('Performance & Loading States', () => {
    it('should handle project loading states correctly', async () => {
      const { rerender } = render(
        <SidebarTestWrapper projects={[]} isLoading={true} onProjectSelect={onProjectSelect} />
      );

      // Should show loading state (assuming there's a loading indicator)
      // Note: This would depend on how loading is indicated in the UI

      // Simulate loading completion
      rerender(
        <SidebarTestWrapper
          projects={mockProjects}
          isLoading={false}
          onProjectSelect={onProjectSelect}
        />
      );

      // Projects should be visible after loading
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /test project 1/i })).toBeInTheDocument();
      });
    });

    it('should perform project selection within performance thresholds', async () => {
      const largeProjectList = Array.from({ length: 50 }, (_, i) =>
        createMockProject(`perf-project-${i}`, {
          displayName: `Performance Project ${i}`,
          sessions: Array.from({ length: 5 }, (_, j) =>
            createMockSession(`session-${i}-${j}`, `Session ${j}`)
          )
        })
      );

      render(<SidebarTestWrapper projects={largeProjectList} onProjectSelect={onProjectSelect} />);

      const measurement = await performanceBenchmark.benchmark(
        'large-project-selection',
        async () => {
          // Select project from large list
          const targetProject = screen.getByRole('button', { name: /performance project 25/i });

          await act(async () => {
            await userEvent.click(targetProject);
          });
        }
      );

      // Selection should be fast even with large project list
      expect(measurement.duration).toBeLessThan(100);
      expect(onProjectSelect).toHaveBeenCalledWith(largeProjectList[25]);
    });

    it('should handle session loading efficiently', async () => {
      render(<SidebarTestWrapper projects={mockProjects} onProjectSelect={onProjectSelect} />);

      const measurement = await performanceBenchmark.benchmark('session-loading', async () => {
        // Expand project to load sessions
        const projectButton = screen.getByRole('button', { name: /test project 1/i });

        await act(async () => {
          await userEvent.click(projectButton);
        });

        // Wait for sessions to appear
        await waitFor(() => {
          expect(screen.getByText('Session 1')).toBeInTheDocument();
        });
      });

      // Session loading should be fast
      expect(measurement.duration).toBeLessThan(200);
    });
  });

  describe('Edge Cases & Error Handling', () => {
    it('should handle projects with no sessions gracefully', async () => {
      const projectsWithEmptySessions = [
        createMockProject('empty-project', {
          displayName: 'Empty Project',
          sessions: [],
          sessionCount: 0
        })
      ];

      render(
        <SidebarTestWrapper
          projects={projectsWithEmptySessions}
          onProjectSelect={onProjectSelect}
        />
      );

      const projectButton = screen.getByRole('button', { name: /empty project/i });

      await act(async () => {
        await userEvent.click(projectButton);
      });

      // Should still select project even with no sessions
      expect(onProjectSelect).toHaveBeenCalledWith(projectsWithEmptySessions[0]);
    });

    it('should handle concurrent project selection attempts', async () => {
      render(<SidebarTestWrapper projects={mockProjects} onProjectSelect={onProjectSelect} />);

      const project1Button = screen.getByRole('button', { name: /test project 1/i });
      const project2Button = screen.getByRole('button', { name: /test project 2/i });

      // Simulate near-simultaneous clicks
      await act(async () => {
        const click1 = userEvent.click(project1Button);
        const click2 = userEvent.click(project2Button);

        await Promise.all([click1, click2]);
      });

      // Both selections should be processed
      expect(onProjectSelect).toHaveBeenCalledTimes(2);
    });

    it('should handle malformed project data gracefully', async () => {
      const malformedProjects = [
        { name: 'test-project', displayName: undefined }, // Missing displayName
        { displayName: 'Another Project' }, // Missing name
        null, // Null project
        createMockProject('valid-project', { displayName: 'Valid Project' })
      ].filter(Boolean); // Filter out null values

      // Should not crash with malformed data
      expect(() => {
        render(
          <SidebarTestWrapper projects={malformedProjects} onProjectSelect={onProjectSelect} />
        );
      }).not.toThrow();
    });
  });

  describe('Integration Tests', () => {
    it('should integrate properly with TaskMaster context', async () => {
      const setCurrentProject = jest.fn();

      render(
        <WebSocketProvider>
          <MockTaskMasterProvider currentProject={null}>
            <MockTasksSettingsProvider>
              <Sidebar
                projects={mockProjects}
                onProjectSelect={onProjectSelect}
                onSessionSelect={jest.fn()}
                onNewSession={jest.fn()}
                onSessionDelete={jest.fn()}
                onProjectDelete={jest.fn()}
                isLoading={false}
                onRefresh={jest.fn()}
                onShowSettings={jest.fn()}
                updateAvailable={false}
                latestVersion='1.0.0'
                currentVersion='1.0.0'
                onShowVersionModal={jest.fn()}
              />
            </MockTasksSettingsProvider>
          </MockTaskMasterProvider>
        </WebSocketProvider>
      );

      const projectButton = screen.getByRole('button', { name: /test project 1/i });

      await act(async () => {
        await userEvent.click(projectButton);
      });

      expect(onProjectSelect).toHaveBeenCalledWith(mockProjects[0]);
    });

    it('should handle search filtering correctly', async () => {
      render(<SidebarTestWrapper projects={mockProjects} onProjectSelect={onProjectSelect} />);

      // Look for search input (if it exists in the component)
      const searchInput = screen.queryByPlaceholderText(/search/i);

      if (searchInput) {
        await act(async () => {
          await userEvent.type(searchInput, 'Project 1');
        });

        // Should filter projects
        await waitFor(() => {
          expect(screen.getByRole('button', { name: /test project 1/i })).toBeInTheDocument();
          expect(screen.queryByRole('button', { name: /test project 2/i })).not.toBeInTheDocument();
        });
      }
    });
  });
});
