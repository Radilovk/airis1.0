import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react-swc";
import { defineConfig } from "vite";
import { resolve } from 'path'

const projectRoot = process.env.PROJECT_ROOT || import.meta.dirname

// https://vite.dev/config/
export default defineConfig({
  base: process.env.GITHUB_PAGES === 'true' ? '/airis1.0/' : '/',
  plugins: [
    react(),
    tailwindcss(),
    // Plugin to add charset meta tag and ensure proper module loading
    {
      name: 'html-transform',
      transformIndexHtml(html) {
        // Add charset attribute to script tags to ensure proper UTF-8 encoding
        return html.replace(
          /<script type="module"([^>]*)>/g, 
          '<script type="module" charset="UTF-8"$1>'
        );
      }
    }
  ],
  resolve: {
    alias: {
      '@': resolve(projectRoot, 'src')
    }
  },
  optimizeDeps: {
    include: [
      '@dnd-kit/core',
      '@dnd-kit/sortable',
      '@dnd-kit/utilities'
    ]
  },
  build: {
    // Set target for better module support with wider browser compatibility
    target: 'es2020',
    rollupOptions: {
      output: {
        // Ensure consistent chunk naming for better caching
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
        manualChunks: {
          // React vendor chunk
          'react-vendor': ['react', 'react-dom', 'react-error-boundary'],
          
          // UI components vendor chunk
          'ui-vendor': [
            '@radix-ui/react-dialog',
            '@radix-ui/react-tabs',
            '@radix-ui/react-select',
            '@radix-ui/react-accordion',
            '@radix-ui/react-alert-dialog',
            '@radix-ui/react-checkbox',
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-label',
            '@radix-ui/react-popover',
            '@radix-ui/react-progress',
            '@radix-ui/react-radio-group',
            '@radix-ui/react-scroll-area',
            '@radix-ui/react-separator',
            '@radix-ui/react-slider',
            '@radix-ui/react-switch',
            '@radix-ui/react-tooltip',
          ],
          
          // Chart library chunk
          'chart-vendor': ['recharts', 'd3'],
          
          // Icon library chunk
          'icon-vendor': ['@phosphor-icons/react'],
          
          // Animation library chunk
          'animation-vendor': ['framer-motion'],
          
          // Form and validation chunk
          'form-vendor': ['react-hook-form', '@hookform/resolvers', 'zod'],
          
          // Utility chunk
          'utility-vendor': ['date-fns', 'clsx', 'tailwind-merge', 'class-variance-authority'],
        }
      }
    },
    chunkSizeWarningLimit: 1000,
    sourcemap: false, // Disable sourcemaps for smaller build size
  }
});
