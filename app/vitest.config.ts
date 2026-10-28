// Unit tests for the app's own logic (app/lib). The Functions have their own tests in extensions/*.
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['app/**/*.test.ts'],
    environment: 'node',
  },
});
