/**
 * Optimized message component to replace the heavy MessageComponent in ChatInterface
 * Implements aggressive memoization, virtualization, and lazy rendering
 */

import React, { memo, useMemo, lazy, Suspense } from 'react';
import ReactMarkdown from 'react-markdown';
import { useMessageProcessor } from '../hooks/usePerformanceOptimizations';

// Lazy load heavy components only when needed
const LazyCodeBlock = lazy(() => import('./CodeBlock'));
const LazyTodoViewer = lazy(() => import('./TodoViewer'));
const LazyImageViewer = lazy(() => import('./ImageViewer'));

// Memoized utility components
const MessageTimestamp = memo(({ timestamp }) => {
  const formattedTime = useMemo(() => {
    if (!timestamp) return '';

    try {
      const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
      return date.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    } catch {
      return '';
    }
  }, [timestamp]);

  if (!formattedTime) return null;

  return <span className='text-xs text-gray-500 dark:text-gray-400 ml-2'>{formattedTime}</span>;
});

MessageTimestamp.displayName = 'MessageTimestamp';

// Memoized tool input renderer
const ToolInputRenderer = memo(({ toolName, toolInput, isExpanded = false }) => {
  const { processToolInput } = useMessageProcessor();

  const processedInput = useMemo(() => {
    return processToolInput({ toolInput });
  }, [toolInput, processToolInput]);

  const renderContent = useMemo(() => {
    if (!processedInput) return null;

    switch (toolName) {
      case 'Edit':
      case 'Write':
        if (processedInput.file_path && processedInput.old_string && processedInput.new_string) {
          return (
            <div className='mt-2 text-sm'>
              <div className='text-blue-700 dark:text-blue-300 font-medium'>
                📝 {toolName}: {processedInput.file_path.split('/').pop()}
              </div>
              {isExpanded && (
                <Suspense fallback={<div className='animate-pulse h-4 bg-gray-200 rounded'></div>}>
                  <LazyCodeBlock
                    oldCode={processedInput.old_string}
                    newCode={processedInput.new_string}
                    language='diff'
                  />
                </Suspense>
              )}
            </div>
          );
        }
        break;

      case 'TodoWrite':
        if (processedInput.todos && Array.isArray(processedInput.todos)) {
          return (
            <div className='mt-2'>
              <div className='text-blue-700 dark:text-blue-300 font-medium text-sm'>
                📝 Updated todo list ({processedInput.todos.length} items)
              </div>
              {isExpanded && (
                <Suspense fallback={<div className='animate-pulse h-16 bg-gray-200 rounded'></div>}>
                  <LazyTodoViewer todos={processedInput.todos} />
                </Suspense>
              )}
            </div>
          );
        }
        break;

      case 'Bash':
        if (processedInput.command) {
          return (
            <div className='mt-2 text-sm'>
              <div className='bg-gray-900 text-green-400 p-2 rounded font-mono text-xs'>
                $ {processedInput.command}
              </div>
            </div>
          );
        }
        break;

      case 'Read':
        if (processedInput.file_path) {
          const filename = processedInput.file_path.split('/').pop();
          return (
            <div className='bg-blue-50 dark:bg-blue-900/20 border-l-2 border-blue-300 dark:border-blue-600 pl-3 py-1 mb-2 text-sm text-blue-700 dark:text-blue-300'>
              📖 Read {filename}
            </div>
          );
        }
        break;

      default:
        return <div className='mt-2 text-sm text-gray-600 dark:text-gray-400'>🔧 {toolName}</div>;
    }

    return null;
  }, [toolName, processedInput, isExpanded]);

  return renderContent;
});

ToolInputRenderer.displayName = 'ToolInputRenderer';

// Memoized message content renderer
const MessageContent = memo(({ message, isExpanded }) => {
  const { formatUsageLimit } = useMessageProcessor();

  const processedContent = useMemo(() => {
    if (!message.content) return '';

    let content = message.content;

    // Apply usage limit formatting
    content = formatUsageLimit(content);

    // Truncate very long content when not expanded
    if (!isExpanded && content.length > 2000) {
      content = `${content.substring(0, 2000)}... (truncated)`;
    }

    return content;
  }, [message.content, formatUsageLimit, isExpanded]);

  if (!processedContent) return null;

  return (
    <div className='prose prose-sm max-w-none dark:prose-invert'>
      <ReactMarkdown>{processedContent}</ReactMarkdown>
    </div>
  );
});

