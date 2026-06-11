# Deploying to Railway (backend) + Vercel (frontend)

This project is split into two services:

- `backend/` — FastAPI Python API → deploy to **Railway**
- `frontend/` — Next.js (pages router) → deploy to **Vercel**

---

## 1. Push the code to GitHub

```bash
git init
git add .
git commit -m "ready for deploy"
git branch -M main
git remote add origin https://github.com/<you>/<repo>.git
git push -u origin main
```

---

## 2. Deploy the backend on Railway

1. Go to https://railway.app → **New Project** → **Deploy from GitHub repo**.
2. Pick this repo.
3. In **Settings → Service**:
   - **Root Directory**: `backend`
   - Railway will auto-detect Python and use `backend/railway.json` + `backend/nixpacks.toml`.
   - Start command (already configured): `uvicorn main:app --host 0.0.0.0 --port $PORT`
4. In **Variables** add:
   - `ALLOWED_ORIGINS` = your Vercel URL (set this **after** step 3, e.g. `https://my-app.vercel.app`). Use `*` temporarily if you want to test before the frontend exists.
   - `ANTHROPIC_API_KEY` = *(optional)* enables Claude-powered chat. Without it, chat falls back to rule-based replies.
5. Hit **Deploy**. Railway will give you a public URL like `https://your-backend.up.railway.app`.
6. Verify it's up: open `https://your-backend.up.railway.app/health` — should return `{"status":"ok",...}`.

> ⚠️ **About SQLite**: the backend uses SQLite (`backend/finance.db`). On Railway, the container filesystem is ephemeral — data resets on every redeploy. To persist watchlist/portfolio data, attach a Railway **Volume** mounted at `/app` (or migrate to Railway's managed Postgres).

---

## 3. Deploy the frontend on Vercel

1. Go to https://vercel.com → **Add New… → Project** → import the same GitHub repo.
2. In the import screen:
   - **Root Directory**: `frontend`
   - Framework preset: **Next.js** (auto-detected)
   - Build command, install command, output directory: leave defaults.
3. In **Environment Variables** add:
   - `NEXT_PUBLIC_API_URL` = the Railway URL from step 2.6 (e.g. `https://your-backend.up.railway.app`)
4. Hit **Deploy**. Vercel will build and give you `https://your-app.vercel.app`.

> No `vercel.json` is needed. Setting **Root Directory = `frontend`** in the Vercel UI tells Vercel where the Next.js app lives, and it auto-detects everything else (install command, build command, output dir, framework). **Do not** add a root-level `vercel.json` with `cd frontend && …` commands — Vercel will already be inside `frontend/` and the `cd` will fail with `exit 1`.

---

## 4. Wire CORS

Once the Vercel URL exists:

1. Go back to Railway → **Variables**.
2. Set `ALLOWED_ORIGINS` = `https://your-app.vercel.app` (comma-separated if you have multiple, e.g. preview + prod).
3. Railway will auto-redeploy.

---

## 5. Verify

- Visit `https://your-app.vercel.app` — dashboard should load NIFTY 50, SENSEX, NIFTY BANK quotes.
- Open browser DevTools → Network — calls go to `https://your-backend.up.railway.app/api/v1/...` and return 200.
- Try the **Calculators** page (SIP, Tax) and **Watchlist** to confirm POST/DELETE work.

---

## Local development (Replit / your machine)

Leave `NEXT_PUBLIC_API_URL` **unset** locally. The Next.js dev server has a rewrite that proxies `/api/v1/*` and `/health` to `http://localhost:8000`, so the same code works in dev and prod with no changes.

## Environment variable summary

| Where | Variable | Value |
|------|----------|-------|
| Railway (backend) | `ALLOWED_ORIGINS` | `https://your-app.vercel.app` |
| Railway (backend) | `ANTHROPIC_API_KEY` | optional, enables Claude chat |
| Vercel (frontend) | `NEXT_PUBLIC_API_URL` | `https://your-backend.up.railway.app` |
