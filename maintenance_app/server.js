import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { initDatabase, processSyncPush, getSyncPull, getPool } from './server/db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';
const DIST_DIR = path.join(__dirname, 'dist');

// Segurança da API, sem dependências novas:
// - SYNC_TOKEN: se definido, push/pull exigem `Authorization: Bearer <token>`.
//   Sem ele a API fica aberta como antes (desenvolvimento) e avisa no arranque.
// - CORS_ORIGIN: origem permitida; por omissão '*' (desenvolvimento).
const SYNC_TOKEN = process.env.SYNC_TOKEN || '';
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';
function corsOrigin() { return CORS_ORIGIN; }

// Rate-limit artesanal para a API: 120 pedidos por minuto por IP. Rajadas de
// sincronização cabem; abuso barato não. Só um Map com janela deslizante.
const RATE_LIMIT_MAX = 120;
const RATE_LIMIT_WINDOW_MS = 60_000;
const rateHits = new Map(); // ip -> [epochMs, ...]
function checkRateLimit(ip) {
  const nowMs = Date.now();
  const key = ip || 'unknown';
  let hits = rateHits.get(key);
  if (!hits) {
    hits = [];
    rateHits.set(key, hits);
  }
  while (hits.length && hits[0] <= nowMs - RATE_LIMIT_WINDOW_MS) hits.shift();
  if (hits.length >= RATE_LIMIT_MAX) return false;
  hits.push(nowMs);
  // Higiene ocasional para o Map não crescer com IPs únicos.
  if (rateHits.size > 5000 && Math.random() < 0.01) {
    for (const [k, v] of rateHits) {
      if (!v.length || v[v.length - 1] <= nowMs - RATE_LIMIT_WINDOW_MS) rateHits.delete(k);
    }
  }
  return true;
}

function checkAuth(req) {
  if (!SYNC_TOKEN) return true;
  const h = String(req.headers.authorization || '');
  const a = Buffer.from(h);
  const b = Buffer.from(`Bearer ${SYNC_TOKEN}`);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// Erro HTTP com estado (para o catch da rota responder 4xx em vez de 500).
function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

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
 * Lê o corpo JSON da requisição de forma segura: mede BYTES (não
 * caracteres UTF-16), responde 413 em vez de deixar a ligação pendurada,
 * e rejeita JSON inválido com 400.
 */
const MAX_BODY_BYTES = 50 * 1024 * 1024; // lotes com fotos comprimidas
function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let failed = false;
    req.on('data', chunk => {
      if (failed) return;
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      size += buf.length;
      if (size > MAX_BODY_BYTES) {
        failed = true;
        try { req.destroy(); } catch { /* já está a arder */ }
        reject(httpError(413, 'Corpo da requisição excede o limite de 50 MB'));
        return;
      }
      chunks.push(buf);
    });
    req.on('end', () => {
      if (failed) return;
      if (!chunks.length) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch (err) {
        reject(httpError(400, 'JSON inválido'));
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, statusCode, data) {
  // Erros 5xx nunca vazam detalhe interno (mensagens do pg, stacks):
  // o detalhe fica no log do servidor, o cliente recebe o genérico.
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': corsOrigin(),
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
  };
  if (corsOrigin() !== '*') headers['Vary'] = 'Origin';
  res.writeHead(statusCode, headers);
  res.end(JSON.stringify(data));
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  let safePath;
  try {
    // % malformado fora do try deixava a ligação pendurada (DoS barato).
    safePath = decodeURIComponent(parsedUrl.pathname);
  } catch {
    return sendJson(res, 400, { error: 'Caminho inválido' });
  }

  // Tratar CORS pre-flight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': corsOrigin(),
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
      const clientIp = (req.socket && req.socket.remoteAddress) || 'unknown';
      if (!checkRateLimit(clientIp)) {
        return sendJson(res, 429, { error: 'Demasiados pedidos, tente mais tarde' });
      }

      // Healthcheck aberto de propósito (sondas e diagnóstico); push e
      // pull exigem token quando SYNC_TOKEN está definido.
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
        if (!checkAuth(req)) {
          return sendJson(res, 401, { error: 'Não autorizado' });
        }
        const pool = getPool();
        if (!pool) {
          return sendJson(res, 503, { error: 'Base de dados não configurada no servidor' });
        }
        const { mutations } = await readJsonBody(req);
        if (!Array.isArray(mutations)) {
          return sendJson(res, 400, { error: 'O campo "mutations" deve ser uma lista' });
        }
        // Lote limitado: uma transação gigante prende o pool e esconde erros.
        // O cliente parte a fila em lotes (ver SyncEngine PUSH_CHUNK_SIZE).
        if (mutations.length > 500) {
          return sendJson(res, 400, { error: 'Lote com mais de 500 mutações; parta em lotes' });
        }
        const result = await processSyncPush(mutations);
        return sendJson(res, 200, result);
      }

      // 3. Sync Pull (Recebe atualizações de outros técnicos)
      if (safePath === '/api/sync/pull' && req.method === 'GET') {
        if (!checkAuth(req)) {
          return sendJson(res, 401, { error: 'Não autorizado' });
        }
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
      const status = (err && err.status >= 400 && err.status < 600) ? err.status : 500;
      const message = status === 500 ? 'Erro interno do servidor' : (err.message || 'Pedido inválido');
      return sendJson(res, status, { error: message });
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
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
      'X-Frame-Options': 'DENY'
    };

    // Sem scripts nem estilos em linha no HTML servido (o failsafe do splash
    // já é ficheiro externo): a CSP trava XSS persistente mesmo que um sink
    // escape à revisão. 'unsafe-inline' nos estilos mantém-se porque a app
    // ainda usa style="" — a remoção total é trabalho Q, não de segurança.
    if (contentType.startsWith('text/html')) {
      headers['Content-Security-Policy'] = [
        "default-src 'self'",
        "script-src 'self'",
        "style-src 'self' 'unsafe-inline'",
        'img-src \'self\' data: blob:',
        "font-src 'self'",
        "connect-src 'self'",
        "object-src 'none'",
        "base-uri 'self'",
        "frame-ancestors 'none'"
      ].join('; ');
    }

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
