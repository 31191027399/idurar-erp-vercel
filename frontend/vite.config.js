import path from 'path';

import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default ({ mode }) => {
  process.env = { ...process.env, ...loadEnv(mode, process.cwd()) };

  const proxy_url =
    process.env.VITE_DEV_REMOTE === 'remote'
      ? process.env.VITE_BACKEND_SERVER
      : 'http://localhost:8888/';

  const config = {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
      },
    },
    root: path.resolve(__dirname),
    base: '/',
    build: {
      outDir: path.resolve(__dirname, '../dist'),
      emptyOutDir: true,
    },
    server: {
      port: 3000,
      proxy: {
        '/api': {
          target: proxy_url,
          changeOrigin: true,
          secure: false,
        },
        '/download': {
          target: proxy_url,
          changeOrigin: true,
          secure: false,
        },
        '/public': {
          target: proxy_url,
          changeOrigin: true,
          secure: false,
        },
      },
    },
  };
  return defineConfig(config);
};
