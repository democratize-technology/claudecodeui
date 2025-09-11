/**
 * Tests for comparison utilities
 */

import { deepEqual, deepNotEqual } from '../../utils/comparison';

describe('deepEqual', () => {
  test('handles primitive values', () => {
    expect(deepEqual(1, 1)).toBe(true);
    expect(deepEqual('test', 'test')).toBe(true);
    expect(deepEqual(true, true)).toBe(true);
    expect(deepEqual(null, null)).toBe(true);
    expect(deepEqual(undefined, undefined)).toBe(true);

    expect(deepEqual(1, 2)).toBe(false);
    expect(deepEqual('test', 'other')).toBe(false);
    expect(deepEqual(true, false)).toBe(false);
    expect(deepEqual(null, undefined)).toBe(false);
  });

  test('handles arrays', () => {
    expect(deepEqual([1, 2, 3], [1, 2, 3])).toBe(true);
    expect(deepEqual([], [])).toBe(true);
    expect(deepEqual([1, [2, 3]], [1, [2, 3]])).toBe(true);

    expect(deepEqual([1, 2, 3], [1, 2, 4])).toBe(false);
    expect(deepEqual([1, 2], [1, 2, 3])).toBe(false);
    expect(deepEqual([1, 2, 3], [1, 3, 2])).toBe(false);
  });

  test('handles objects', () => {
    expect(deepEqual({ a: 1, b: 2 }, { a: 1, b: 2 })).toBe(true);
    expect(deepEqual({ a: 1, b: 2 }, { b: 2, a: 1 })).toBe(true); // Order independent
    expect(deepEqual({}, {})).toBe(true);
    expect(deepEqual({ nested: { a: 1 } }, { nested: { a: 1 } })).toBe(true);

    expect(deepEqual({ a: 1, b: 2 }, { a: 1, b: 3 })).toBe(false);
    expect(deepEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false);
    expect(deepEqual({ a: 1 }, {})).toBe(false);
  });

  test('handles dates', () => {
    const date1 = new Date('2024-01-01');
    const date2 = new Date('2024-01-01');
    const date3 = new Date('2024-01-02');

    expect(deepEqual(date1, date2)).toBe(true);
    expect(deepEqual(date1, date3)).toBe(false);
  });

  test('handles complex nested structures', () => {
    const obj1 = {
      sessionMeta: { id: 1, created: '2024-01-01' },
      sessions: [
        { id: 1, name: 'test' },
        { id: 2, name: 'test2' }
      ],
      cursorSessions: null
    };

    const obj2 = {
      sessionMeta: { id: 1, created: '2024-01-01' },
      sessions: [
        { id: 1, name: 'test' },
        { id: 2, name: 'test2' }
      ],
      cursorSessions: null
    };

    const obj3 = {
      sessionMeta: { id: 1, created: '2024-01-01' },
      sessions: [
        { id: 1, name: 'test' },
        { id: 2, name: 'different' }
      ],
      cursorSessions: null
    };

    expect(deepEqual(obj1, obj2)).toBe(true);
    expect(deepEqual(obj1, obj3)).toBe(false);
  });

  test('performance comparison vs JSON.stringify', () => {
    const largeObj = {
      sessions: Array.from({ length: 100 }, (_, i) => ({ id: i, name: `session-${i}` })),
      meta: { created: '2024-01-01', updated: '2024-01-02' }
    };

    const copy = JSON.parse(JSON.stringify(largeObj));

    // Our function should work correctly with JSON-serializable objects
    expect(deepEqual(largeObj, copy)).toBe(true);

    // And handle edge cases JSON.stringify can't
    const objWithFunction = { a: 1, fn: () => {} };
    const objWithUndefined = { a: 1, b: undefined };

    // JSON.stringify would give incorrect results here
    expect(deepEqual(objWithFunction, { a: 1 })).toBe(false);
    expect(deepEqual(objWithUndefined, { a: 1 })).toBe(false);
  });
});

describe('deepNotEqual', () => {
  test('is inverse of deepEqual', () => {
    expect(deepNotEqual(1, 1)).toBe(false);
    expect(deepNotEqual(1, 2)).toBe(true);
    expect(deepNotEqual({ a: 1 }, { a: 1 })).toBe(false);
    expect(deepNotEqual({ a: 1 }, { a: 2 })).toBe(true);
  });
});
