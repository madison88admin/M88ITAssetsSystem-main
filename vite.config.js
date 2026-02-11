import { defineConfig } from 'vite';
import { resolve } from 'path';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  // Project root directory
  root: '.',

  // Static assets directory (served at /)
  publicDir: 'public',

  // Plugins
  plugins: [
    tailwindcss(),
  ],

  // Dev server configuration
  server: {
    port: 3000,
    open: '/index.html',
  },

  // Build configuration for multi-page app
  build: {
    outDir: 'dist',

    // SECURITY: Disable source maps in production so original source code
    // is NOT visible in browser DevTools
    sourcemap: false,

    // Minify the output to make code harder to read
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,   // Remove console.log statements
        drop_debugger: true,  // Remove debugger statements
      },
      mangle: true,           // Mangle variable/function names
    },

    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        dashboard: resolve(__dirname, 'src/pages/dashboard.html'),
        assets: resolve(__dirname, 'src/pages/assets.html'),
        employees: resolve(__dirname, 'src/pages/employees.html'),
        assignments: resolve(__dirname, 'src/pages/assignments.html'),
        maintenance: resolve(__dirname, 'src/pages/maintenance.html'),
        'software-licenses': resolve(__dirname, 'src/pages/software-licenses.html'),
        'lost-assets': resolve(__dirname, 'src/pages/lost-assets.html'),
        'audit-logs': resolve(__dirname, 'src/pages/audit-logs.html'),
        reports: resolve(__dirname, 'src/pages/reports.html'),
        settings: resolve(__dirname, 'src/pages/settings.html'),
      },
    },
  },
});
