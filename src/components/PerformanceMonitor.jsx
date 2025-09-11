/**
 * Performance monitoring component for development
 * Tracks render performance, bundle size, and provides optimization insights
 */

import React, { useState, useEffect, useRef, memo } from 'react';

// Performance metrics collector
class PerformanceMetrics {
  constructor() {
    this.metrics = {
      renderCount: 0,
      totalRenderTime: 0,
      lastRenderTime: 0,
      componentMounts: 0,
      componentUnmounts: 0,
      memoryUsage: 0,
      fps: 0
    };
    this.renderStartTime = 0;
    this.fpsCounter = new FPSCounter();
  }

  startRender() {
    this.renderStartTime = performance.now();
  }

  endRender() {
    const renderTime = performance.now() - this.renderStartTime;
    this.metrics.renderCount++;
    this.metrics.totalRenderTime += renderTime;
    this.metrics.lastRenderTime = renderTime;

    // Update memory usage if available
    if (performance.memory) {
      this.metrics.memoryUsage = performance.memory.usedJSHeapSize;
    }
  }

  componentMounted() {
    this.metrics.componentMounts++;
  }

  componentUnmounted() {
    this.metrics.componentUnmounts++;
  }

  getAverageRenderTime() {
    return this.metrics.renderCount > 0
      ? this.metrics.totalRenderTime / this.metrics.renderCount
      : 0;
  }

  getMetrics() {
    return {
      ...this.metrics,
      averageRenderTime: this.getAverageRenderTime(),
      fps: this.fpsCounter.getFPS()
    };
  }

  reset() {
    this.metrics = {
      renderCount: 0,
      totalRenderTime: 0,
      lastRenderTime: 0,
      componentMounts: 0,
      componentUnmounts: 0,
      memoryUsage: 0,
      fps: 0
    };
  }
}

// FPS Counter utility
class FPSCounter {
  constructor() {
    this.fps = 0;
    this.frames = 0;
    this.lastTime = performance.now();
    this.startTracking();
  }

