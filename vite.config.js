import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    port: 3001,
    strictPort: true,
    open: true, // This will open the browser automatically
  },
  clearScreen: false, // This will prevent Vite from clearing the console
  logLevel: 'info', // This will show more detailed logs
}); 