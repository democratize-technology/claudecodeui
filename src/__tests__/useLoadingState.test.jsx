import React from 'react';
import { render, screen, waitFor, act, renderHook } from '@testing-library/react';
import { 
  useLoadingState, 
  useSimpleLoading, 
  useMultipleLoadingStates, 
  withLoadingState 
} from '../utils/hooks/useLoadingState.jsx';

describe('useLoadingState', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('basic functionality', () => {
    it('should initialize with default loading state', () => {
      const { result } = renderHook(() => useLoadingState());
      
      expect(result.current.isLoading).toBe(false);
      expect(result.current.loadingStates).toEqual({});
      expect(result.current.hasActiveOperations).toBe(false);
      expect(result.current.activeOperationCount).toBe(0);
    });

    it('should initialize with custom loading state', () => {
      const { result } = renderHook(() => useLoadingState({ initialLoading: true }));
      
      expect(result.current.isLoading).toBe(true);
    });

    it('should set loading state correctly', () => {
      const { result } = renderHook(() => useLoadingState());
      
      act(() => {
        result.current.setLoading(true);
      });
      
      expect(result.current.isLoading).toBe(true);
      
      act(() => {
        result.current.setLoading(false);
      });
      
      expect(result.current.isLoading).toBe(false);
    });

    it('should call onLoadingChange callback when loading state changes', () => {
      const onLoadingChange = jest.fn();
      const { result } = renderHook(() => useLoadingState({ onLoadingChange }));
      
      act(() => {
        result.current.setLoading(true, 'test-operation');
      });
      
      expect(onLoadingChange).toHaveBeenCalledWith(true, 'test-operation');
      
      act(() => {
        result.current.setLoading(false, 'test-operation');
      });
      
      expect(onLoadingChange).toHaveBeenCalledWith(false, 'test-operation');
    });

    it('should reset all loading states', () => {
      const { result } = renderHook(() => useLoadingState({ multipleStates: true }));
      
      act(() => {
        result.current.setLoading(true);
        result.current.setNamedLoading('test1', true);
        result.current.setNamedLoading('test2', true);
      });
      
      expect(result.current.isLoading).toBe(true);
      expect(result.current.loadingStates.test1).toBe(true);
      expect(result.current.loadingStates.test2).toBe(true);
      
      act(() => {
        result.current.resetLoading();
      });
      
      expect(result.current.isLoading).toBe(false);
      expect(result.current.loadingStates).toEqual({});
    });
  });

  describe('async operations', () => {
    it('should handle successful async operation', async () => {
      const { result } = renderHook(() => useLoadingState());
      
      const mockOperation = jest.fn().mockResolvedValue('success');
      
      act(() => {
        result.current.executeAsync(mockOperation, 'test-op');
      });
      
      // Should be loading immediately
      expect(result.current.isLoading).toBe(true);
      
      // Wait for operation to complete
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
      
      expect(mockOperation).toHaveBeenCalledTimes(1);
    });

    it('should handle failed async operation', async () => {
      const { result } = renderHook(() => useLoadingState());
      
      const mockOperation = jest.fn().mockRejectedValue(new Error('Test error'));
      
      let thrownError;
      try {
        await act(async () => {
          await result.current.executeAsync(mockOperation, 'test-op');
        });
      } catch (error) {
        thrownError = error;
      }
      
      expect(thrownError).toBeDefined();
      expect(thrownError.message).toBe('Test error');
      expect(result.current.isLoading).toBe(false);
    });

    it('should prevent duplicate operations', async () => {
      const { result } = renderHook(() => useLoadingState());
      
      const mockOperation = jest.fn().mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));
      
      // Start first operation
      act(() => {
        result.current.executeAsync(mockOperation, 'same-op');
      });
      
      // Try to start duplicate operation
      act(() => {
        result.current.executeAsync(mockOperation, 'same-op');
      });
      
      // Should only call once due to duplicate prevention
      await waitFor(() => {
        expect(mockOperation).toHaveBeenCalledTimes(1);
      });
    });

    it('should not auto-reset when autoReset is false', async () => {
      const { result } = renderHook(() => useLoadingState({ autoReset: false }));
      
      const mockOperation = jest.fn().mockResolvedValue('success');
      
      await act(async () => {
        await result.current.executeAsync(mockOperation, 'test-op');
      });
      
      // Should still be loading because autoReset is false
      expect(result.current.isLoading).toBe(true);
    });
  });

  describe('multiple loading states', () => {
    it('should handle named loading states', () => {
      const { result } = renderHook(() => useLoadingState({ multipleStates: true }));
      
      act(() => {
        result.current.setNamedLoading('operation1', true);
        result.current.setNamedLoading('operation2', true);
      });
      
      expect(result.current.loadingStates.operation1).toBe(true);
      expect(result.current.loadingStates.operation2).toBe(true);
      expect(result.current.getLoadingState('operation1')).toBe(true);
      expect(result.current.getLoadingState('operation2')).toBe(true);
      expect(result.current.isAnyLoading()).toBe(true);
    });

    it('should handle named async operations', async () => {
      const { result } = renderHook(() => useLoadingState({ multipleStates: true }));
      
      const mockOperation = jest.fn().mockResolvedValue('success');
      
      act(() => {
        result.current.executeNamedAsync(mockOperation, 'test-operation', 'unique-id');
      });
      
      expect(result.current.loadingStates['test-operation']).toBe(true);
      
      await waitFor(() => {
        expect(result.current.loadingStates['test-operation']).toBe(false);
      });
    });

    it('should warn when using named methods without multipleStates enabled', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      const { result } = renderHook(() => useLoadingState({ multipleStates: false }));
      
      act(() => {
        result.current.setNamedLoading('test', true);
      });
      
      expect(consoleSpy).toHaveBeenCalledWith(
        'useLoadingState: multipleStates option must be enabled to use named loading states'
      );
      
      consoleSpy.mockRestore();
    });
  });

  describe('utility functions', () => {
    it('should create loading-aware props with withLoading', () => {
      const { result } = renderHook(() => useLoadingState());
      
      act(() => {
        result.current.setLoading(true);
      });
      
      const props = result.current.withLoading(
        { className: 'test-class' },
        { 'data-custom': 'value' }
      );
      
      expect(props).toEqual({
        className: 'test-class',
        disabled: true,
        'aria-busy': true,
        'data-loading': true,
        'data-custom': 'value'
      });
    });

    it('should return correct loading text', () => {
      const { result } = renderHook(() => useLoadingState());
      
      expect(result.current.getLoadingText('Submit', 'Submitting...')).toBe('Submit');
      
      act(() => {
        result.current.setLoading(true);
      });
      
      expect(result.current.getLoadingText('Submit', 'Submitting...')).toBe('Submitting...');
    });

    it('should detect any loading state correctly', () => {
      const { result } = renderHook(() => useLoadingState({ multipleStates: true }));
      
      expect(result.current.isAnyLoading()).toBe(false);
      
      act(() => {
        result.current.setLoading(true);
      });
      
      expect(result.current.isAnyLoading()).toBe(true);
      
      act(() => {
        result.current.setLoading(false);
        result.current.setNamedLoading('test', true);
      });
      
      expect(result.current.isAnyLoading()).toBe(true);
    });
  });
});

