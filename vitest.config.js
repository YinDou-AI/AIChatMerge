import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'happy-dom',
    globals: true,
    include: ['tests/**/*.test.js'],
    exclude: ['node_modules/**', '_codex_release_work/**', 'tests/e2e/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'tests/',
        '**/*.config.js',
        '**/dist/',
        '**/.{idea,git,cache,output,temp}/',
      ],
    },
    setupFiles: ['./tests/setup.js'],
  },
});
