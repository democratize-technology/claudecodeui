/**
 * Performance optimization hooks for ChatInterface and other heavy components
 * These hooks provide memoized utilities and optimized state management patterns
 */

import { useMemo, useCallback, useRef, useState, useEffect } from 'react';

/**
 * Debounced state hook to reduce re-renders on rapid updates
 * Particularly useful for text input and WebSocket message processing
 */
export function useDebouncedState(initialValue, delay = 100) {
  const [value, setValue] = useState(initialValue);
  const [debouncedValue, setDebouncedValue] = useState(initialValue);
  const timeoutRef = useRef(null);

  const setDebouncedState = useCallback(
    (newValue) => {
      setValue(newValue);

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        setDebouncedValue(newValue);
        timeoutRef.current = null;
      }, delay);
    },
    [delay]
  );

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return [value, debouncedValue, setDebouncedState];
}

/**
 * Batched message updates to reduce ChatInterface re-renders
 * Groups message updates together and processes them in a single batch
 */
export function useBatchedMessageUpdates(batchDelay = 50) {
  const batchRef = useRef([]);
  const timeoutRef = useRef(null);
  const [messages, setMessages] = useState([]);

  const addMessage = useCallback(
    (message) => {
      batchRef.current.push({ type: 'add', payload: message });

      if (!timeoutRef.current) {
        timeoutRef.current = setTimeout(() => {
          const batch = batchRef.current;
          batchRef.current = [];
          timeoutRef.current = null;

          setMessages((prev) => {
            const result = [...prev];
            batch.forEach(({ type, payload }) => {
              if (type === 'add') {
                result.push(payload);
              }
            });
            return result;
          });
        }, batchDelay);
      }
    },
    [batchDelay]
  );

  const updateMessage = useCallback(
    (index, updater) => {
      batchRef.current.push({ type: 'update', payload: { index, updater } });

      if (!timeoutRef.current) {
        timeoutRef.current = setTimeout(() => {
          const batch = batchRef.current;
          batchRef.current = [];
          timeoutRef.current = null;

          setMessages((prev) => {
            const result = [...prev];
            batch.forEach(({ type, payload }) => {
              if (type === 'update') {
                const { index, updater } = payload;
                if (result[index]) {
                  result[index] = updater(result[index]);
                }
              }
            });
            return result;
          });
        }, batchDelay);
      }
    },
    [batchDelay]
  );

  // Cleanup function to prevent memory leaks
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      batchRef.current = [];
    };
  }, []);

  return { messages, addMessage, updateMessage, setMessages };
}

/**
 * Memoized JSON parser with error handling
 * Reduces JSON.parse overhead in message processing
 */
export function useJsonParser() {
  const parseCache = useRef(new Map());

  // Cleanup cache on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      if (parseCache.current) {
        parseCache.current.clear();
      }
    };
  }, []);

  return useCallback((jsonString, fallback = null) => {
    if (typeof jsonString !== 'string') return fallback;

    // Simple cache based on string hash
    const hash =
      jsonString.length + jsonString.charCodeAt(0) + jsonString.charCodeAt(jsonString.length - 1);

    if (parseCache.current.has(hash)) {
      return parseCache.current.get(hash);
    }

    try {
      const parsed = JSON.parse(jsonString);
      // Keep cache size reasonable
      if (parseCache.current.size > 100) {
        parseCache.current.clear();
      }
      parseCache.current.set(hash, parsed);
      return parsed;
    } catch (error) {
      console.warn('JSON parsing failed:', error);
      return fallback;
    }
  }, []);
}

/**
 * Optimized WebSocket message processor
 * Memoizes expensive message transformation operations
 */
