# n8n CORS Proxy (Railway-ready)

A minimal proxy so a local HTML file (or any frontend) can call your n8n webhooks without CORS errors.

## 1) Deploy on Railway
- Create a new project on https://railway.app (Empty Project).
- Upload these files or connect a GitHub repo.
- Set environment variables (Project → Variables):
  - `TARGET` = your n8n base URL, e.g. `https://n8n.example.com`
  - `ALLOWED_ORIGIN` = `*` for quick tests, or a comma-separated allowlist.
    - To allow a local file (`file://`), add `null` (string) to the list, e.g. `null,http://localhost:3000`
- Deploy. Railway will expose a public URL like `https://your-proxy.up.railway.app`.

## 2) Use from your local HTML
In your HTML/JS, set:
```js
const BASE = 'https://your-proxy.up.railway.app/webhook';
```
Keep your HTML local (`file://...`) and it will call Railway, which forwards to your n8n `TARGET`.

## 3) Security notes
- Keep the proxy allowlist tight. By default only `/webhook` is proxied.
- Use API keys in your n8n workflows and pass them via `X-API-Key` header from the frontend.
- Set `ALLOWED_ORIGIN` to specific origins (e.g., `http://localhost:5173,null`) when possible.
- Railway free tiers may sleep; for production move to a dedicated host or keep-alive.

## 4) Run locally (optional)
```bash
npm install
TARGET=https://n8n.example.com ALLOWED_ORIGIN=* npm start
# open http://localhost:8080/health
```
