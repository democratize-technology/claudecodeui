/**
 * Lazy-loaded components for bundle splitting optimization
 * These components wrap heavy dependencies with React.lazy() for code splitting
 */

import React, { Suspense, memo } from 'react';

// Lazy load heavy components with error handling
const LazyCodeEditor = React.lazy(() => 
  import('./CodeEditor.jsx').catch(error => {
    console.error('Failed to load CodeEditor component:', error);
    return {
      default: () => (
        <div className="w-full h-64 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md flex flex-col items-center justify-center text-red-600 dark:text-red-400">
          <p className="mb-2">Failed to load Code Editor</p>
          <button 
            onClick={() => window.location.reload()} 
            className="px-3 py-1 bg-red-100 dark:bg-red-900 rounded text-sm hover:bg-red-200 dark:hover:bg-red-800"
          >
            Reload Page
          </button>
        </div>
      )
    };
  })
);

const LazyShell = React.lazy(() => 
  import('./Shell.jsx').catch(error => {
    console.error('Failed to load Shell component:', error);
    return {
      default: () => (
        <div className="w-full h-96 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md flex flex-col items-center justify-center text-red-600 dark:text-red-400">
          <p className="mb-2">Failed to load Terminal</p>
          <button 
            onClick={() => window.location.reload()} 
            className="px-3 py-1 bg-red-100 dark:bg-red-900 rounded text-sm hover:bg-red-200 dark:hover:bg-red-800"
          >
            Reload Page
          </button>
        </div>
      )
    };
  })
);

const LazyImageViewer = React.lazy(() => 
  import('./ImageViewer.jsx').catch(error => {
    console.error('Failed to load ImageViewer component:', error);
    return {
      default: () => (
        <div className="w-full h-48 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md flex flex-col items-center justify-center text-red-600 dark:text-red-400">
          <p className="mb-2">Failed to load Image Viewer</p>
          <button 
            onClick={() => window.location.reload()} 
            className="px-3 py-1 bg-red-100 dark:bg-red-900 rounded text-sm hover:bg-red-200 dark:hover:bg-red-800"
          >
            Reload Page
          </button>
        </div>
      )
    };
  })
);

// Loading fallbacks optimized for each component type
const CodeEditorFallback = () => (
  <div className="w-full h-64 bg-gray-100 dark:bg-gray-800 rounded-md flex items-center justify-center animate-pulse">
    <div className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2">
      <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      Loading code editor...
    </div>
  </div>
);

const ShellFallback = () => (
  <div className="w-full h-96 bg-black rounded-md flex items-center justify-center">
    <div className="text-sm text-green-400 flex items-center gap-2">
      <div className="w-4 h-4 border-2 border-green-400 border-t-transparent rounded-full animate-spin"></div>
      Initializing terminal...
    </div>
  </div>
);

const ImageViewerFallback = () => (
  <div className="w-full h-48 bg-gray-100 dark:bg-gray-800 rounded-md flex items-center justify-center animate-pulse">
    <div className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2">
      <svg className="w-6 h-6 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
      Loading image viewer...
    </div>
  </div>
);

// Memoized lazy wrapper components
export const OptimizedCodeEditor = memo((props) => (
  <Suspense fallback={<CodeEditorFallback />}>
    <LazyCodeEditor {...props} />
  </Suspense>
));

export const OptimizedShell = memo((props) => (
  <Suspense fallback={<ShellFallback />}>
    <LazyShell {...props} />
  </Suspense>
));

export const OptimizedImageViewer = memo((props) => (
  <Suspense fallback={<ImageViewerFallback />}>
    <LazyImageViewer {...props} />
  </Suspense>
));

// Higher-order component for lazy loading any component
export function withLazyLoading(Component, fallback) {
  const LazyComponent = React.lazy(() => Promise.resolve({ default: Component }));
  
  return memo((props) => (
    <Suspense fallback={fallback || <div>Loading...</div>}>
      <LazyComponent {...props} />
    </Suspense>
  ));
}

