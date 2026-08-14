import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { initDatabase, processSyncPush, getSyncPull, getPool } from './server/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';
const DIST_DIR = path.join(__dirname, 'dist');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf'
};

/**
 * Lê o corpo JSON da requisição HTTP de forma segura
 */
function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      // Limite de 50MB para suportar lotes com fotos comprimidas
      if (body.length > 50 * 1024 * 1024) {
        req.destroy();
        reject(new Error('Corpo da requisição excede o limite'));
      }
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(new Error('JSON inválido'));
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  });
  res.end(JSON.stringify(data));
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  let safePath = decodeURIComponent(parsedUrl.pathname);

  // Tratar CORS pre-flight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    });
    res.end();
    return;
  }

  // ==========================================
  // API Endpoints
  // ==========================================
  if (safePath.startsWith('/api/')) {
    try {
      // 1. Healthcheck
      if (safePath === '/api/health' && req.method === 'GET') {
        const pool = getPool();
        return sendJson(res, 200, {
          status: 'ok',
          database: pool ? 'connected' : 'offline_mode',
          timestamp: new Date().toISOString()
        });
      }

      // 2. Sync Push (Envia mutações locais para a Cloud)
      if (safePath === '/api/sync/push' && req.method === 'POST') {
        const pool = getPool();
        if (!pool) {
          return sendJson(res, 503, { error: 'Base de dados não configurada no servidor' });
        }
        const { mutations } = await readJsonBody(req);
        if (!Array.isArray(mutations)) {
          return sendJson(res, 400, { error: 'O campo "mutations" deve ser uma lista' });
        }
        const result = await processSyncPush(mutations);
        return sendJson(res, 200, result);
      }

      // 3. Sync Pull (Recebe atualizações de outros técnicos)
      if (safePath === '/api/sync/pull' && req.method === 'GET') {
        const pool = getPool();
        if (!pool) {
          return sendJson(res, 503, { error: 'Base de dados não configurada no servidor' });
        }
        const since = parsedUrl.searchParams.get('since');
        const data = await getSyncPull(since);
        return sendJson(res, 200, data);
      }

      return sendJson(res, 404, { error: 'Endpoint não encontrado' });
    } catch (err) {
      console.error('[API] Erro ao processar rota:', safePath, err);
      return sendJson(res, 500, { error: err.message || 'Erro interno do servidor' });
    }
  }

  // ==========================================
  // Static Files & PWA Handling
  // ==========================================
  let filePath = path.join(DIST_DIR, safePath);
  if (!filePath.startsWith(DIST_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('Acesso proibido');
    return;
  }

  // Se pedir raiz ou diretório, servir index.html
  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, 'index.html');
  }

  // SPA fallback se o ficheiro não existir (e não for um asset com extensão)
  if (!fs.existsSync(filePath)) {
    const ext = path.extname(safePath);
    if (!ext) {
      filePath = path.join(DIST_DIR, 'index.html');
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Ficheiro não encontrado');
      return;
    }
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Ficheiro não encontrado');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    const headers = {
      'Content-Type': contentType,
      'Content-Length': stats.size,
      'X-Content-Type-Options': 'nosniff'
    };

    // Estratégia de Cache para PWA
    if (path.basename(filePath) === 'sw.js') {
      headers['Cache-Control'] = 'no-cache, no-store, must-revalidate';
      headers['Service-Worker-Allowed'] = '/';
    } else if (safePath.startsWith('/assets/')) {
      headers['Cache-Control'] = 'public, max-age=31536000, immutable';
    } else {
      headers['Cache-Control'] = 'public, max-age=3600';
    }

    res.writeHead(200, headers);
    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  });
});

server.listen(PORT, HOST, async () => {
  console.log(`[Railway] Servidor PWA a correr em http://${HOST}:${PORT}`);
  console.log(`[Railway] Diretório estático: ${DIST_DIR}`);
  
  // Tentar inicializar o PostgreSQL se a variável estiver disponível
  await initDatabase();
});
