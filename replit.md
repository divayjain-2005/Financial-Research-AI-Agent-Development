# Financial Research AI Agent — Replit Setup

## Architecture

**Two-service app:**
- `frontend/` — Next.js 16 on port 5000 (webview)
- `backend/` — FastAPI (Python) on port 8000 (console)

Frontend proxies all `/backend/*` requests to the Python backend via Next.js rewrites (no hardcoded URLs).

## Workflows

| Name | Command | Port |
|------|---------|------|
| Start application | `cd frontend && npm run dev` | 5000 |
| Backend API | `cd backend && python main.py` | 8000 |

## Backend — All 8 Weeks Implemented (`backend/main.py`)

### Week 1-2 · Foundation
- Indian stock quotes via `yfinance` (`.NS` for NSE, `.BO` for BSE)
- **Demo data fallback** — 20+ pre-loaded stocks + indices serve instantly when yfinance network calls fail
- **Circuit breaker** — after first yfinance failure, skips network for 10 min; subsequent calls return in ~100ms
- `GET /api/v1/stocks/quote/{symbol}` — live price, P/E, 52-week range (includes `"demo": true/false`)
- `GET /api/v1/stocks/historical/{symbol}` — OHLCV history (synthetic fallback using seeded randomness)
- `GET /api/v1/stocks/market-status` — NSE/BSE open/closed with IST time
- In-memory cache with TTL (avoids redundant API calls)

### Week 3-4 · Core Financial Agent
- `GET /api/v1/stocks/analyze/{symbol}` — SMA20/50, EMA20, RSI, MACD, Bollinger Bands + buy/sell signal
- `POST /api/v1/stocks/sentiment` — TextBlob sentiment on any financial text
- `GET /api/v1/stocks/compare?symbols=...` — side-by-side comparison (price, returns, P/E, RSI)
- `POST /api/v1/expenses/add`, `GET /api/v1/expenses` — expense tracking
- `POST /api/v1/budget/set`, `GET /api/v1/budget/summary` — budget management

### Week 5-6 · Domain Specialisation (Indian Markets)
- `GET /api/v1/sectors/compare?sector=IT|Banking|Energy|FMCG|Pharma|Auto`
- `GET /api/v1/stocks/fundamentals/{symbol}` — P/E, P/B, D/E, ROE, margins, growth
- `POST /api/v1/watchlist/add`, `GET /api/v1/watchlist`, `DELETE /api/v1/watchlist/{symbol}` — SQLite-backed watchlist
- `POST /api/v1/portfolio/add`, `GET /api/v1/portfolio` — portfolio with live P&L
- `GET /api/v1/portfolio/transactions`
- `POST /api/v1/calculators/sip` — SIP with step-up, year-wise breakdown
- `POST /api/v1/calculators/tax` — LTCG/STCG tax estimation
- `POST /api/v1/insurance/needs-analysis`
- `POST /api/v1/retirement/corpus-calculation`
- `POST /api/v1/emergency-fund/calculate`
- `POST /api/v1/debt/calculate-emi`, `POST /api/v1/debt/prepayment-strategy`

### Week 6 — AI Chat
- `POST /api/v1/chat/query` — Claude-powered if `ANTHROPIC_API_KEY` env var is set, rule-based fallback otherwise

### Week 7-8 · Production Polish
- `GET /api/v1/wellness/financial-score` — personalised 0-100 wellness score with suggestions
- `GET /api/v1/monitoring/summary` — cache stats, DB counts, market status
- Input validation on all stock symbols
- SQLite persistence at `backend/finance.db`

## Authentication

- Login is gated by **Replit Auth** (Google / Replit account) via the proxy headers `X-Replit-User-*`.
- `/api/v1/auth/me` returns the current user; the frontend `AuthGate` shows a "Sign in with Google" screen until the user is authenticated.
- Sign-out clears the `REPL_AUTH` cookie and reloads.

## Environment Variables (optional)

| Variable | Purpose |
|----------|---------|
| `CLAUDE_API_KEY` | Enables Claude AI chat (claude-3-5-sonnet). Friendly error shown on missing credits / bad key. |

## Production deployment

- Deployment target: **VM**.
- `start_production.sh` boots the FastAPI backend on `:8000`, waits for `/health` to respond, then starts Next.js on `:5000`. This avoids the 404s caused by the frontend serving requests before the backend was ready.
- Build command: `uv sync && cd frontend && npm ci && npm run build`.

## Indices Dashboard

Dashboard shows 7 indices — NIFTY 50, BANK NIFTY, SENSEX, GIFT NIFTY, MIDCAP NIFTY, FIN NIFTY, INDIA VIX.
Each card is clickable and opens a returns modal showing 1d / 1M / 3M / 1y / 5y returns. Powered by a new endpoint `GET /api/v1/stocks/returns/{symbol}` that fetches 5y of daily history and computes period-over-period returns.

## Database

SQLite at `backend/finance.db` — tables: `watchlist`, `portfolio`, `transactions`

## Package Manager

Frontend: `npm` (package-lock.json)
Backend: `pip` (requirements.txt)

## TradingView Charts

Reusable component at `frontend/src/components/TradingViewChart.tsx`.
- Loads TradingView Advanced Chart Widget via script injection on mount
- Symbol auto-mapped from Yahoo Finance format → TradingView format (e.g. `RELIANCE.NS` → `NSE:RELIANCE`, `^NSEI` → `NSE:NIFTY`)
- Timeframe selector: 1m / 5m / 15m / 1h / 1D / 1W / 1M
- Pre-loaded studies: RSI + EMA
- Used in: Stock Analysis (Chart tab), Options (underlying chart toggle), Compare (Individual Charts section)

## Options Chain (Computed)

Yahoo Finance options endpoint (`/v7/finance/options/`) is blocked from Replit servers.
Solution: `_compute_options_chain()` builds a synthetic chain using:
1. Live spot price + 30-day historical volatility fetched via `yfinance`
2. Black-Scholes pricing for all 21 strikes (ATM ± 10)
3. Delta, Gamma, Theta, Vega per contract
4. Simulated bid/ask spread (wider OTM), OI, and volume
Works for all NSE/BSE symbols.