MessageContent.displayName = 'MessageContent';

// Main optimized message component
const OptimizedMessageComponent = memo(
  ({
    message,
    index,
    prevMessage,
    isVisible = true, // For virtualization
    autoExpandTools = false,
    onImageClick
  }) => {
    // Skip rendering if not visible (virtual scrolling)
    if (!isVisible) {
      return <div className='h-16' />; // Placeholder height
    }

    // Memoize message type styling
    const messageClasses = useMemo(() => {
      const baseClasses = 'mb-4 p-4 rounded-lg break-words';

      switch (message.type) {
        case 'user':
          return `${baseClasses} bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-400`;
        case 'assistant':
          return `${baseClasses} bg-gray-50 dark:bg-gray-800 border-l-4 border-gray-400`;
        case 'tool':
          return `${baseClasses} bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-400`;
        case 'system':
          return `${baseClasses} bg-red-50 dark:bg-red-900/20 border-l-4 border-red-400`;
        default:
          return `${baseClasses} bg-gray-50 dark:bg-gray-800`;
      }
    }, [message.type]);

    // Memoize message header
    const messageHeader = useMemo(() => {
      const typeLabels = {
        user: '👤 You',
        assistant: '🤖 Claude',
        tool: '🔧 Tool',
        system: '⚠️ System'
      };

      return (
        <div className='flex items-center justify-between mb-2'>
          <span className='font-semibold text-sm text-gray-700 dark:text-gray-300'>
            {typeLabels[message.type] || message.type}
          </span>
          <MessageTimestamp timestamp={message.timestamp} />
        </div>
      );
    }, [message.type, message.timestamp]);

    // Memoize tool rendering
    const toolRender = useMemo(() => {
      if (!message.isToolUse || !message.toolName) return null;

      return (
        <ToolInputRenderer
          toolName={message.toolName}
          toolInput={message.toolInput}
          isExpanded={autoExpandTools}
        />
      );
    }, [message.isToolUse, message.toolName, message.toolInput, autoExpandTools]);

    // Memoize image attachments
    const imageAttachments = useMemo(() => {
      if (!message.images || !Array.isArray(message.images) || message.images.length === 0) {
        return null;
      }

      return (
        <div className='grid grid-cols-2 md:grid-cols-3 gap-2 mt-3'>
          {message.images.map((image, imgIndex) => (
            <Suspense
              key={`${index}-img-${imgIndex}`}
              fallback={<div className='aspect-square bg-gray-200 animate-pulse rounded'></div>}
            >
              <LazyImageViewer
                src={image.url}
                alt={image.alt || `Image ${imgIndex + 1}`}
                onClick={() => onImageClick?.(image)}
                className='aspect-square object-cover rounded cursor-pointer hover:opacity-80 transition-opacity'
              />
            </Suspense>
          ))}
        </div>
      );
    }, [message.images, index, onImageClick]);

    return (
      <div className={messageClasses} data-message-index={index} data-message-type={message.type}>
        {messageHeader}

        {toolRender}

        <MessageContent message={message} isExpanded={autoExpandTools} />

        {imageAttachments}

        {/* Streaming indicator */}
        {message.isStreaming && (
          <div className='flex items-center mt-2 text-blue-600 dark:text-blue-400'>
            <div className='w-2 h-2 bg-blue-600 dark:bg-blue-400 rounded-full animate-pulse mr-2'></div>
            <span className='text-sm'>Streaming...</span>
          </div>
        )}

        {/* Error indicator */}
        {message.error && (
          <div className='mt-2 p-2 bg-red-100 dark:bg-red-900/20 border border-red-300 dark:border-red-700 rounded text-red-700 dark:text-red-300 text-sm'>
            Error: {message.error}
          </div>
        )}
      </div>
    );
  }
);

OptimizedMessageComponent.displayName = 'OptimizedMessageComponent';

// Higher-order component for virtual scrolling integration
export const VirtualizedMessage = memo(({ message, style, index, ...props }) => (
  <div style={style}>
    <OptimizedMessageComponent message={message} index={index} {...props} />
  </div>
));

VirtualizedMessage.displayName = 'VirtualizedMessage';

export default OptimizedMessageComponent;
