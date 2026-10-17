import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'dev-default-redirect',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (req.url === '/') {
            res.writeHead(302, { Location: '/react.html' });
            res.end();
            return;
          }
          next();
        });
      },
    },
  ],
  build: {
    rollupOptions: {
      input: {
        react: resolve(import.meta.dirname, 'react.html'),
        vanilla: resolve(import.meta.dirname, 'index.html'),
      },
    },
  },
  server: {
    port: 5173,
    open: false,
  },
});
