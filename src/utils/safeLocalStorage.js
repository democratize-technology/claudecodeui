/**
 * Safe localStorage wrapper that prevents crashes in private browsing mode
 * and handles JSON parsing errors gracefully.
 *
 * In private browsing mode, localStorage access throws DOMException,
 * which can crash the entire React app if not properly handled.
 */

class SafeLocalStorage {
  constructor() {
    this.isAvailable = this.checkAvailability();
  }

  checkAvailability() {
    try {
      const test = 'localStorage-test';
      localStorage.setItem(test, test);
      localStorage.removeItem(test);
      return true;
    } catch (error) {
      console.warn(
        'localStorage unavailable (private browsing mode or storage disabled):',
        error.message
      );
      return false;
    }
  }

  /**
   * Sanitize a localStorage key to prevent key pollution
   * @param {string} key - The key to sanitize
   * @returns {string} - Sanitized key
   */
  sanitizeKey(key) {
    if (typeof key !== 'string') {
      throw new Error('localStorage key must be a string');
    }

    // Remove dangerous characters and limit length
    return key
      .replace(/[<>"/\\]/g, '') // Remove potential HTML/script chars
      .replace(/\s+/g, '_') // Replace spaces with underscores
      .substring(0, 100); // Limit key length
  }

  /**
   * Safely get item from localStorage with fallback
   * @param {string} key - localStorage key
   * @param {any} fallback - fallback value if key doesn't exist or localStorage unavailable
   * @returns {string|null} - stored value or fallback
   */
  getItem(key, fallback = null) {
    if (!this.isAvailable) {
      return fallback;
    }

    try {
      const sanitizedKey = this.sanitizeKey(key);
      const value = localStorage.getItem(sanitizedKey);
      return value !== null ? value : fallback;
    } catch (error) {
      console.warn(`localStorage.getItem('${key}') failed:`, error.message);
      return fallback;
    }
  }

  /**
   * Safely set item in localStorage
   * @param {string} key - localStorage key
   * @param {string} value - value to store
   * @returns {boolean} - true if successful, false otherwise
   */
  setItem(key, value) {
    if (!this.isAvailable) {
      return false;
    }

    try {
      const sanitizedKey = this.sanitizeKey(key);
      localStorage.setItem(sanitizedKey, value);
      return true;
    } catch (error) {
      if (error.name === 'QuotaExceededError') {
        console.warn('localStorage quota exceeded');
      } else {
        console.warn(`localStorage.setItem('${key}') failed:`, error.message);
      }
      return false;
    }
  }

  /**
   * Safely remove item from localStorage
   * @param {string} key - localStorage key
   * @returns {boolean} - true if successful, false otherwise
   */
  removeItem(key) {
    if (!this.isAvailable) {
      return false;
    }

    try {
      const sanitizedKey = this.sanitizeKey(key);
      localStorage.removeItem(sanitizedKey);
      return true;
    } catch (error) {
      console.warn(`localStorage.removeItem('${key}') failed:`, error.message);
      return false;
    }
  }

  /**
   * Safely get and parse JSON from localStorage with enhanced validation
   * @param {string} key - localStorage key
   * @param {any} fallback - fallback value if key doesn't exist, localStorage unavailable, or JSON invalid
   * @returns {any} - parsed JSON or fallback
   */
  getJSON(key, fallback = null) {
    const stored = this.getItem(key);

    if (stored === null || stored === undefined) {
      return fallback;
    }

    // Basic validation: must be string and reasonable length
    if (typeof stored !== 'string' || stored.length > 100000) {
      console.warn(`Invalid data format for localStorage key '${key}': too large or not string`);
      return fallback;
    }

    try {
      const parsed = JSON.parse(stored);

      // Additional validation: reject functions, symbols, or deeply nested objects
      if (!this.isValidJSONValue(parsed)) {
        console.warn(`Unsafe JSON content detected for localStorage key '${key}'`);
        return fallback;
      }

      return parsed;
    } catch (error) {
      console.warn(`JSON.parse failed for localStorage key '${key}':`, error.message);
      return fallback;
    }
  }

  /**
   * Safely stringify and set JSON in localStorage
   * @param {string} key - localStorage key
   * @param {any} value - value to stringify and store
   * @returns {boolean} - true if successful, false otherwise
   */
  setJSON(key, value) {
    try {
      const stringified = JSON.stringify(value);
      return this.setItem(key, stringified);
    } catch (error) {
      console.warn(`JSON.stringify failed for localStorage key '${key}':`, error.message);
      return false;
    }
  }

  /**
   * Clear all localStorage data (use with caution)
   * @returns {boolean} - true if successful, false otherwise
   */
  clear() {
    if (!this.isAvailable) {
      return false;
    }

    try {
      localStorage.clear();
      return true;
    } catch (error) {
      console.warn('localStorage.clear() failed:', error.message);
      return false;
    }
  }

  /**
   * Get all localStorage keys
   * @returns {string[]} - array of keys or empty array if unavailable
   */
  keys() {
    if (!this.isAvailable) {
      return [];
    }

    try {
      return Object.keys(localStorage);
    } catch (error) {
      console.warn('localStorage.keys() failed:', error.message);
      return [];
    }
  }

  /**
   * Validate that a JSON value is safe (no functions, symbols, excessive nesting)
   * @param {any} value - The parsed JSON value to validate
   * @param {number} depth - Current nesting depth (for recursion)
   * @returns {boolean} - true if safe, false otherwise
   */
  isValidJSONValue(value, depth = 0) {
    // Prevent deeply nested objects (potential DoS)
    if (depth > 10) {
      return false;
    }

    // Check for unsafe types
    if (typeof value === 'function' || typeof value === 'symbol') {
      return false;
    }

    // Arrays and objects need recursive validation
    if (Array.isArray(value)) {
      if (value.length > 1000) return false; // Prevent huge arrays
      return value.every(item => this.isValidJSONValue(item, depth + 1));
    }

    if (value !== null && typeof value === 'object') {
      const keys = Object.keys(value);
      if (keys.length > 100) return false; // Prevent huge objects
      return keys.every(key =>
        typeof key === 'string' &&
        key.length < 100 &&
        this.isValidJSONValue(value[key], depth + 1)
      );
    }

    // Primitive values are safe
    return true;
  }

}

// Create singleton instance
const safeLocalStorage = new SafeLocalStorage();

export default safeLocalStorage;

// Named exports for convenience
export const { getItem, setItem, removeItem, getJSON, setJSON, clear, keys } = safeLocalStorage;