  startTracking() {
    const tick = () => {
      this.frames++;
      const currentTime = performance.now();

      if (currentTime >= this.lastTime + 1000) {
        this.fps = Math.round((this.frames * 1000) / (currentTime - this.lastTime));
        this.frames = 0;
        this.lastTime = currentTime;
      }

      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  getFPS() {
    return this.fps;
  }
}

// Global performance tracker
const globalPerformanceTracker = new PerformanceMetrics();

// Hook for components to track their performance
export function usePerformanceTracking(componentName) {
  const renderCountRef = useRef(0);

  useEffect(() => {
    globalPerformanceTracker.componentMounted();
    return () => {
      globalPerformanceTracker.componentUnmounted();
    };
  }, []);

  useEffect(() => {
    renderCountRef.current++;
    if (process.env.NODE_ENV === 'development' && renderCountRef.current > 10) {
      console.warn(`Component ${componentName} has rendered ${renderCountRef.current} times`);
    }
  });

  return {
    renderCount: renderCountRef.current,
    trackRender: () => {
      globalPerformanceTracker.startRender();
      return () => globalPerformanceTracker.endRender();
    }
  };
}

// Main Performance Monitor Component
const PerformanceMonitor = memo(() => {
  const [metrics, setMetrics] = useState(globalPerformanceTracker.getMetrics());
  const [isVisible, setIsVisible] = useState(false);
  const [autoUpdate, setAutoUpdate] = useState(true);
  const intervalRef = useRef();

  useEffect(() => {
    if (autoUpdate) {
      intervalRef.current = setInterval(() => {
        setMetrics(globalPerformanceTracker.getMetrics());
      }, 1000);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [autoUpdate]);

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  };

  const getPerformanceColor = (value, thresholds) => {
    if (value <= thresholds.good) return 'text-green-600';
    if (value <= thresholds.warning) return 'text-yellow-600';
    return 'text-red-600';
  };

  const resetMetrics = () => {
    globalPerformanceTracker.reset();
    setMetrics(globalPerformanceTracker.getMetrics());
  };

  // Only show in development
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  return (
    <div className='fixed top-4 right-4 z-50'>
      {/* Toggle Button */}
      <button
        onClick={() => setIsVisible(!isVisible)}
        className='bg-blue-600 hover:bg-blue-700 text-white rounded-full p-2 shadow-lg transition-colors mb-2'
        title='Performance Monitor'
      >
        <svg className='w-5 h-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
          <path
            strokeLinecap='round'
            strokeLinejoin='round'
            strokeWidth={2}
            d='M13 10V3L4 14h7v7l9-11h-7z'
          />
        </svg>
      </button>

      {/* Performance Panel */}
      {isVisible && (
        <div className='bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 p-4 min-w-80 max-w-md'>
          <div className='flex items-center justify-between mb-4'>
            <h3 className='text-lg font-semibold text-gray-900 dark:text-white'>
              Performance Monitor
            </h3>
            <div className='flex gap-2'>
              <button
                onClick={() => setAutoUpdate(!autoUpdate)}
                className={`px-2 py-1 rounded text-xs ${
                  autoUpdate
                    ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                    : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                }`}
              >
                {autoUpdate ? 'Auto' : 'Paused'}
              </button>
              <button
                onClick={resetMetrics}
                className='px-2 py-1 bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 rounded text-xs'
              >
                Reset
              </button>
            </div>
          </div>

          <div className='space-y-3'>
            {/* Render Performance */}
            <div className='border-b border-gray-200 dark:border-gray-600 pb-2'>
              <h4 className='font-medium text-gray-700 dark:text-gray-300 mb-1'>
                Render Performance
              </h4>
              <div className='grid grid-cols-2 gap-2 text-sm'>
                <div>
                  <span className='text-gray-600 dark:text-gray-400'>Renders:</span>
                  <span className='ml-1 font-mono'>{metrics.renderCount}</span>
                </div>
                <div>
                  <span className='text-gray-600 dark:text-gray-400'>Avg Time:</span>
                  <span
                    className={`ml-1 font-mono ${getPerformanceColor(metrics.averageRenderTime, {
                      good: 16,
                      warning: 33
                    })}`}
                  >
                    {metrics.averageRenderTime.toFixed(2)}ms
                  </span>
                </div>
                <div>
                  <span className='text-gray-600 dark:text-gray-400'>Last:</span>
                  <span
                    className={`ml-1 font-mono ${getPerformanceColor(metrics.lastRenderTime, {
                      good: 16,
                      warning: 33
                    })}`}
                  >
                    {metrics.lastRenderTime.toFixed(2)}ms
                  </span>
                </div>
                <div>
                  <span className='text-gray-600 dark:text-gray-400'>FPS:</span>
                  <span
                    className={`ml-1 font-mono ${getPerformanceColor(60 - metrics.fps, {
                      good: 5,
                      warning: 15
                    })}`}
                  >
                    {metrics.fps}
                  </span>
                </div>
              </div>
            </div>

            {/* Component Tracking */}
            <div className='border-b border-gray-200 dark:border-gray-600 pb-2'>
              <h4 className='font-medium text-gray-700 dark:text-gray-300 mb-1'>Components</h4>
              <div className='grid grid-cols-2 gap-2 text-sm'>
                <div>
                  <span className='text-gray-600 dark:text-gray-400'>Mounted:</span>
                  <span className='ml-1 font-mono text-green-600'>{metrics.componentMounts}</span>
                </div>
                <div>
                  <span className='text-gray-600 dark:text-gray-400'>Unmounted:</span>
                  <span className='ml-1 font-mono text-red-600'>{metrics.componentUnmounts}</span>
                </div>
              </div>
            </div>

            {/* Memory Usage */}
            {metrics.memoryUsage > 0 && (
              <div className='border-b border-gray-200 dark:border-gray-600 pb-2'>
                <h4 className='font-medium text-gray-700 dark:text-gray-300 mb-1'>Memory Usage</h4>
                <div className='text-sm'>
                  <span className='text-gray-600 dark:text-gray-400'>Heap:</span>
                  <span
                    className={`ml-1 font-mono ${getPerformanceColor(
                      metrics.memoryUsage / (1024 * 1024),
                      { good: 50, warning: 100 }
                    )}`}
                  >
                    {formatBytes(metrics.memoryUsage)}
                  </span>
                </div>
              </div>
            )}

            {/* Performance Tips */}
            <div>
              <h4 className='font-medium text-gray-700 dark:text-gray-300 mb-1'>Quick Tips</h4>
              <div className='text-xs text-gray-600 dark:text-gray-400 space-y-1'>
                {metrics.averageRenderTime > 16 && (
                  <div className='text-yellow-600'>• Consider using React.memo() or useMemo()</div>
                )}
                {metrics.renderCount > 50 && (
                  <div className='text-yellow-600'>
                    • High render count - check unnecessary re-renders
                  </div>
                )}
                {metrics.fps < 50 && (
                  <div className='text-red-600'>• Low FPS detected - performance issue</div>
                )}
                {metrics.memoryUsage / (1024 * 1024) > 100 && (
                  <div className='text-red-600'>• High memory usage - check for memory leaks</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

PerformanceMonitor.displayName = 'PerformanceMonitor';

export default PerformanceMonitor;
