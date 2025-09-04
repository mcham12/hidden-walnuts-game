import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // AI-friendly environment setup
    environment: 'happy-dom',
    globals: true,
    
    // Clear test organization for AI
    include: [
      'src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'
    ],
    exclude: [
      'src/test/setup.ts'
    ],
    
    // AI-friendly reporting
    reporters: ['verbose', 'html'],
    
    // Easy to understand coverage for AI
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      exclude: [
        'src/test/**',
        '**/*.d.ts',
        '**/*.config.*',
        'dist/**',
        'node_modules/**'
      ],
      // AI-friendly coverage targets
      thresholds: {
        global: {
          branches: 90,
          functions: 90,
          lines: 90,
          statements: 90
        }
      }
    },
    
    // AI-friendly test setup
    setupFiles: ['./src/test/setup.ts'],
    
    // Clear test output for AI
    outputFile: {
      html: './test-results/index.html',
      json: './test-results/results.json'
    }
  },
  
  // Optimize for AI workflow
  define: {
    __TEST__: 'true'
  }
}); 