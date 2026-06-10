import { defineConfig } from 'vite'

export default defineConfig({
  root: '.',
  server: {
    port: 5180,
    open: true,
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
