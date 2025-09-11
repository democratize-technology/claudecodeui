/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: {
    files: [
      './index.html',
      './src/**/*.{js,ts,jsx,tsx}',
      // Include specific paths for better purging
      './src/components/**/*.{js,jsx}',
      './src/contexts/**/*.{js,jsx}',
      './src/hooks/**/*.{js,jsx}',
      './src/utils/**/*.{js,jsx}'
    ],
    // Extract dynamic class names that might be missed
    extract: {
      js: (content) => {
        // Extract classes from template literals and dynamic concatenations
        const matches = content.match(/[\w-/:]+/g) || [];
        return matches.filter(
          (match) =>
            // Common Tailwind patterns
            /^(bg-|text-|border-|p-|m-|w-|h-|flex|grid|hover:|focus:|dark:|md:|lg:|xl:)/.test(
              match
            ) ||
            // Specific UI patterns used in the app
            /^(rounded|shadow|transition|transform|opacity|scale)/.test(match)
        );
      }
    }
  },
  // Safelist critical classes that might be dynamically generated
  safelist: [
    // Status indicator colors
    'bg-green-500',
    'bg-red-500',
    'bg-yellow-500',
    'bg-blue-500',
    'text-green-500',
    'text-red-500',
    'text-yellow-500',
    'text-blue-500',
    // Loading states
    'animate-spin',
    'animate-pulse',
    'animate-bounce',
    // Dynamic sizing for messages and content
    'h-64',
    'h-96',
    'h-full',
    'min-h-screen',
    // Interactive states
    'hover:bg-gray-100',
    'hover:bg-gray-800',
    'focus:ring-2',
    'focus:outline-none',
    // Dark mode variants that might be missed
    'dark:bg-gray-900',
    'dark:bg-gray-800',
    'dark:text-white',
    'dark:border-gray-700'
  ],
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: {
        '2xl': '1400px'
      }
    },
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))'
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))'
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))'
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))'
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))'
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))'
        },
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))'
        }
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)'
      },
      spacing: {
        'safe-area-inset-bottom': 'env(safe-area-inset-bottom)'
      },
      // Add performance-optimized animations
      animation: {
        'fade-in': 'fadeIn 0.2s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'slide-down': 'slideDown 0.3s ease-out'
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' }
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' }
        },
        slideDown: {
          '0%': { transform: 'translateY(-10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' }
        }
      }
    }
  },
  plugins: [
    require('@tailwindcss/typography'),
    // Add plugin for better performance optimizations
    function ({ addUtilities }) {
      const newUtilities = {
        // Hardware acceleration utilities
        '.gpu-accelerated': {
          transform: 'translateZ(0)',
          'backface-visibility': 'hidden',
          perspective: '1000px'
        },
        // Optimized scrolling
        '.smooth-scroll': {
          'scroll-behavior': 'smooth',
          '-webkit-overflow-scrolling': 'touch'
        },
        // Performance-optimized transitions
        '.transition-fast': {
          'transition-duration': '150ms',
          'transition-timing-function': 'cubic-bezier(0.4, 0, 0.2, 1)'
        }
      };
      addUtilities(newUtilities);
    }
  ],
  // Optimize for production builds
  ...(process.env.NODE_ENV === 'production' && {
    // More aggressive purging in production
    content: {
      files: ['./index.html', './src/**/*.{js,jsx}'],
      transform: {
        js: (content) => {
          // Remove comments and optimize for purging
          return content.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
        }
      }
    }
  })
};