describe('useSimpleLoading', () => {
  it('should return tuple with isLoading, setLoading, and executeAsync', () => {
    const { result } = renderHook(() => useSimpleLoading());
    const [isLoading, setLoading, executeAsync] = result.current;
    
    expect(typeof isLoading).toBe('boolean');
    expect(typeof setLoading).toBe('function');
    expect(typeof executeAsync).toBe('function');
  });

  it('should work with initial loading state', () => {
    const { result } = renderHook(() => useSimpleLoading(true));
    const [isLoading] = result.current;
    
    expect(isLoading).toBe(true);
  });
});

describe('useMultipleLoadingStates', () => {
  it('should create convenience methods for named states', () => {
    const { result } = renderHook(() => useMultipleLoadingStates(['save', 'delete']));
    
    expect(result.current.saveLoading).toBe(false);
    expect(result.current.deleteLoading).toBe(false);
    expect(typeof result.current.setSaveLoading).toBe('function');
    expect(typeof result.current.setDeleteLoading).toBe('function');
  });
});

describe('withLoadingState HOC', () => {
  it('should provide loadingState prop to wrapped component', () => {
    const TestComponent = ({ loadingState }) => {
      return <div data-testid="loading-state">{loadingState.isLoading.toString()}</div>;
    };

    const WrappedComponent = withLoadingState(TestComponent);
    
    render(<WrappedComponent />);
    
    expect(screen.getByTestId('loading-state')).toHaveTextContent('false');
  });
});

describe('edge cases and error handling', () => {
  it('should handle rapid state changes', () => {
    const { result } = renderHook(() => useLoadingState());
    
    act(() => {
      result.current.setLoading(true);
      result.current.setLoading(false);
      result.current.setLoading(true);
    });
    
    expect(result.current.isLoading).toBe(true);
  });

  it('should handle empty operation names gracefully', async () => {
    const { result } = renderHook(() => useLoadingState());
    
    const mockOperation = jest.fn().mockResolvedValue('success');
    
    await act(async () => {
      await result.current.executeAsync(mockOperation, '');
    });
    
    expect(mockOperation).toHaveBeenCalledTimes(1);
  });

  it('should handle undefined callbacks gracefully', () => {
    const { result } = renderHook(() => useLoadingState({ onLoadingChange: undefined }));
    
    act(() => {
      result.current.setLoading(true);
    });
    
    expect(result.current.isLoading).toBe(true);
  });
});