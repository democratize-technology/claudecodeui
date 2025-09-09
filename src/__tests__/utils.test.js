import { cn } from '../lib/utils.js';

// Mock clsx and twMerge
jest.mock('clsx', () => ({
  clsx: jest.fn((...args) => {
    // Simple mock that handles arrays and objects like the real clsx
    const flatten = (arr) => {
      return arr.reduce((acc, item) => {
        if (Array.isArray(item)) {
          return acc.concat(flatten(item));
        } else if (item && typeof item === 'object') {
          return acc.concat(Object.keys(item).filter(key => item[key]));
        } else if (item) {
          return acc.concat(item);
        }
        return acc;
      }, []);
    };
    return flatten(args).join(' ');
  }),
}));

jest.mock('tailwind-merge', () => ({
  twMerge: jest.fn((input) => `merged-${input}`),
}));

describe('cn utility function', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should combine class names using clsx and twMerge', () => {
    const result = cn('class1', 'class2');
    
    expect(result).toBe('merged-class1 class2');
  });

  it('should handle conditional classes', () => {
    const result = cn('base-class', true && 'conditional-class', false && 'hidden-class');
    
    expect(result).toBe('merged-base-class conditional-class');
  });

  it('should handle empty inputs', () => {
    const result = cn();
    
    expect(result).toBe('merged-');
  });

  it('should handle undefined and null inputs', () => {
    const result = cn('valid-class', null, undefined, 'another-class');
    
    expect(result).toBe('merged-valid-class another-class');
  });

  it('should handle array inputs', () => {
    const result = cn(['class1', 'class2'], 'class3');
    
    expect(result).toBe('merged-class1 class2 class3');
  });

  it('should handle object inputs', () => {
    const result = cn({
      'active': true,
      'disabled': false,
      'primary': true
    });
    
    expect(result).toBe('merged-active primary');
  });

  it('should handle mixed input types', () => {
    const result = cn(
      'base',
      ['array-class'],
      { 'object-class': true, 'false-class': false },
      null,
      'final'
    );
    
    expect(result).toBe('merged-base array-class object-class final');
  });

  it('should handle template literal classes', () => {
    const variant = 'primary';
    const size = 'large';
    const result = cn(`btn-${variant}`, `size-${size}`);
    
    expect(result).toBe('merged-btn-primary size-large');
  });

  it('should handle boolean expressions in classes', () => {
    const isActive = true;
    const isDisabled = false;
    const result = cn(
      'button',
      isActive ? 'active' : 'inactive',
      isDisabled && 'disabled'
    );
    
    expect(result).toBe('merged-button active');
  });

  it('should work with real clsx and twMerge behavior', () => {
    // Temporarily restore real implementations for integration test
    jest.unmock('clsx');
    jest.unmock('tailwind-merge');
    
    // Re-import to get real implementations
    const { cn: realCn } = require('../lib/utils.js');
    
    // Test with actual Tailwind classes that might conflict
    const result = realCn('px-4', 'px-2', 'py-2', 'py-4');
    
    // twMerge should handle the conflicting padding classes
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
    
    // The exact result depends on twMerge implementation,
    // but it should resolve conflicts and keep the last conflicting class
    expect(result).toContain('px-2');
    expect(result).toContain('py-4');
  });

  it('should handle very long class lists', () => {
    const manyClasses = Array.from({ length: 100 }, (_, i) => `class-${i}`);
    const result = cn(...manyClasses);
    
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('should handle empty string inputs', () => {
    const result = cn('', 'valid-class', '', 'another-class');
    
    expect(result).toBe('merged-valid-class another-class');
  });

  it('should be stable with repeated calls', () => {
    const inputs = ['class1', 'class2', 'class3'];
    const result1 = cn(...inputs);
    const result2 = cn(...inputs);
    
    expect(result1).toBe(result2);
  });
});