import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import packageJson from './package.json';
import { brandingHtml } from './vite-plugins/brandingHtml';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Переменные из .env и из окружения сборки (Docker передаёт их через ENV);
  // окружение сильнее файла — как и у самого Vite.
  const env = { ...loadEnv(mode, __dirname, 'VITE_'), ...process.env };
  // Where the dev server's /api and /health proxies send requests. localhost:8080 is right when
  // Vite and the bot share a host. In docker-compose.dev.yml Vite runs in its own container, where
  // localhost is that container, so the compose file points this at the bot container instead.
  // Deliberately not VITE_-prefixed: it is dev-server config and must not reach the client bundle.
  const devProxyTarget = env.DEV_API_PROXY_TARGET || 'http://localhost:8080';
  return {
    plugins: [
      react(),
      brandingHtml({
        name: env.VITE_APP_NAME ?? '',
        apiUrl: env.VITE_API_URL ?? '',
      }),
    ],
    define: {
      __APP_VERSION__: JSON.stringify(packageJson.version),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
      },
    },
    // Base path - use '/' for standalone Docker deployment
    // Change to '/cabinet/' if serving from a sub-path
    base: '/',
    server: {
      port: 5173,
      host: true,
      // Vite's dev server only trusts the "localhost" Host header by default and
      // 403s anything else, to stop external sites DNS-rebinding into it. We proxy
      // it through Caddy at panel.rookari.com (docker-compose.dev.yml), so that
      // host needs to be allow-listed explicitly. Doesn't affect `vite build` —
      // this only applies to `vite`/`vite dev`.
      allowedHosts: ['panel.rookari.com'],
      proxy: {
        '/api': {
          target: devProxyTarget,
          changeOrigin: true,
          // Strip /api prefix: /api/cabinet/auth -> /cabinet/auth
          rewrite: (path) => path.replace(/^\/api/, ''),
        },
        // The backend serves its liveness endpoint at the host root (not under
        // /api). Proxy it too so the "service unavailable" detection probe hits the
        // real backend in dev instead of the Vite server (which would mask outages).
        '/health': {
          target: devProxyTarget,
          changeOrigin: true,
        },
      },
    },
    build: {
      outDir: 'dist',
      sourcemap: false,
      chunkSizeWarningLimit: 550,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return;
            if (
              id.includes('react-dom') ||
              id.includes('react-router') ||
              id.includes('node_modules/react/')
            )
              return 'vendor-react';
            if (id.includes('@tanstack/react-query')) return 'vendor-query';
            if (id.includes('@tanstack/react-table')) return 'vendor-table';
            if (id.includes('i18next') || id.includes('react-i18next')) return 'vendor-i18n';
            if (id.includes('framer-motion')) return 'vendor-motion';
            if (id.includes('@radix-ui/')) return 'vendor-radix';
            if (id.includes('@dnd-kit/')) return 'vendor-dnd';
            if (id.includes('@telegram-apps/') || id.includes('/@tma.js/'))
              return 'vendor-telegram';
            if (id.includes('/ogl/')) return 'vendor-webgl';
            if (id.includes('/cmdk/')) return 'vendor-cmdk';
            if (id.includes('twemoji') || id.includes('@twemoji/')) return 'vendor-twemoji';
            if (id.includes('/jsencrypt/') || id.includes('@kastov/')) return 'vendor-crypto';
            if (id.includes('@lottiefiles/')) return 'vendor-lottie';
            // Heavy admin-only deps — split so they don't bloat the shared
            // chunks of other lazy admin pages that don't use them.
            if (id.includes('/recharts/') || id.includes('/d3-')) return 'vendor-recharts';
            if (id.includes('@tiptap/') || id.includes('/prosemirror-')) return 'vendor-tiptap';
            if (
              id.includes('/axios/') ||
              id.includes('/zustand/') ||
              id.includes('/clsx/') ||
              id.includes('/tailwind-merge/') ||
              id.includes('class-variance-authority') ||
              id.includes('/dompurify/')
            )
              return 'vendor-utils';
          },
        },
      },
    },
  };
});
