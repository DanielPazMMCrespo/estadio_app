import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  publicDir: 'public',
  build: {
    outDir: 'dist',
    target: 'es2022',
    emptyOutDir: true,
    sourcemap: true,
  },
  server: {
    port: 5173,
    host: true,
    watch: {
      ignored: ['**/.limble-ref/**']
    },
    // Sem isto o Vite responde com o index.html a /api/*, e o JSON.parse do
    // syncEngine rebentava no '<' do "<!DOCTYPE". O server.js escuta em
    // process.env.PORT || 3000 e serve /api/health, /api/sync/push e /api/sync/pull.
    proxy: {
      '/api': {
        target: `http://127.0.0.1:${process.env.PORT || 3000}`,
        changeOrigin: true,
        // Servidor em baixo é o caso normal numa app offline-first: responde-se
        // JSON honesto em vez de deixar o proxy devolver HTML ou rebentar.
        configure: (proxy) => {
          proxy.on('error', (err, req, res) => {
            if (!res || res.headersSent || typeof res.writeHead !== 'function') return;
            res.writeHead(503, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ error: 'backend_indisponivel', code: err && err.code }));
          });
        }
      }
    }
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/helpers/setup.js'],
    include: ['tests/unit/**/*.test.js'],
  },
});
