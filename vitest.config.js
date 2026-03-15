import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.{js,jsx,ts,tsx}'],
    environmentMatchGlobs: [
      ['src/**/*.test.{jsx,tsx}', 'jsdom'],
    ],
    fileParallelism: false,
    setupFiles: ['./src/test/setup.js'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{js,jsx,ts,tsx}'],
      exclude: ['src/test/**', 'src/**/*.test.*', 'src/**/__tests__/**'],
    },
  },
})
