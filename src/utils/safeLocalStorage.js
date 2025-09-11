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
      return localStorage.getItem(key);
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
      localStorage.setItem(key, value);
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
      localStorage.removeItem(key);
      return true;
    } catch (error) {
      console.warn(`localStorage.removeItem('${key}') failed:`, error.message);
      return false;
    }
  }

  /**
   * Safely get and parse JSON from localStorage
   * @param {string} key - localStorage key
   * @param {any} fallback - fallback value if key doesn't exist, localStorage unavailable, or JSON invalid
   * @returns {any} - parsed JSON or fallback
   */
  getJSON(key, fallback = null) {
    const stored = this.getItem(key);

    if (stored === null) {
      return fallback;
    }

    try {
      return JSON.parse(stored);
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
}

// Create singleton instance
const safeLocalStorage = new SafeLocalStorage();

export default safeLocalStorage;

// Named exports for convenience
export const { getItem, setItem, removeItem, getJSON, setJSON, clear, keys } = safeLocalStorage;
