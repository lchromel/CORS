// server.js — Railway proxy → n8n Webhook (TEST, explicit routes)

const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const cors = require('cors');
const morgan = require('morgan');

// === CONFIG ===
const PORT = process.env.PORT || 8080;

// БАЗОВЫЙ домен n8n (без /webhook-test/... и без /tasks)
const BASE_URL = process.env.BASE_URL || 'https://lchromel.app.n8n.cloud';

// ТВОЙ UUID ИЗ TEST WEBHOOK (можно вынести в ENV N8N_TEST_UUID)
const N8N_TEST_UUID = process.env.N8N_TEST_UUID || '3b4afc7a-204c-463e-89d8-582b91efe4b3';

// CORS: перечисли источники (обязательно включи `null`, если открываешь HTML как file://)
const ALLOWED = (process.env.ALLOWED_ORIGIN || 'null,http://localhost:3000,https://cors-production-1452.up.railway.app')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

// === APP ===
const app = express();
app.disable('x-powered-by');
app.use(morgan('tiny'));

// ВАЖНО: не ставим body-parsers до прокси, чтобы не съедать поток запроса
const corsOptions = {
  origin(origin, cb) {
    if (!origin) return ALLOWED.includes('null') ? cb(null, true) : cb(new Error('CORS: null origin not allowed'));
    if (ALLOWED.includes('*') || ALLOWED.includes(origin)) return cb(null, true);
    return cb(new Error(`CORS blocked: ${origin}`));
  },
  credentials: true,
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization','Accept','X-API-Key'],
  maxAge: 86400,
};
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// Health
app.get('/', (_, res) => res.status(200).send('ok'));
app.get('/health', (_, res) => res.status(200).send('ok'));

// ===== EXPLICIT ROUTES → N8N TEST WEBHOOK =====
const makeTarget = (action) => `${BASE_URL}/webhook-test/${N8N_TEST_UUID}/tasks/${action}`;

const makeProxy = (action) => createProxyMiddleware({
  target: makeTarget(action),
  changeOrigin: true,
  secure: true,
  xfwd: true,
  // Чтобы было видно конечный URL в логах
  onProxyReq(proxyReq, req) {
    console.log(`[PROXY] ${req.method} ${req.originalUrl} → ${makeTarget(action)}`);
    if (!proxyReq.getHeader('content-type')) {
      proxyReq.setHeader('content-type', 'application/json');
    }
  },
  onError(err, req, res) {
    console.error('Proxy error:', err?.message);
    if (!res.headersSent) res.status(502).json({ ok: false, error: 'Proxy failed', detail: err?.message });
  },
});

// ЯВНОЕ сопоставление путей фронта к экшенам ноды Webhook в n8n:
app.post('/tasks/create',     makeProxy('create'));
app.post('/tasks/status',     makeProxy('status'));
app.post('/tasks/choose',     makeProxy('choose'));
app.post('/tasks/regenerate', makeProxy('regenerate'));

// 404
app.use((req, res) => res.status(404).json({ ok: false, error: 'Not Found' }));

app.listen(PORT, () => {
  console.log(`Proxy running on :${PORT}`);
  console.log(`→ /tasks/* → ${BASE_URL}/webhook-test/${N8N_TEST_UUID}/tasks/:action`);
});
