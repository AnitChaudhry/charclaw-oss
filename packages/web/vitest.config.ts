import { defineConfig } from 'vitest/config'
import { resolve } from 'path'
import { readFileSync, existsSync } from 'fs'

// Load packages/web/.env into process.env for tests that touch modules
// which boot Prisma at import time. Silent no-op if the file isn't present.
const envPath = resolve(__dirname, '.env')
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*"?(.*?)"?\s*$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2]
  }
}

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: [
      'lib/core/**/*.test.ts',
      'lib/autopilots/**/*.test.ts',
      'lib/mentions/**/*.test.ts',
      'lib/pins/**/*.test.ts',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: [
        'lib/core/**/*.ts',
        'lib/autopilots/**/*.ts',
        'lib/mentions/**/*.ts',
        'lib/pins/**/*.ts',
      ],
      exclude: ['**/*.test.ts', '**/*.d.ts', '**/index.ts'],
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './'),
    },
  },
})