export function useMessageProcessor() {
  const parseJson = useJsonParser();

  const processToolInput = useCallback(
    (message) => {
      if (!message.toolInput) return null;

      return parseJson(message.toolInput, message.toolInput);
    },
    [parseJson]
  );

  const formatUsageLimit = useCallback((text) => {
    if (typeof text !== 'string') return text;

    return text.replace(/Claude AI usage limit reached\|(\d{10,13})/g, (match, ts) => {
      let timestampMs = parseInt(ts, 10);
      if (!Number.isFinite(timestampMs)) return match;
      if (timestampMs < 1e12) timestampMs *= 1000;

      const reset = new Date(timestampMs);
      const timeStr = new Intl.DateTimeFormat(undefined, {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
      }).format(reset);

      const offsetMinutesLocal = -reset.getTimezoneOffset();
      const sign = offsetMinutesLocal >= 0 ? '+' : '-';
      const abs = Math.abs(offsetMinutesLocal);
      const offH = Math.floor(abs / 60);
      const offM = abs % 60;
      const gmt = `GMT${sign}${offH}${offM ? `:${String(offM).padStart(2, '0')}` : ''}`;

      const months = [
        'Jan',
        'Feb',
        'Mar',
        'Apr',
        'May',
        'Jun',
        'Jul',
        'Aug',
        'Sep',
        'Oct',
        'Nov',
        'Dec'
      ];
      const dateReadable = `${reset.getDate()} ${months[reset.getMonth()]} ${reset.getFullYear()}`;

      return `Claude usage limit reached. Reset at **${timeStr} ${gmt}** - ${dateReadable}`;
    });
  }, []);

  return { processToolInput, formatUsageLimit };
}

/**
 * Virtual scrolling hook for large message lists
 * Only renders visible messages to improve performance
 */
export function useVirtualScrolling(items, containerHeight = 600, itemHeight = 100) {
  const [scrollTop, setScrollTop] = useState(0);

  const visibleRange = useMemo(() => {
    const startIndex = Math.floor(scrollTop / itemHeight);
    const endIndex = Math.min(
      startIndex + Math.ceil(containerHeight / itemHeight) + 1,
      items.length
    );
    return { startIndex, endIndex };
  }, [scrollTop, itemHeight, containerHeight, items.length]);

  const visibleItems = useMemo(() => {
    return items.slice(visibleRange.startIndex, visibleRange.endIndex).map((item, index) => ({
      ...item,
      originalIndex: visibleRange.startIndex + index
    }));
  }, [items, visibleRange]);

  const handleScroll = useCallback((e) => {
    setScrollTop(e.target.scrollTop);
  }, []);

  return {
    visibleItems,
    totalHeight: items.length * itemHeight,
    offsetY: visibleRange.startIndex * itemHeight,
    handleScroll
  };
}

/**
 * Optimized local storage hook with compression for large data
 * Prevents localStorage quota issues with chat history
 */
export function useOptimizedLocalStorage(key, defaultValue = null, maxItems = 50) {
  const [value, setValue] = useState(() => {
    try {
      const stored = localStorage.getItem(key);
      if (stored) {
        const parsed = JSON.parse(stored);
        // Limit items on load
        if (Array.isArray(parsed) && parsed.length > maxItems) {
          const truncated = parsed.slice(-maxItems);
          localStorage.setItem(key, JSON.stringify(truncated));
          return truncated;
        }
        return parsed;
      }
    } catch (error) {
      console.warn(`Error reading localStorage key ${key}:`, error);
    }
    return defaultValue;
  });

  const setStoredValue = useCallback(
    (newValue) => {
      try {
        setValue(newValue);

        let valueToStore = newValue;

        // Limit array size to prevent localStorage bloat
        if (Array.isArray(newValue) && newValue.length > maxItems) {
          console.warn(`Truncating ${key} from ${newValue.length} to ${maxItems} items`);
          valueToStore = newValue.slice(-maxItems);
        }

        localStorage.setItem(key, JSON.stringify(valueToStore));
      } catch (error) {
        console.error(`Error setting localStorage key ${key}:`, error);

        // Fallback: try to clear some space and retry with minimal data
        if (error.name === 'QuotaExceededError') {
          try {
            if (Array.isArray(newValue) && newValue.length > 10) {
              const minimal = newValue.slice(-10);
              localStorage.setItem(key, JSON.stringify(minimal));
              setValue(minimal);
              console.warn(`Saved minimal ${key} due to quota constraints`);
            }
          } catch (retryError) {
            console.error(`Failed to save even minimal ${key}:`, retryError);
          }
        }
      }
    },
    [key, maxItems]
  );

  return [value, setStoredValue];
}
