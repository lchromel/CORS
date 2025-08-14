const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');

const TARGET = process.env.TARGET; // e.g. https://your-n8n-domain
if (!TARGET) {
  console.error('ERROR: env TARGET is required (e.g., https://n8n.example.com)');
  process.exit(1);
}

const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*'; // e.g. http://localhost:3000 or *
const PORT = process.env.PORT || 8080;

const app = express();

app.disable('x-powered-by');
app.use(helmet());
app.use(compression());
app.use(morgan('tiny'));

// Basic CORS for local files and dev sites
const corsOptions = {
  origin: (origin, cb) => {
    if (ALLOWED_ORIGIN === '*') return cb(null, true);
    const allowed = ALLOWED_ORIGIN.split(',').map(s => s.trim());
    // origin can be undefined for file://
    if (!origin && allowed.includes('null')) return cb(null, true);
    if (origin && allowed.includes(origin)) return cb(null, true);
    return cb(new Error('CORS blocked for origin: ' + origin));
  },
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','X-API-Key','Authorization','Accept'],
  credentials: false,
  maxAge: 600
};
app.use(cors(corsOptions));

// Preflight
app.options('*', cors(corsOptions));

// Health check
app.get('/health', (req, res) => res.json({ ok: true }));

// Strict allowlist of proxied paths (keep it tight)
const proxiedPaths = ['/webhook', '/webhook/'];
proxiedPaths.forEach(base => {
  app.use(base, createProxyMiddleware({
    target: TARGET,
    changeOrigin: true,
    secure: true,
    xfwd: true,
    ws: true,
    preserveHeaderKeyCase: true,
    onProxyReq: (proxyReq, req, res) => {
      // Forward API keys if you use them
      if (req.headers['x-api-key']) {
        proxyReq.setHeader('X-API-Key', req.headers['x-api-key']);
      }
    }
  }));
});

// Optionally proxy everything (uncomment if needed)
// app.use('/', createProxyMiddleware({ target: TARGET, changeOrigin: true }));

app.listen(PORT, () => {
  console.log(`Proxy ready on http://localhost:${PORT} -> ${TARGET}`);
});
