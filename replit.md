# Artha – Financial Research AI

An AI-powered financial research assistant for Indian stock markets (NSE/BSE): live quotes, technical analysis, sentiment, SIP/tax calculators, portfolio & watchlist tracking, sector/futures/bonds/options data, and an AI chat assistant.

## Run & Operate

- `pnpm --filter @workspace/artha run dev` — frontend (Vite, served via the `artifacts/artha: web` workflow)
- The Python backend runs as the `artifacts/api-server: API Server` workflow (see below — it is NOT the Node/Express scaffold)
- Required secret (optional): `CLAUDE_API_KEY` — enables Claude-powered chat responses in `/chat`; without it the assistant falls back to rule-based answers automatically, no error shown to users.

## Stack

- Frontend: React 19 + Vite 7 + wouter + Tailwind v4, in `artifacts/artha` (react-vite artifact)
- Backend: Python 3.12 + FastAPI, in `backend/main.py` — ported as-is from the original Railway-hosted service, NOT rewritten to Node/Express
- Backend persistence: SQLite (`backend/finance.db`, gitignored, recreated on first run)
- Market data: direct calls to Yahoo Finance chart/quoteSummary endpoints (no yfinance package needed)
- Sentiment: TextBlob

## Where things live

- `artifacts/artha/src/pages/*` — one file per feature page (stocks, options, futures, bonds, portfolio, watchlist, chat, etc.)
- `artifacts/artha/src/utils/api.ts` — single fetch client hitting `/api/v1/...` (same-origin via the platform proxy, no `VITE_API_URL` needed)
- `backend/main.py` — the entire FastAPI app (all ~50 routes); `/health` and `/api/health` both work
- `artifacts/api-server/.replit-artifact/artifact.toml` — repurposed to launch the Python backend (`services.development.run` calls `.pythonlibs/bin/python backend/main.py` with absolute paths) instead of the default Node/Express scaffold in `artifacts/api-server/`. The Node scaffold source is unused.

## Architecture decisions

- The project's standard backend slot (`artifacts/api-server`) is normally Node/Express + Drizzle, but the source app's backend is a large, working Python FastAPI service (yfinance-style market data, pandas, TextBlob sentiment). Rewriting ~50 endpoints to Node was judged higher-risk than repurposing the api-server artifact's run command to launch Python directly on the same declared port/path (`/api`, port 8080) — the proxy only cares about the run command, not the language.
- Frontend calls are same-origin (`BASE = ""`) through the platform proxy rather than an external `VITE_API_URL`, since both frontend and backend now live in the same Repl.
