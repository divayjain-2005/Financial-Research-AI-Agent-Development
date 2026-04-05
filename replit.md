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
- `GET /api/v1/stocks/quote/{symbol}` — live price, P/E, 52-week range
- `GET /api/v1/stocks/historical/{symbol}` — OHLCV history
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

## Environment Variables (optional)

| Variable | Purpose |
|----------|---------|
| `ANTHROPIC_API_KEY` | Enables Claude AI chat (claude-3-5-sonnet) |

## Database

SQLite at `backend/finance.db` — tables: `watchlist`, `portfolio`, `transactions`

## Package Manager

Frontend: `npm` (package-lock.json)
Backend: `pip` (requirements.txt)
