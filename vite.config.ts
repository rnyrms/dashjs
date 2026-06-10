import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  root: '.',
  server: {
    port: 5180,
    open: true,
  },
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'dashjs',
      formats: ['es', 'cjs'],
      fileName: (format) => `dashjs.${format === 'es' ? 'mjs' : 'cjs'}`,
    },
    rollupOptions: {
      external: [
        'jspreadsheet',
        'jsuites',
        'lemonadejs',
        'gridstack',
        'highcharts',
        'lucide',
        'tabularjs',
      ],
      output: {
        assetFileNames: 'dashjs[extname]',
      },
    },
    cssCodeSplit: false,
    outDir: 'dist',
    emptyOutDir: true,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: ['src/styles/**', 'src/core/mockData.ts'],
    },
  },
})