// Route-based lazy loading for main app sections with error handling
export const LazyToolsSettings = React.lazy(() => 
  import('./ToolsSettings.jsx')
    .then(module => ({ 
      default: module.default 
    }))
    .catch(error => {
      console.error('Failed to load ToolsSettings component:', error);
      // Return a fallback error component
      return {
        default: () => (
          <div className="p-4 text-center text-red-600 dark:text-red-400">
            <p>Failed to load Tools Settings</p>
            <button 
              onClick={() => window.location.reload()} 
              className="mt-2 px-3 py-1 bg-red-100 dark:bg-red-900 rounded text-sm hover:bg-red-200 dark:hover:bg-red-800"
            >
              Retry
            </button>
          </div>
        )
      };
    })
);

export const LazySidebar = React.lazy(() => 
  import('./Sidebar.jsx')
    .then(module => ({ 
      default: module.default 
    }))
    .catch(error => {
      console.error('Failed to load Sidebar component:', error);
      return {
        default: () => (
          <div className="w-64 h-full bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 p-4 text-center text-red-600 dark:text-red-400">
            <p className="text-sm">Failed to load Sidebar</p>
            <button 
              onClick={() => window.location.reload()} 
              className="mt-2 px-2 py-1 bg-red-100 dark:bg-red-900 rounded text-xs hover:bg-red-200 dark:hover:bg-red-800"
            >
              Retry
            </button>
          </div>
        )
      };
    })
);

export const LazyGitPanel = React.lazy(() => 
  import('./GitPanel.jsx')
    .then(module => ({ 
      default: module.default 
    }))
    .catch(error => {
      console.error('Failed to load GitPanel component:', error);
      return {
        default: () => (
          <div className="w-full h-64 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 p-4 text-center text-red-600 dark:text-red-400">
            <p>Failed to load Git Panel</p>
            <button 
              onClick={() => window.location.reload()} 
              className="mt-2 px-3 py-1 bg-red-100 dark:bg-red-900 rounded text-sm hover:bg-red-200 dark:hover:bg-red-800"
            >
              Retry
            </button>
          </div>
        )
      };
    })
);

// Component wrappers with optimized loading states
export const OptimizedToolsSettings = memo((props) => (
  <Suspense fallback={
    <div className="w-full h-96 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 animate-pulse">
      <div className="p-6">
        <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded mb-4 w-1/3"></div>
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full"></div>
          ))}
        </div>
      </div>
    </div>
  }>
    <LazyToolsSettings {...props} />
  </Suspense>
));

export const OptimizedSidebar = memo((props) => (
  <Suspense fallback={
    <div className="w-64 h-full bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 animate-pulse">
      <div className="p-4 space-y-4">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="h-8 bg-gray-200 dark:bg-gray-700 rounded"></div>
        ))}
      </div>
    </div>
  }>
    <LazySidebar {...props} />
  </Suspense>
));

export const OptimizedGitPanel = memo((props) => (
  <Suspense fallback={
    <div className="w-full h-64 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 animate-pulse">
      <div className="p-4">
        <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded mb-3 w-1/4"></div>
        <div className="space-y-2">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-full"></div>
          ))}
        </div>
      </div>
    </div>
  }>
    <LazyGitPanel {...props} />
  </Suspense>
));

// Preloader utility for critical routes
export const preloadCriticalComponents = () => {
  // Preload components that are likely to be used soon
  const preloadPromises = [
    import('./CodeEditor.jsx'),
    import('./Shell.jsx')
  ];
  
  // Preload in background without waiting
  Promise.all(preloadPromises).catch(error => {
    console.warn('Failed to preload some components:', error);
  });
};

// Component size monitoring (development only)
if (process.env.NODE_ENV === 'development') {
  // Track component bundle sizes for optimization insights
  const trackComponentSize = (componentName, module) => {
    const size = JSON.stringify(module).length;
    if (size > 50000) { // 50KB threshold
      console.warn(`Large component detected: ${componentName} (~${Math.round(size/1024)}KB)`);
    }
  };

  // Example usage would be in dynamic imports:
  // import('./LargeComponent').then(module => {
  //   trackComponentSize('LargeComponent', module);
  //   return module;
  // });
}