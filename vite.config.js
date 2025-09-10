import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ command, mode }) => {
  // Load env file based on `mode` in the current working directory.
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react()],
    server: {
      port: parseInt(env.VITE_PORT) || 5173,
      proxy: {
        '/api': `http://localhost:${env.PORT || 3001}`,
        '/ws': {
          target: `ws://localhost:${env.PORT || 3001}`,
          ws: true
        },
        '/shell': {
          target: `ws://localhost:${env.PORT || 3002}`,
          ws: true
        }
      }
    },
    build: {
      outDir: 'dist',
      // Enable source maps for production debugging
      sourcemap: mode === 'production' ? false : true,
      // Optimize chunks and reduce bundle size
      rollupOptions: {
        output: {
          // Create separate chunks for vendor libraries
          manualChunks: {
            // React core
            'react-vendor': ['react', 'react-dom'],
            // React ecosystem
            'react-ecosystem': ['react-router-dom', 'react-dropzone', 'react-markdown'],
            // UI libraries
            'ui-vendor': ['lucide-react', 'class-variance-authority', 'clsx', 'tailwind-merge'],
            // CodeMirror (large editor dependency)
            'codemirror': [
              '@codemirror/lang-css',
              '@codemirror/lang-html', 
              '@codemirror/lang-javascript',
              '@codemirror/lang-json',
              '@codemirror/lang-markdown',
              '@codemirror/lang-python',
              '@codemirror/theme-one-dark',
              '@uiw/react-codemirror'
            ],
            // Terminal (xterm.js is heavy)
            'terminal': ['xterm', 'xterm-addon-fit', '@xterm/addon-clipboard', '@xterm/addon-webgl']
          },
          // Optimize chunk sizes
          chunkFileNames: (chunkInfo) => {
            const facadeModuleId = chunkInfo.facadeModuleId
              ? chunkInfo.facadeModuleId.split('/').pop().replace('.jsx', '').replace('.js', '')
              : 'chunk';
            return `assets/${facadeModuleId}-[hash].js`;
          }
        },
        // Optimize externals for CDN if needed in future
        external: []
      },
      // Optimize for production
      minify: 'esbuild',
      target: 'es2020',
      // Chunk size warnings (warn if chunks > 500KB)
      chunkSizeWarningLimit: 500,
      // Asset optimization
      assetsInlineLimit: 4096 // Inline assets smaller than 4KB
    },
    // Optimize dependencies
    optimizeDeps: {
      include: [
        'react',
        'react-dom',
        'react-router-dom',
        'lucide-react'
      ],
      exclude: [
        // Large dependencies that should be chunked
        '@codemirror/lang-css',
        '@codemirror/lang-html',
        '@codemirror/lang-javascript',
        '@codemirror/lang-json',
        '@codemirror/lang-markdown',
        '@codemirror/lang-python',
        'xterm',
        '@xterm/addon-webgl'
      ]
    }
  };
});
