# Artha – Financial Research AI

> Live Indian stock market research tool with NSE/BSE data, options chain, futures, bonds, economic indicators, portfolio tracking, and an AI assistant.

![Stack](https://img.shields.io/badge/Frontend-React%20%2B%20Vite-blue) ![Stack](https://img.shields.io/badge/Backend-Python%20FastAPI-green) ![Market](https://img.shields.io/badge/Market-NSE%20%2F%20BSE-orange)

---

## Features

| Module | What it does |
|---|---|
| **Dashboard** | Live Nifty 50, Bank Nifty, Sensex, FIN Nifty, India VIX + top stocks + news sentiment |
| **Stock Analysis** | Quote, technicals (RSI, MACD, Bollinger), fundamentals, TradingView chart |
| **Options** | NSE options chain, Black-Scholes calculator, open interest heatmap |
| **Futures** | Live futures quotes and basis analysis |
| **Bonds** | RBI rates, yield curve, bond ETFs, YTM calculator |
| **Economic Data** | GDP, CPI, currency rates, commodities |
| **Compare** | Side-by-side stock comparison with TradingView charts |
| **Portfolio** | Holdings tracker with live P&L and transactions |
| **Watchlist** | Live quote refresh for saved symbols |
| **Sectors** | IT, Banking, Energy, FMCG, Pharma, Auto comparison |
| **Calculators** | SIP, tax (STCG/LTCG), EMI, insurance, retirement, emergency fund |
| **Wellness** | Financial health score |
| **Brokers** | Zerodha, Upstox, Angel One API key manager |
| **AI Assistant** | Chat with market context |

---

## Tech Stack

### Frontend (`artifacts/artha/`)
- React 19 + Vite 7
- Wouter (client-side routing)
- Tailwind CSS v4 (dark gold theme)
- TradingView embedded widget (charts)
- TypeScript 5.9

### Backend (`backend/`)
- Python 3.11 + FastAPI
- yfinance (market data)
- pandas + numpy (analysis)
- TextBlob (sentiment analysis)
- SQLite (portfolio / watchlist / broker persistence)
- Uvicorn (ASGI server)

---

## Local Development

### Prerequisites
- Node.js 20+, pnpm 9+
- Python 3.11+

### 1. Install dependencies

```bash
# Frontend
pnpm install

# Backend
cd backend
pip install -r requirements.txt
```

### 2. Start backend

```bash
cd backend
python main.py
# Runs on http://localhost:8000
```

### 3. Start frontend

```bash
pnpm --filter @workspace/artha run dev
# Runs on http://localhost:<PORT>
# Vite dev server proxies /api/* → localhost:8000 automatically
```

---

## Deployment

### Backend → Railway

1. Push the repo to GitHub
2. Go to [railway.app](https://railway.app) → **New Project → Deploy from GitHub**
3. Set the **Root Directory** to `backend/`
4. Railway auto-detects the `Dockerfile` and deploys
5. Add environment variables in Railway dashboard:

| Variable | Value |
|---|---|
| `ALLOWED_ORIGINS` | `https://your-app.vercel.app` |
| `ENVIRONMENT` | `production` |

6. Copy your Railway public URL (e.g. `https://artha-backend.up.railway.app`)

### Frontend → Vercel

1. Go to [vercel.com](https://vercel.com) → **New Project → Import from GitHub**
2. Set **Root Directory** to `artifacts/artha`
3. Framework preset: **Vite**
4. Add environment variables in Vercel dashboard:

| Variable | Value |
|---|---|
| `VITE_API_URL` | `https://your-backend.up.railway.app` |

5. Deploy — Vercel handles the build automatically

---

## Environment Variables

### Backend (Railway)
| Variable | Default | Description |
|---|---|---|
| `PORT` | `8000` | Port to listen on (Railway sets this automatically) |
| `ALLOWED_ORIGINS` | `*` | Comma-separated list of allowed frontend origins |
| `ENVIRONMENT` | `production` | App environment |

### Frontend (Vercel)
| Variable | Default | Description |
|---|---|---|
| `VITE_API_URL` | `` (empty) | Full URL of the Railway backend. Empty = use Vite proxy (dev only) |

---

## Project Structure

```
artha/
├── artifacts/
│   └── artha/              # React/Vite frontend
│       ├── src/
│       │   ├── pages/      # One file per route (14 routes)
│       │   ├── components/ # Layout, AuthGate, TradingViewChart
│       │   ├── utils/
│       │   │   └── api.ts  # All fetch calls to the backend
│       │   └── index.css   # Dark gold theme + utility classes
│       ├── index.html
│       └── vite.config.ts
├── backend/                # Python FastAPI backend
│   ├── main.py             # All API routes (/api/v1/*)
│   ├── requirements.txt
│   ├── Dockerfile
│   └── railway.json
└── README.md
```

---

## API Reference

Base URL: `https://financial-research-ai-agent-development-production.up.railway.app`

| Method | Endpoint | Description |
|---|---|---|
| GET | `/health` | Health check |
| GET | `/api/v1/stocks/quote/{symbol}` | Live stock quote |
| GET | `/api/v1/stocks/analyze/{symbol}` | Technical analysis |
| GET | `/api/v1/stocks/historical/{symbol}` | Historical OHLCV data |
| GET | `/api/v1/stocks/market-status` | NSE/BSE market open/closed |
| GET | `/api/v1/options/chain/{symbol}` | Options chain |
| POST | `/api/v1/options/black-scholes` | Black-Scholes pricing |
| GET | `/api/v1/futures/quotes` | Futures quotes |
| GET | `/api/v1/bonds/rbi-rates` | RBI repo/reverse repo rates |
| GET | `/api/v1/bonds/yield-curve` | G-Sec yield curve |
| GET | `/api/v1/economic/indicators` | GDP, CPI, inflation |
| GET | `/api/v1/portfolio` | Portfolio holdings |
| POST | `/api/v1/portfolio/add` | Add holding |
| GET | `/api/v1/watchlist` | Watchlist symbols |
| POST | `/api/v1/watchlist/add` | Add to watchlist |
| POST | `/api/v1/calculators/sip` | SIP returns calculator |
| POST | `/api/v1/calculators/tax` | STCG/LTCG tax calculator |
| POST | `/api/v1/chat/query` | AI assistant |

---

## Notes

- **GIFTNIFTY** returns 503 — this is a Yahoo Finance data gap, not a bug
- Auth is enforced only on the `.replit.app` production domain via Replit Auth headers; dev preview bypasses it automatically
- All market data comes from Yahoo Finance via `yfinance` — subject to rate limits
