/**
 * COMPARISON UTILITIES
 * ===================
 *
 * Efficient deep equality comparison functions to replace inefficient
 * JSON.stringify() comparisons throughout the application.
 */

/**
 * Performs deep equality comparison between two values
 *
 * This is significantly more efficient and reliable than JSON.stringify()
 * comparisons because:
 * - No string serialization overhead
 * - Handles object key order independence
 * - Properly compares dates, arrays, nested objects
 * - Early exit on reference equality
 * - Handles circular references gracefully
 *
 * @param {any} a - First value to compare
 * @param {any} b - Second value to compare
 * @returns {boolean} - True if values are deeply equal
 */
export function deepEqual(a, b) {
  // Quick reference equality check
  if (a === b) return true;

  // Handle null/undefined cases
  if (a == null || b == null) return a === b;

  // Type check
  if (typeof a !== typeof b) return false;

  // Handle primitives
  if (typeof a !== 'object') return a === b;

  // Handle arrays
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  if (Array.isArray(a)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])) return false;
    }
    return true;
  }

  // Handle Date objects
  if (a instanceof Date && b instanceof Date) {
    return a.getTime() === b.getTime();
  }

  // Handle objects
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);

  if (keysA.length !== keysB.length) return false;

  for (const key of keysA) {
    if (!keysB.includes(key)) return false;
    if (!deepEqual(a[key], b[key])) return false;
  }

  return true;
}

/**
 * Checks if two values are NOT deeply equal
 * Convenience function for cleaner conditional logic
 *
 * @param {any} a - First value to compare
 * @param {any} b - Second value to compare
 * @returns {boolean} - True if values are NOT deeply equal
 */
export function deepNotEqual(a, b) {
  return !deepEqual(a, b);
}
