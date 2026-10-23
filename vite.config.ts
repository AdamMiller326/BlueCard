import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Relative base so the build works at any GitHub Pages path.
  base: './',
  build: { target: 'es2022' },
  test: { include: ['tests/**/*.test.ts'] },
});
