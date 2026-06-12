# Artha – Financial Research AI

Indian stock market research tool with live NSE/BSE data, options chain, futures, bonds, economic indicators, portfolio tracking, watchlist, and an AI assistant.

## Run & Operate

- `pnpm --filter @workspace/artha run dev` — run the React/Vite frontend (port set by `$PORT`)
- `cd backend && python main.py` — run the Python FastAPI backend (port 8000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages

## Stack

- **Frontend**: React 19 + Vite 7, Wouter (routing), Tailwind CSS v4, pnpm workspaces, TypeScript 5.9
- **Backend**: Python FastAPI, yfinance, uvicorn
- **Charts**: TradingView widget (embedded), lightweight-charts

## Where things live

- `artifacts/artha/` — React/Vite frontend artifact
  - `src/pages/` — one file per route (index, stocks, options, futures, bonds, economic-indicators, compare, portfolio, watchlist, sectors, calculators, wellness, brokers, chat)
  - `src/components/` — Layout.tsx, AuthGate.tsx, TradingViewChart.tsx
  - `src/utils/api.ts` — all fetch calls to the Python backend
  - `src/index.css` — all custom CSS variables and utility classes (dark theme)
- `backend/` — Python FastAPI server
  - `main.py` — entrypoint, all API routes under `/api/v1/`

## Architecture decisions

- Vite dev server proxies `/api/*` and `/health` to `http://localhost:8000` — no CORS config needed in dev.
- AuthGate skips the login wall on `.replit.dev` / `localhost` (dev hosts) — Replit Auth headers only land on `.replit.app` production URLs.
- Wouter `<Router base={import.meta.env.BASE_URL}>` handles the artifact's base path prefix automatically.
- TradingViewChart uses the TradingView embedded widget (no API key needed); `toTVSymbol()` converts Yahoo Finance symbols (e.g. `RELIANCE.NS`) to TradingView format (`NSE:RELIANCE`).
- All API utility functions are in `src/utils/api.ts`; `BASE` defaults to `""` (relative URL) so the Vite proxy handles routing to Python.

## Product

- Live market dashboard (Nifty 50, Bank Nifty, Sensex, FIN Nifty, India VIX, top stocks)
- Stock analysis: quote, technicals, fundamentals, TradingView chart
- Options chain viewer + Black-Scholes calculator
- Futures quotes and analysis
- Bonds: RBI rates, yield curve, ETFs, YTM calculator
- Economic indicators, currency rates, commodities
- Portfolio tracker with P&L, transactions
- Watchlist with live quote refresh
- Sector comparison (IT, Banking, Energy, FMCG, Pharma, Auto)
- SIP/tax calculators, debt/EMI, insurance, retirement, emergency fund
- Financial wellness score
- Broker API key manager (Zerodha, Upstox, etc.)
- AI assistant (chat with market context)

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Python backend must be running on port 8000 before the frontend loads (Vite proxy target).
- `GIFTNIFTY` returns 503 from Yahoo Finance — this is an upstream data issue, not a bug.
- `process.env` is not available in Vite — use `import.meta.env.VITE_*` for env vars.
- TradingViewChart must not be SSR'd (it uses `document`); in Next.js it was `dynamic(..., {ssr:false})` — in Vite it's just a direct import (no SSR at all).

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
