// server.js
// Railway proxy → n8n Webhook (TEST)

const express = require('express');
const morgan = require('morgan');
const cors = require('cors');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();
app.set('trust proxy', true);

const PORT = process.env.PORT || 8080;

// 1) БАЗОВЫЙ ДОМЕН n8n (без /webhook-test/... и без /tasks)
//    Можно переопределить через переменную среды BASE_URL на Railway
const BASE_URL = process.env.BASE_URL || 'https://lchromel.app.n8n.cloud';

// 2) ТВОЙ UUID ИЗ ССЫЛКИ TEST WEBHOOK (фиксируем как просил)
const N8N_TEST_UUID = process.env.N8N_TEST_UUID || '3b4afc7a-204c-463e-89d8-582b91efe4b3';

// 3) Разрешённые источники для CORS
//    Совет: ALLOWED_ORIGIN = null,http://localhost:3000,https://твой-домен
const ALLOWED = (process.env.ALLOWED_ORIGIN || '*')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

const corsOptions = {
  origin(origin, cb) {
    // file:// даёт Origin === null → разрешаем, если явно указано "null" или стоит "*"
    if (!origin) return cb(null, true);
    if (ALLOWED.includes('*')) return cb(null, true);
    if (ALLOWED.includes('null') && origin === 'null') return cb(null, true);
    if (ALLOWED.includes(origin)) return cb(null, true);
    return cb(new Error(`CORS blocked: ${origin}`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  maxAge: 86400,
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

app.use(morgan('tiny'));
app.use(express.json({ limit: '2mb' }));

// Health
app.get('/', (_, res) => res.status(200).send('ok'));
app.get('/health', (_, res) => res.status(200).send('ok'));

// ──────────────────────────────────────────────────────────────
// Прокси: /tasks/*  →  https://lchromel.app.n8n.cloud/webhook-test/<UUID>/tasks/*
// ВАЖНО: pathRewrite оставляем как есть — n8n ждёт префикс /tasks/:action
// ──────────────────────────────────────────────────────────────
app.use(
  '/tasks',
  createProxyMiddleware({
    target: `${BASE_URL}/webhook-test/${N8N_TEST_UUID}`, // без лишнего /tasks в конце
    changeOrigin: true,
    xfwd: true,
    pathRewrite: (path) => path.replace(/^\/tasks/, ''), // убираем префикс /tasks перед отправкой в n8n
    onProxyReq(proxyReq, req, res) {
      if (!proxyReq.getHeader('content-type')) {
        proxyReq.setHeader('content-type', 'application/json');
      }
    },
    onError(err, req, res) {
      console.error('Proxy error:', err?.message);
      if (!res.headersSent) {
        res.status(502).json({ ok: false, error: 'Proxy failed', detail: err?.message });
      }
    },
  })
);


// Fallback 404
app.use((req, res) => {
  res.status(404).json({ ok: false, error: 'Not Found' });
});

app.listen(PORT, () => {
  console.log(`Proxy running on :${PORT}`);
  console.log(`→ Forwarding /tasks/* to ${BASE_URL}/webhook-test/${N8N_TEST_UUID}/tasks/*`);
});
