const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const cors = require('cors');
const morgan = require('morgan');

const app = express();
const PORT = process.env.PORT || 8080;

// Прямой URL на твою ноду Webhook (Test URL)
const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL || 'https://lchromel.app.n8n.cloud/webhook-test/task';

// Разрешённые источники (включи null если открываешь HTML как file://)
const ALLOWED = (process.env.ALLOWED_ORIGIN || 'null,http://localhost:3000,https://cors-production-1452.up.railway.app')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

// CORS
app.use(cors({
  origin(origin, cb) {
    if (!origin) return ALLOWED.includes('null') ? cb(null, true) : cb(new Error('CORS: null origin not allowed'));
    if (ALLOWED.includes('*') || ALLOWED.includes(origin)) return cb(null, true);
    return cb(new Error(`CORS blocked: ${origin}`));
  },
  credentials: true,
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization','Accept'],
  maxAge: 86400,
}));
app.options('*', cors());

app.use(morgan('tiny'));

// Прокси: всё, что идёт на /task, перенаправляем в твой Webhook
app.use(
  '/task',
  createProxyMiddleware({
    target: N8N_WEBHOOK_URL,
    changeOrigin: true,
    secure: true,
    xfwd: true,
    pathRewrite: () => '', // удаляем /task из пути, так как он уже в target
    onProxyReq(proxyReq, req) {
      console.log(`[PROXY] ${req.method} ${req.originalUrl} → ${N8N_WEBHOOK_URL}`);
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

app.listen(PORT, () => {
  console.log(`Proxy running on :${PORT}`);
  console.log(`→ Forwarding /task → ${N8N_WEBHOOK_URL}`);
});
