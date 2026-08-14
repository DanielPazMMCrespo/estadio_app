import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/helpers/setup.js'],
    include: ['tests/unit/**/*.test.js', 'tests/unit/**/*.test.ts'],
  },
});
