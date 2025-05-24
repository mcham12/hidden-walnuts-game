import { defineConfig, loadEnv } from 'vite';
import { readdirSync } from 'fs';
import { join } from 'path';

export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current directory.
  // Set the third parameter to '' to load all env regardless of the `VITE_` prefix.
  const env = loadEnv(mode, process.cwd(), '');
  
  // More detailed environment logging
  console.log('Vite config - Environment variables:', {
    mode,
    VITE_API_URL: env.VITE_API_URL,
    NODE_ENV: process.env.NODE_ENV,
    // Log all VITE_ prefixed variables
    ...Object.entries(env)
      .filter(([key]) => key.startsWith('VITE_'))
      .reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {})
  });

  // Log public assets to verify copying
  const publicDir = join(process.cwd(), '../public');
  let publicAssets;
  try {
    publicAssets = readdirSync(publicDir, { recursive: true });
    console.log('Public assets found in ../public:', publicAssets);
  } catch (error) {
    console.error('Failed to read ../public:', error);
  }

  // Ensure VITE_API_URL is set in production
  if (mode === 'production' && !env.VITE_API_URL) {
    console.error('❌ VITE_API_URL is not set in production!');
    throw new Error("VITE_API_URL must be set in production!");
  }

  return {
    publicDir: '../public', // Point to game root's public directory
    build: {
      outDir: 'dist',
      // Add source maps for better debugging
      sourcemap: true,
      // Ensure environment variables are properly injected
      rollupOptions: {
        output: {
          manualChunks: undefined
        }
      },
      // Ensure public assets are copied to dist
      assetsInclude: ['**/*.glb', '**/*.txt']
    },
    // Explicitly define environment variables
    define: {
      'import.meta.env.VITE_API_URL': JSON.stringify(env.VITE_API_URL),
      'import.meta.env.MODE': JSON.stringify(mode),
      'import.meta.env.DEV': JSON.stringify(mode === 'development'),
      'import.meta.env.PROD': JSON.stringify(mode === 'production'),
      // Add all VITE_ prefixed environment variables
      ...Object.entries(env)
        .filter(([key]) => key.startsWith('VITE_'))
        .reduce((acc, [key, value]) => ({
          ...acc,
          [`import.meta.env.${key}`]: JSON.stringify(value)
        }), {})
    }
  };
}); 