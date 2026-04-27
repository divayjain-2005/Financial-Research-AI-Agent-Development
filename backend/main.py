import sys
import os
import json
import sqlite3
import logging
import time
from pathlib import Path
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any
from enum import Enum
from contextlib import contextmanager

sys.path.insert(0, str(Path(__file__).parent))

from fastapi import FastAPI, HTTPException, Query, Body
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, validator

# ── logging ──────────────────────────────────────────────────────────────────
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="Financial Research AI Agent",
    version="1.0.0",
    description=(
        "AI-powered financial research assistant covering all 8 project weeks: "
        "stock data, technical analysis, sentiment, Indian market tools, "
        "SIP/tax calculations, portfolio tracking, and personal finance planning."
    ),
)

_origins_env = os.getenv("ALLOWED_ORIGINS", "*").strip()
if _origins_env == "*" or not _origins_env:
    _allow_origins = ["*"]
    _allow_credentials = False
else:
    _allow_origins = [o.strip() for o in _origins_env.split(",") if o.strip()]
    _allow_credentials = True

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allow_origins,
    allow_credentials=_allow_credentials,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Simple in-memory cache (Week 1-2: caching / rate-limit awareness) ─────────
_cache: Dict[str, Any] = {}
_cache_ttl: Dict[str, float] = {}
CACHE_DEFAULT_TTL = 300  # 5 minutes

def cache_get(key: str) -> Optional[Any]:
    if key in _cache and time.time() < _cache_ttl.get(key, 0):
        return _cache[key]
    return None

def cache_set(key: str, value: Any, ttl: int = CACHE_DEFAULT_TTL):
    _cache[key] = value
    _cache_ttl[key] = time.time() + ttl

# ── SQLite persistence (Week 5-6: watchlists, portfolio, transactions) ─────────
DB_PATH = Path(__file__).parent / "finance.db"

def get_db():
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    cur = conn.cursor()
    cur.executescript("""
        CREATE TABLE IF NOT EXISTS watchlist (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            symbol TEXT NOT NULL,
            exchange TEXT DEFAULT 'NSE',
            added_at TEXT DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS portfolio (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            symbol TEXT NOT NULL,
            quantity REAL NOT NULL,
            buy_price REAL NOT NULL,
            buy_date TEXT NOT NULL,
            created_at TEXT DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            symbol TEXT NOT NULL,
            txn_type TEXT NOT NULL,
            quantity REAL NOT NULL,
            price REAL NOT NULL,
            txn_date TEXT NOT NULL,
            created_at TEXT DEFAULT (datetime('now'))
        );
        CREATE TABLE IF NOT EXISTS brokers (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            broker TEXT NOT NULL,
            client_id TEXT DEFAULT '',
            api_key TEXT DEFAULT '',
            api_secret TEXT DEFAULT '',
            totp_secret TEXT DEFAULT '',
            redirect_url TEXT DEFAULT '',
            is_active INTEGER DEFAULT 1,
            added_at TEXT DEFAULT (datetime('now'))
        );
    """)
    conn.commit()
    # Migrate old schema if needed (add new columns silently)
    migrations = [
        "ALTER TABLE brokers ADD COLUMN broker TEXT",
        "ALTER TABLE brokers ADD COLUMN client_id TEXT DEFAULT ''",
        "ALTER TABLE brokers ADD COLUMN api_key TEXT DEFAULT ''",
        "ALTER TABLE brokers ADD COLUMN api_secret TEXT DEFAULT ''",
        "ALTER TABLE brokers ADD COLUMN totp_secret TEXT DEFAULT ''",
        "ALTER TABLE brokers ADD COLUMN redirect_url TEXT DEFAULT ''",
        "ALTER TABLE brokers ADD COLUMN is_active INTEGER DEFAULT 1",
    ]
    for m in migrations:
        try:
            conn.execute(m)
            conn.commit()
        except Exception:
            pass
    conn.close()

init_db()

# ── yfinance helper (Week 1-2: Indian stock support) ──────────────────────────
import requests as _requests
from datetime import timezone as _tz

_YF_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept": "application/json,text/html,*/*",
    "Accept-Language": "en-US,en;q=0.9",
    "Referer": "https://finance.yahoo.com/",
}

_PERIOD_TO_RANGE = {
    "1d": "1d", "5d": "5d", "1mo": "1mo", "3mo": "3mo",
    "6mo": "6mo", "1y": "1y", "2y": "2y", "5y": "5y", "max": "max",
}

def _fetch_yf(symbol: str, period: str = "3mo", interval: str = "1d") -> Optional[Dict]:
    cache_key = f"yf2:{symbol}:{period}:{interval}"
    cached = cache_get(cache_key)
    if cached is not None:
        return cached
    try:
        yf_range = _PERIOD_TO_RANGE.get(period, "3mo")
        chart_url = (
            f"https://query1.finance.yahoo.com/v8/finance/chart/{symbol}"
            f"?interval={interval}&range={yf_range}&includePrePost=false"
        )
        r = _requests.get(chart_url, headers=_YF_HEADERS, timeout=10)
        if r.status_code != 200 or not r.text.strip():
            logger.error(f"Yahoo Finance chart HTTP {r.status_code} for {symbol}")
            return None
        data = r.json()
        chart_result = data.get("chart", {}).get("result")
        if not chart_result:
            logger.error(f"No chart result for {symbol}: {data.get('chart',{}).get('error')}")
            return None
        cr = chart_result[0]
        meta = cr.get("meta", {})
        timestamps = cr.get("timestamp", [])
        ohlcv = cr.get("indicators", {}).get("quote", [{}])[0]
        opens = ohlcv.get("open", [])
        highs = ohlcv.get("high", [])
        lows = ohlcv.get("low", [])
        closes = ohlcv.get("close", [])
        volumes = ohlcv.get("volume", [])
        prices = []
        for i, ts in enumerate(timestamps):
            c = closes[i] if i < len(closes) else None
            if c is None:
                continue
            prices.append({
                "date": datetime.fromtimestamp(ts, tz=_tz.utc).strftime("%Y-%m-%d"),
                "open": round(float(opens[i] or c), 2),
                "high": round(float(highs[i] or c), 2),
                "low": round(float(lows[i] or c), 2),
                "close": round(float(c), 2),
                "volume": int(volumes[i] or 0) if i < len(volumes) else 0,
            })
        if not prices:
            return None
        info = {
            "currentPrice": meta.get("regularMarketPrice"),
            "previousClose": meta.get("previousClose") or meta.get("chartPreviousClose"),
            "currency": meta.get("currency", "INR"),
            "exchangeName": meta.get("fullExchangeName", ""),
            "symbol": symbol,
        }
        # Fetch quote summary for richer fundamentals
        try:
            qs_url = (
                f"https://query1.finance.yahoo.com/v10/finance/quoteSummary/{symbol}"
                f"?modules=summaryDetail,defaultKeyStatistics,financialData,quoteType,assetProfile"
            )
            qr = _requests.get(qs_url, headers=_YF_HEADERS, timeout=8)
            if qr.status_code == 200 and qr.text.strip():
                qdata = qr.json().get("quoteSummary", {}).get("result", [{}])[0] or {}
                for section in ("summaryDetail", "defaultKeyStatistics", "financialData", "quoteType", "assetProfile"):
                    for k, v in (qdata.get(section) or {}).items():
                        if isinstance(v, dict) and "raw" in v:
                            info[k] = v["raw"]
                        elif not isinstance(v, dict):
                            info[k] = v
        except Exception as qe:
            logger.warning(f"quoteSummary fetch failed for {symbol}: {qe}")
        result = {"symbol": symbol, "prices": prices, "info": info}
        cache_set(cache_key, result, ttl=300)
        return result
    except Exception as e:
        logger.error(f"_fetch_yf error for {symbol}: {e}")
        return None


def _validate_symbol(symbol: str) -> str:
    """Normalise and validate a stock symbol (Week 7-8: input validation)."""
    symbol = symbol.strip().upper()
    if not symbol:
        raise HTTPException(status_code=400, detail="Stock symbol cannot be empty.")
    if len(symbol) > 20:
        raise HTTPException(status_code=400, detail="Symbol too long.")
    return symbol



# ── Technical-analysis helpers (Week 3-4) ─────────────────────────────────────
def _sma(prices: List[float], period: int) -> Optional[float]:
    if len(prices) < period:
        return None
    return round(sum(prices[-period:]) / period, 2)

def _ema(prices: List[float], period: int) -> Optional[float]:
    if len(prices) < period:
        return None
    k = 2 / (period + 1)
    ema = sum(prices[:period]) / period
    for p in prices[period:]:
        ema = p * k + ema * (1 - k)
    return round(ema, 2)

def _rsi(prices: List[float], period: int = 14) -> Optional[float]:
    if len(prices) < period + 1:
        return None
    deltas = [prices[i] - prices[i - 1] for i in range(1, len(prices))]
    gains = [d for d in deltas[:period] if d > 0]
    losses = [-d for d in deltas[:period] if d < 0]
    avg_gain = sum(gains) / period if gains else 0
    avg_loss = sum(losses) / period if losses else 0
    for d in deltas[period:]:
        avg_gain = (avg_gain * (period - 1) + max(d, 0)) / period
        avg_loss = (avg_loss * (period - 1) + max(-d, 0)) / period
    if avg_loss == 0:
        return 100.0
    rs = avg_gain / avg_loss
    return round(100 - 100 / (1 + rs), 2)

def _macd(prices: List[float]) -> Optional[Dict]:
    if len(prices) < 26:
        return None
    ema12 = _ema(prices, 12)
    ema26 = _ema(prices, 26)
    if ema12 is None or ema26 is None:
        return None
    macd_val = round(ema12 - ema26, 2)
    return {"macd": macd_val, "ema_12": ema12, "ema_26": ema26}

def _bollinger(prices: List[float], period: int = 20) -> Optional[Dict]:
    if len(prices) < period:
        return None
    window = prices[-period:]
    sma = sum(window) / period
    std = (sum((p - sma) ** 2 for p in window) / period) ** 0.5
    return {
        "upper": round(sma + 2 * std, 2),
        "middle": round(sma, 2),
        "lower": round(sma - 2 * std, 2),
    }

def _technicals_summary(closes: List[float], current: float) -> Dict:
    indicators = []

    sma20 = _sma(closes, 20)
    if sma20:
        indicators.append({"indicator": "SMA_20", "value": sma20,
                           "signal": "BUY" if current < sma20 else "SELL"})
    sma50 = _sma(closes, 50)
    if sma50:
        indicators.append({"indicator": "SMA_50", "value": sma50,
                           "signal": "BUY" if current < sma50 else "SELL"})
    ema20 = _ema(closes, 20)
    if ema20:
        indicators.append({"indicator": "EMA_20", "value": ema20,
                           "signal": "BUY" if current < ema20 else "SELL"})
    rsi = _rsi(closes)
    if rsi:
        indicators.append({"indicator": "RSI_14", "value": rsi,
                           "signal": "BUY" if rsi < 30 else "SELL" if rsi > 70 else "HOLD"})
    macd = _macd(closes)
    if macd:
        indicators.append({"indicator": "MACD", "value": macd["macd"],
                           "signal": "BUY" if macd["macd"] > 0 else "SELL"})
    bb = _bollinger(closes)
    if bb:
        sig = "OVERSOLD" if current < bb["lower"] else "OVERBOUGHT" if current > bb["upper"] else "NEUTRAL"
        indicators.append({"indicator": "BOLLINGER", "value": bb["middle"],
                           "upper": bb["upper"], "lower": bb["lower"], "signal": sig})

    buy_c = sum(1 for i in indicators if i["signal"] == "BUY")
    sell_c = sum(1 for i in indicators if i["signal"] == "SELL")
    rec = "BUY" if buy_c > sell_c else "SELL" if sell_c > buy_c else "HOLD"
    confidence = round(abs(buy_c - sell_c) / max(len(indicators), 1), 2)

    return {"indicators": indicators, "recommendation": rec, "confidence": confidence}


# ── Sentiment analysis (Week 3-4: TextBlob) ───────────────────────────────────
def _sentiment(text: str) -> Dict:
    try:
        from textblob import TextBlob
        blob = TextBlob(text)
        pol = blob.sentiment.polarity
        label = "POSITIVE" if pol > 0.1 else "NEGATIVE" if pol < -0.1 else "NEUTRAL"
        return {"score": round(pol, 3), "label": label, "subjectivity": round(blob.sentiment.subjectivity, 3)}
    except Exception:
        return {"score": 0, "label": "NEUTRAL", "subjectivity": 0}


# ── Indian market hours (Week 5-6) ────────────────────────────────────────────
def _market_status() -> Dict:
    import pytz
    ist = pytz.timezone("Asia/Kolkata")
    now_ist = datetime.now(ist)
    is_weekday = now_ist.weekday() < 5
    open_t = now_ist.replace(hour=9, minute=15, second=0, microsecond=0)
    close_t = now_ist.replace(hour=15, minute=30, second=0, microsecond=0)
    is_open = is_weekday and open_t <= now_ist <= close_t
    return {
        "market_open": is_open,
        "current_ist": now_ist.strftime("%Y-%m-%d %H:%M:%S IST"),
        "market_hours": "09:15 - 15:30 IST",
        "trading_days": "Monday - Friday",
        "exchanges": ["NSE", "BSE"],
    }


# ── Indian sector map (Week 5-6) ──────────────────────────────────────────────
SECTOR_STOCKS = {
    "IT": ["TCS.NS", "INFY.NS", "WIPRO.NS", "HCLTECH.NS", "TECHM.NS"],
    "Banking": ["HDFCBANK.NS", "ICICIBANK.NS", "KOTAKBANK.NS", "AXISBANK.NS", "SBIN.NS"],
    "Energy": ["RELIANCE.NS", "ONGC.NS", "NTPC.NS", "POWERGRID.NS", "BPCL.NS"],
    "FMCG": ["HINDUNILVR.NS", "ITC.NS", "NESTLEIND.NS", "BRITANNIA.NS", "DABUR.NS"],
    "Pharma": ["SUNPHARMA.NS", "DRREDDY.NS", "CIPLA.NS", "DIVISLAB.NS", "BIOCON.NS"],
    "Auto": ["MARUTI.NS", "BAJAJ-AUTO.NS", "HEROMOTOCO.NS", "TATAMOTORS.NS", "M&M.NS"],
}

# ── LTCG / STCG tax rates (updated) ──────────────────────────────────────────
LTCG_EQUITY_RATE = 0.125     # 12.5% on gains above ₹1,25,000 (held >= 365 days)
LTCG_EXEMPTION   = 125000    # ₹1,25,000 annual exemption
STCG_EQUITY_RATE = 0.20      # 20% (held < 365 days)
SLAB_RATE        = 0.30      # assumed peak slab rate for debt / bonds
LTCG_BOND_RATE   = 0.125     # 12.5% for listed bonds held >= 365 days

# ── Pydantic models ───────────────────────────────────────────────────────────

class ExpenseCategory(str, Enum):
    FOOD = "Food"; TRANSPORT = "Transport"; UTILITIES = "Utilities"
    ENTERTAINMENT = "Entertainment"; HEALTHCARE = "Healthcare"
    SHOPPING = "Shopping"; EDUCATION = "Education"; OTHER = "Other"

class Expense(BaseModel):
    amount: float
    category: ExpenseCategory
    description: str
    date: str
    payment_method: Optional[str] = "Cash"

class Budget(BaseModel):
    category: ExpenseCategory
    monthly_limit: float
    current_month_spent: Optional[float] = 0

class RetirementPlan(BaseModel):
    current_age: int; retirement_age: int
    current_savings: float; monthly_savings: float
    expected_return: float; annual_expense: float

class InsurancePlan(BaseModel):
    age: int; annual_income: float
    dependents: int; existing_coverage: float

class DebtDetails(BaseModel):
    debt_type: str; principal_amount: float
    interest_rate: float; tenure_months: int
    monthly_emi: Optional[float] = None

class EmergencyFund(BaseModel):
    monthly_expenses: float; months_covered: int = 6

class SIPRequest(BaseModel):
    monthly_amount: float
    annual_return: float
    years: int
    step_up_percent: Optional[float] = 0  # annual increase in SIP amount

class TaxRequest(BaseModel):
    buy_price: float
    sell_price: float
    quantity: float
    holding_days: int
    asset_type: str = "equity"  # equity | debt | gold

class WatchlistItem(BaseModel):
    symbol: str
    exchange: str = "NSE"

class BrokerAccount(BaseModel):
    broker: str
    client_id: Optional[str] = ""
    api_key: Optional[str] = ""
    api_secret: Optional[str] = ""
    totp_secret: Optional[str] = ""
    redirect_url: Optional[str] = ""

class PortfolioItem(BaseModel):
    symbol: str
    quantity: float
    buy_price: float
    buy_date: str

class ChatRequest(BaseModel):
    message: str
    context: Optional[str] = None

# ── In-memory stores (personal finance) ──────────────────────────────────────
expenses_db: Dict = {}
budgets_db: Dict = {}

# ══════════════════════════════════════════════════════════════════════════════
#  ROOT
# ══════════════════════════════════════════════════════════════════════════════
@app.get("/")
async def root():
    return {
        "name": "Financial Research AI Agent",
        "version": "1.0.0",
        "weeks_covered": "1-8",
        "features": [
            "Stock Quotes & Historical Data (yfinance / NSE / BSE)",
            "Technical Analysis: SMA, EMA, RSI, MACD, Bollinger Bands",
            "Sentiment Analysis (TextBlob)",
            "Stock Comparison & Sector Analysis",
            "Indian Market Hours",
            "SIP Calculator (with Step-Up)",
            "LTCG / STCG Tax Calculator",
            "Watchlist (SQLite)",
            "Portfolio Tracking & P&L",
            "AI Chat Assistant (Claude, optional)",
            "Expense Tracking & Budget Management",
            "Debt / EMI Calculator",
            "Insurance Needs Analysis",
            "Retirement Corpus Planner",
            "Emergency Fund Calculator",
            "Financial Wellness Score",
        ],
    }

@app.get("/health")
async def health():
    return {"status": "healthy", "version": "1.0.0", "timestamp": datetime.utcnow().isoformat()}


# ── Auth (Replit Auth — read user from proxy headers) ─────────────────────────
from fastapi import Request

@app.get("/api/v1/auth/me")
async def auth_me(request: Request):
    """
    Returns the current logged-in user (via Replit Auth proxy headers).
    Frontend uses this to gate access. Returns 401 when not authenticated.
    """
    user_id = request.headers.get("x-replit-user-id", "")
    user_name = request.headers.get("x-replit-user-name", "")
    user_roles = request.headers.get("x-replit-user-roles", "")
    user_url = request.headers.get("x-replit-user-url", "")
    user_bio = request.headers.get("x-replit-user-bio", "")
    user_profile_image = request.headers.get("x-replit-user-profile-image", "")
    if not user_id or not user_name:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return {
        "id": user_id,
        "name": user_name,
        "roles": [r for r in user_roles.split(",") if r],
        "url": user_url,
        "bio": user_bio,
        "profile_image": user_profile_image,
    }


# ══════════════════════════════════════════════════════════════════════════════
#  WEEK 1-2 — Stock price chatbot & Indian stock support
# ══════════════════════════════════════════════════════════════════════════════

@app.get("/api/v1/stocks/quote/{symbol}")
async def get_stock_quote(symbol: str):
    """
    Get current stock quote for any symbol.
    Use .NS suffix for NSE (e.g. RELIANCE.NS) and .BO for BSE (e.g. RELIANCE.BO).
    """
    symbol = _validate_symbol(symbol)
    data = _fetch_yf(symbol, period="5d", interval="1d")
    if not data or not data["prices"]:
        raise HTTPException(status_code=503, detail="Live market data is currently unavailable. Please try again later.")
    latest = data["prices"][-1]
    prev = data["prices"][-2] if len(data["prices"]) > 1 else latest
    change = round(latest["close"] - prev["close"], 2)
    change_pct = round(change / prev["close"] * 100, 2) if prev["close"] else 0
    info = data.get("info", {})
    return {
        "symbol": symbol,
        "company_name": info.get("longName") or info.get("shortName") or symbol.split(".")[0],
        "current_price": latest["close"],
        "open": latest["open"],
        "high": latest["high"],
        "low": latest["low"],
        "previous_close": prev["close"],
        "change": change,
        "change_percent": change_pct,
        "volume": latest["volume"],
        "market_cap": info.get("marketCap"),
        "pe_ratio": info.get("trailingPE") or info.get("forwardPE"),
        "fifty_two_week_high": info.get("fiftyTwoWeekHigh"),
        "fifty_two_week_low": info.get("fiftyTwoWeekLow"),
        "currency": info.get("currency", "INR"),
        "exchange": info.get("exchange", "NSE"),
        "timestamp": datetime.utcnow().isoformat(),
    }


@app.get("/api/v1/stocks/historical/{symbol}")
async def get_historical_data(
    symbol: str,
    period: str = Query("3mo", description="1mo | 3mo | 6mo | 1y | 2y | 5y"),
    interval: str = Query("1d", description="1d | 1wk | 1mo"),
):
    """Historical OHLCV data for a stock."""
    symbol = _validate_symbol(symbol)
    data = _fetch_yf(symbol, period=period, interval=interval)
    if not data or not data["prices"]:
        raise HTTPException(status_code=503, detail="Live market data is currently unavailable. Please try again later.")
    return {
        "symbol": symbol,
        "period": period,
        "interval": interval,
        "count": len(data["prices"]),
        "data": data["prices"],
    }


@app.get("/api/v1/stocks/returns/{symbol}")
async def get_stock_returns(symbol: str):
    """
    Returns the price change over multiple horizons (1d, 1M, 3M, 1y, 5y).
    Uses 5y of daily data to compute period-over-period returns.
    """
    symbol = _validate_symbol(symbol)
    data = _fetch_yf(symbol, period="5y", interval="1d")
    if not data or not data["prices"]:
        raise HTTPException(
            status_code=503,
            detail="Historical data is currently unavailable for this symbol.",
        )
    prices = data["prices"]
    closes = [p["close"] for p in prices]
    dates = [p["date"] for p in prices]
    current = closes[-1]

    # Approximate trading-day offsets
    HORIZONS = [
        ("1d", 1),
        ("1M", 22),
        ("3M", 66),
        ("1y", 252),
        ("5y", len(closes) - 1),
    ]
    out = []
    for label, offset in HORIZONS:
        idx = max(0, len(closes) - 1 - offset)
        if idx == len(closes) - 1:
            out.append({"period": label, "available": False})
            continue
        ref = closes[idx]
        change = round(current - ref, 2)
        change_pct = round((current - ref) / ref * 100, 2) if ref else 0
        out.append({
            "period": label,
            "available": True,
            "from_date": dates[idx],
            "from_price": ref,
            "to_date": dates[-1],
            "to_price": current,
            "change": change,
            "change_percent": change_pct,
        })

    return {
        "symbol": symbol,
        "current_price": current,
        "currency": data.get("info", {}).get("currency", "INR"),
        "returns": out,
        "timestamp": datetime.utcnow().isoformat(),
    }


@app.get("/api/v1/stocks/market-status")
async def market_status():
    """Check if NSE/BSE is currently open."""
    return _market_status()


# ══════════════════════════════════════════════════════════════════════════════
#  WEEK 3-4 — Technical analysis, sentiment, comparison, portfolio analytics
# ══════════════════════════════════════════════════════════════════════════════

@app.get("/api/v1/stocks/analyze/{symbol}")
async def analyze_stock(symbol: str):
    """
    Comprehensive stock analysis: technicals (SMA, EMA, RSI, MACD, Bollinger)
    + fundamental snapshot + buy/sell recommendation.
    """
    symbol = _validate_symbol(symbol)
    data = _fetch_yf(symbol, period="1y", interval="1d")
    if not data or not data["prices"]:
        raise HTTPException(status_code=503, detail="Live market data is currently unavailable. Please try again later.")
    closes = [p["close"] for p in data["prices"]]
    current = closes[-1]
    info = data.get("info", {})
    technicals = _technicals_summary(closes, current)
    return {
        "symbol": symbol,
        "company_name": info.get("longName") or symbol.split(".")[0],
        "current_price": current,
        "sector": info.get("sector", "N/A"),
        "industry": info.get("industry", "N/A"),
        "pe_ratio": info.get("trailingPE"),
        "pb_ratio": info.get("priceToBook"),
        "dividend_yield": info.get("dividendYield"),
        "market_cap": info.get("marketCap"),
        "debt_to_equity": info.get("debtToEquity"),
        "roe": info.get("returnOnEquity"),
        "revenue_growth": info.get("revenueGrowth"),
        "technicals": technicals,
        "analysis_date": datetime.utcnow().isoformat(),
        "disclaimer": "This is not financial advice. Consult a SEBI-registered advisor.",
    }


@app.post("/api/v1/stocks/sentiment")
async def stock_sentiment(text: str = Body(..., embed=True)):
    """Analyse sentiment of any financial news or text (TextBlob)."""
    if not text.strip():
        raise HTTPException(status_code=400, detail="Text cannot be empty.")
    result = _sentiment(text)
    return {
        "text_preview": text[:120] + ("…" if len(text) > 120 else ""),
        **result,
        "interpretation": {
            "POSITIVE": "Bullish signal — text reflects optimism.",
            "NEGATIVE": "Bearish signal — text reflects concern.",
            "NEUTRAL": "No strong directional bias.",
        }.get(result["label"], ""),
    }


@app.get("/api/v1/stocks/compare")
async def compare_stocks(
    symbols: str = Query(..., example="RELIANCE.NS,TCS.NS,INFY.NS"),
):
    """Compare multiple stocks side-by-side."""
    symbol_list = [_validate_symbol(s) for s in symbols.split(",")]
    if len(symbol_list) > 10:
        raise HTTPException(status_code=400, detail="Maximum 10 symbols allowed.")
    results = []
    for sym in symbol_list:
        data = _fetch_yf(sym, period="1y", interval="1d")
        if not data or not data["prices"]:
            results.append({"symbol": sym, "error": "Live market data unavailable"})
            continue
        closes = [p["close"] for p in data["prices"]]
        current = closes[-1]
        week_ago = closes[-5] if len(closes) >= 5 else closes[0]
        month_ago = closes[-21] if len(closes) >= 21 else closes[0]
        year_ago = closes[0]
        info = data["info"]
        results.append({
            "symbol": sym,
            "company": info.get("longName") or sym.split(".")[0],
            "price": current,
            "change_1w_pct": round((current - week_ago) / week_ago * 100, 2),
            "change_1m_pct": round((current - month_ago) / month_ago * 100, 2),
            "change_1y_pct": round((current - year_ago) / year_ago * 100, 2),
            "pe_ratio": info.get("trailingPE"),
            "market_cap": info.get("marketCap"),
            "sector": info.get("sector"),
            "rsi": _rsi(closes),
            "recommendation": _technicals_summary(closes, current)["recommendation"],
        })
    return {"symbols": symbol_list, "comparison": results, "timestamp": datetime.utcnow().isoformat()}


# ══════════════════════════════════════════════════════════════════════════════
#  WEEK 5-6 — NSE/BSE, Watchlist (SQLite), Fundamental analysis,
#              Sector comparison, SIP, LTCG/STCG
# ══════════════════════════════════════════════════════════════════════════════

# --- Sector Comparison -------------------------------------------------------
@app.get("/api/v1/sectors/compare")
async def sector_compare(sector: str = Query("IT", description="IT | Banking | Energy | FMCG | Pharma | Auto")):
    """Compare all stocks within an Indian market sector. Falls back to demo data when live data unavailable."""
    stocks = SECTOR_STOCKS.get(sector)
    if not stocks:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown sector. Available: {list(SECTOR_STOCKS.keys())}",
        )
    results = []
    for sym in stocks:
        data = _fetch_yf(sym, period="3mo", interval="1d")
        if not data or not data["prices"]:
            continue
        closes = [p["close"] for p in data["prices"]]
        current = closes[-1]
        start = closes[0]
        info = data["info"]
        results.append({
            "symbol": sym,
            "company": info.get("longName") or sym.split(".")[0],
            "price": current,
            "return_3m_pct": round((current - start) / start * 100, 2),
            "pe_ratio": info.get("trailingPE"),
            "market_cap": info.get("marketCap"),
            "recommendation": _technicals_summary(closes, current)["recommendation"],
        })
    results.sort(key=lambda x: x.get("return_3m_pct", 0), reverse=True)
    if not results:
        raise HTTPException(status_code=503, detail="Live market data is currently unavailable. Please try again later.")
    return {
        "sector": sector,
        "stocks_analysed": len(results),
        "data": results,
        "top_performer": results[0]["symbol"] if results else None,
    }

@app.get("/api/v1/sectors/list")
async def list_sectors():
    """List all tracked Indian market sectors."""
    return {sector: stocks for sector, stocks in SECTOR_STOCKS.items()}


# --- Watchlist (SQLite) -------------------------------------------------------
@app.post("/api/v1/watchlist/add")
async def add_to_watchlist(item: WatchlistItem):
    item.symbol = _validate_symbol(item.symbol)
    conn = get_db()
    try:
        conn.execute(
            "INSERT OR IGNORE INTO watchlist (symbol, exchange) VALUES (?, ?)",
            (item.symbol, item.exchange.upper()),
        )
        conn.commit()
    finally:
        conn.close()
    return {"status": "added", "symbol": item.symbol, "exchange": item.exchange.upper()}

@app.get("/api/v1/watchlist")
async def get_watchlist():
    conn = get_db()
    try:
        rows = conn.execute("SELECT * FROM watchlist ORDER BY added_at DESC").fetchall()
    finally:
        conn.close()
    return {"watchlist": [dict(r) for r in rows]}

@app.delete("/api/v1/watchlist/{symbol}")
async def remove_from_watchlist(symbol: str):
    symbol = _validate_symbol(symbol)
    conn = get_db()
    try:
        conn.execute("DELETE FROM watchlist WHERE symbol = ?", (symbol,))
        conn.commit()
    finally:
        conn.close()
    return {"status": "removed", "symbol": symbol}


# --- Portfolio Tracking -------------------------------------------------------
@app.post("/api/v1/portfolio/add")
async def add_to_portfolio(item: PortfolioItem):
    item.symbol = _validate_symbol(item.symbol)
    conn = get_db()
    try:
        conn.execute(
            "INSERT INTO portfolio (symbol, quantity, buy_price, buy_date) VALUES (?, ?, ?, ?)",
            (item.symbol, item.quantity, item.buy_price, item.buy_date),
        )
        conn.execute(
            "INSERT INTO transactions (symbol, txn_type, quantity, price, txn_date) VALUES (?, 'BUY', ?, ?, ?)",
            (item.symbol, item.quantity, item.buy_price, item.buy_date),
        )
        conn.commit()
    finally:
        conn.close()
    return {"status": "added", **item.dict()}

@app.get("/api/v1/portfolio")
async def get_portfolio():
    conn = get_db()
    try:
        rows = conn.execute("SELECT * FROM portfolio").fetchall()
    finally:
        conn.close()
    items = [dict(r) for r in rows]
    total_invested = 0.0
    total_current = 0.0
    for item in items:
        sym = item["symbol"]
        data = _fetch_yf(sym, period="5d", interval="1d")
        current_price = data["prices"][-1]["close"] if data and data["prices"] else item["buy_price"]
        item["current_price"] = current_price
        item["invested"] = round(item["quantity"] * item["buy_price"], 2)
        item["current_value"] = round(item["quantity"] * current_price, 2)
        item["pnl"] = round(item["current_value"] - item["invested"], 2)
        item["pnl_pct"] = round(item["pnl"] / item["invested"] * 100, 2) if item["invested"] else 0
        total_invested += item["invested"]
        total_current += item["current_value"]
    total_pnl = round(total_current - total_invested, 2)
    return {
        "holdings": items,
        "summary": {
            "total_invested": round(total_invested, 2),
            "current_value": round(total_current, 2),
            "total_pnl": total_pnl,
            "total_pnl_pct": round(total_pnl / total_invested * 100, 2) if total_invested else 0,
        },
    }

@app.get("/api/v1/portfolio/transactions")
async def get_transactions():
    conn = get_db()
    try:
        rows = conn.execute("SELECT * FROM transactions ORDER BY txn_date DESC").fetchall()
    finally:
        conn.close()
    return {"transactions": [dict(r) for r in rows]}

@app.delete("/api/v1/portfolio/{item_id}")
async def remove_from_portfolio(item_id: int):
    conn = get_db()
    try:
        conn.execute("DELETE FROM portfolio WHERE id = ?", (item_id,))
        conn.commit()
    finally:
        conn.close()
    return {"status": "removed", "id": item_id}


# --- Brokers -------------------------------------------------------------------
@app.get("/api/v1/brokers")
async def get_brokers():
    conn = get_db()
    rows = conn.execute("SELECT * FROM brokers ORDER BY added_at DESC").fetchall()
    conn.close()
    result = []
    for r in rows:
        d = dict(r)
        # Mask secrets before sending to frontend
        if d.get("api_secret"):
            d["api_secret"] = "••••••••"
        if d.get("totp_secret"):
            d["totp_secret"] = "••••••••"
        result.append(d)
    return result

@app.post("/api/v1/brokers/add")
async def add_broker(item: BrokerAccount):
    conn = get_db()
    try:
        cur = conn.execute(
            """INSERT INTO brokers (broker, client_id, api_key, api_secret, totp_secret, redirect_url)
               VALUES (?,?,?,?,?,?)""",
            (item.broker.strip(), item.client_id or "", item.api_key or "",
             item.api_secret or "", item.totp_secret or "", item.redirect_url or ""),
        )
        conn.commit()
        row_id = cur.lastrowid
    finally:
        conn.close()
    return {"status": "connected", "id": row_id}

@app.delete("/api/v1/brokers/{broker_id}")
async def remove_broker(broker_id: int):
    conn = get_db()
    try:
        conn.execute("DELETE FROM brokers WHERE id = ?", (broker_id,))
        conn.commit()
    finally:
        conn.close()
    return {"status": "disconnected", "id": broker_id}


# --- SIP Calculator (Week 5-6) -----------------------------------------------
@app.post("/api/v1/calculators/sip")
async def sip_calculator(req: SIPRequest):
    """
    SIP (Systematic Investment Plan) calculator with optional annual step-up.
    Returns year-wise growth table and final corpus.
    """
    monthly_rate = req.annual_return / 12 / 100
    total_invested = 0.0
    corpus = 0.0
    sip_amount = req.monthly_amount
    yearly = []

    for year in range(1, req.years + 1):
        for _ in range(12):
            corpus = (corpus + sip_amount) * (1 + monthly_rate)
            total_invested += sip_amount
        yearly.append({
            "year": year,
            "sip_amount": round(sip_amount, 2),
            "invested_so_far": round(total_invested, 2),
            "corpus": round(corpus, 2),
            "gains": round(corpus - total_invested, 2),
        })
        sip_amount *= 1 + req.step_up_percent / 100

    return {
        "monthly_amount": req.monthly_amount,
        "annual_return_pct": req.annual_return,
        "years": req.years,
        "step_up_pct": req.step_up_percent,
        "total_invested": round(total_invested, 2),
        "expected_corpus": round(corpus, 2),
        "total_gains": round(corpus - total_invested, 2),
        "wealth_gained_pct": round((corpus - total_invested) / total_invested * 100, 2),
        "yearly_breakdown": yearly,
    }


# --- LTCG / STCG Tax Calculator (Week 5-6) -----------------------------------
@app.post("/api/v1/calculators/tax")
async def tax_calculator(req: TaxRequest):
    """
    Indian capital gains tax calculator (LTCG / STCG).
    Equity:           STCG 20% (<365 days) | LTCG 12.5% on gains above ₹1,25,000 (>=365 days)
    Debt Mutual Fund: Always taxed at slab rate (30% estimate), regardless of holding period
    Listed Bond:      STCG at slab rate (<365 days) | LTCG 12.5% (>=365 days)
    Gold:             STCG at slab rate (<365 days)  | LTCG 12.5% (>=365 days)
    """
    total_buy = req.buy_price * req.quantity
    total_sell = req.sell_price * req.quantity
    gain = total_sell - total_buy

    # Accurate months: 1 calendar year = 365 days = exactly 12 months
    holding_months = round(req.holding_days * 12 / 365, 1)

    # LTCG threshold: 365 calendar days (accounts for standard year; leap-year
    # boundary is handled by the user supplying actual holding_days).
    is_ltcg_year = req.holding_days >= 365

    asset = req.asset_type.lower()

    if asset == "equity":
        if is_ltcg_year:
            taxable_gain = max(0, gain - LTCG_EXEMPTION)
            tax = taxable_gain * LTCG_EQUITY_RATE
            txn_type = "LTCG"
            rate_applied = f"12.5% on gains above ₹{LTCG_EXEMPTION:,}"
        else:
            taxable_gain = max(0, gain)
            tax = taxable_gain * STCG_EQUITY_RATE
            txn_type = "STCG"
            rate_applied = "20%"

    elif asset == "debt_mf":
        # Debt Mutual Funds: always taxed at slab rate, no LTCG benefit
        taxable_gain = max(0, gain)
        tax = taxable_gain * SLAB_RATE
        txn_type = "STCG (Slab)"
        rate_applied = "30% (income tax slab rate) — no LTCG benefit for Debt MF"

    elif asset == "debt_bond":
        # Listed Bonds: LTCG 12.5% if >= 365 days, else slab rate
        taxable_gain = max(0, gain)
        if is_ltcg_year:
            tax = taxable_gain * LTCG_BOND_RATE
            txn_type = "LTCG"
            rate_applied = "12.5%"
        else:
            tax = taxable_gain * SLAB_RATE
            txn_type = "STCG (Slab)"
            rate_applied = "30% (income tax slab rate)"

    else:
        # Gold / Other: slab rate short-term, 12.5% long-term
        taxable_gain = max(0, gain)
        if is_ltcg_year:
            tax = taxable_gain * LTCG_BOND_RATE
            txn_type = "LTCG"
            rate_applied = "12.5%"
        else:
            tax = taxable_gain * SLAB_RATE
            txn_type = "STCG (Slab)"
            rate_applied = "30% (income tax slab rate)"

    return {
        "asset_type": req.asset_type,
        "buy_price": req.buy_price,
        "sell_price": req.sell_price,
        "quantity": req.quantity,
        "holding_days": req.holding_days,
        "holding_months": holding_months,
        "total_buy_value": round(total_buy, 2),
        "total_sell_value": round(total_sell, 2),
        "total_gain_loss": round(gain, 2),
        "tax_type": txn_type,
        "rate_applied": rate_applied,
        "estimated_tax": round(max(tax, 0), 2),
        "net_profit_after_tax": round(gain - max(tax, 0), 2),
        "note": "Estimate only. Consult a tax advisor for final computation.",
    }


# --- Fundamental Analysis Snapshot (Week 5-6) --------------------------------
@app.get("/api/v1/stocks/fundamentals/{symbol}")
async def fundamental_analysis(symbol: str):
    """
    Key fundamental metrics: P/E, P/B, D/E, ROE, revenue growth, dividend yield.
    """
    symbol = _validate_symbol(symbol)
    data = _fetch_yf(symbol, period="5d", interval="1d")
    if not data:
        raise HTTPException(status_code=404, detail=f"No data for {symbol}")
    info = data["info"]

    def safe(key, default=None):
        val = info.get(key, default)
        return round(float(val), 2) if isinstance(val, (int, float)) else val

    pe = safe("trailingPE")
    pb = safe("priceToBook")
    de = safe("debtToEquity")
    roe = safe("returnOnEquity")
    roa = safe("returnOnAssets")
    gross_margin = safe("grossMargins")
    profit_margin = safe("profitMargins")
    revenue_growth = safe("revenueGrowth")
    eps = safe("trailingEps")
    div_yield = safe("dividendYield")
    payout_ratio = safe("payoutRatio")
    current_ratio = safe("currentRatio")
    quick_ratio = safe("quickRatio")

    # Grade the stock qualitatively
    flags = []
    if pe and pe < 25:
        flags.append("✅ Reasonable P/E")
    elif pe and pe > 50:
        flags.append("⚠️ High P/E — growth premium or overvalued")
    if de and de < 0.5:
        flags.append("✅ Low Debt")
    elif de and de > 2:
        flags.append("⚠️ High Debt")
    if roe and roe > 0.15:
        flags.append("✅ Strong ROE > 15%")
    if revenue_growth and revenue_growth > 0.1:
        flags.append("✅ Growing Revenue")

    return {
        "symbol": symbol,
        "company": info.get("longName") or symbol.split(".")[0],
        "sector": info.get("sector"),
        "industry": info.get("industry"),
        "valuation": {"pe_ratio": pe, "pb_ratio": pb, "eps": eps, "market_cap": info.get("marketCap")},
        "profitability": {"roe": roe, "roa": roa, "gross_margin": gross_margin, "profit_margin": profit_margin},
        "leverage": {"debt_to_equity": de, "current_ratio": current_ratio, "quick_ratio": quick_ratio},
        "growth": {"revenue_growth": revenue_growth},
        "dividends": {"yield": div_yield, "payout_ratio": payout_ratio},
        "qualitative_flags": flags,
        "disclaimer": "Data via yfinance. Always cross-verify with BSE/NSE filings.",
    }


# ══════════════════════════════════════════════════════════════════════════════
#  WEEK 6 (continued) — AI Chat Assistant (optional Claude)
# ══════════════════════════════════════════════════════════════════════════════
SYSTEM_PROMPT = """You are Artha, an expert AI financial research assistant specialising in Indian stock markets (NSE/BSE). 
You provide clear, data-driven analysis and planning advice. Always remind users you are not a SEBI-registered advisor.
Format responses with headers and bullet points for readability."""

@app.post("/api/v1/chat/query")
async def chat_query(req: ChatRequest):
    """AI financial assistant. Uses Claude if CLAUDE_API_KEY is set, else rule-based fallback."""
    api_key = os.environ.get("CLAUDE_API_KEY", "")
    user_msg = req.message.strip()
    if not user_msg:
        raise HTTPException(status_code=400, detail="Message cannot be empty.")

    if api_key:
        try:
            from anthropic import Anthropic
            client = Anthropic(api_key=api_key)
            messages = [{"role": "user", "content": user_msg}]
            if req.context:
                messages[0]["content"] = f"Context: {req.context}\n\nQuestion: {user_msg}"
            response = client.messages.create(
                model="claude-3-5-sonnet-20241022",
                max_tokens=1024,
                system=SYSTEM_PROMPT,
                messages=messages,
            )
            return {
                "response": response.content[0].text,
                "model": "claude-3-5-sonnet",
                "timestamp": datetime.utcnow().isoformat(),
            }
        except Exception as e:
            err_text = str(e)
            logger.error(f"Claude error: {err_text}")
            lower = err_text.lower()
            if "credit balance" in lower or "billing" in lower or "quota" in lower or "insufficient" in lower:
                friendly = (
                    "**Anthropic account has no credits.**\n\n"
                    "Your CLAUDE_API_KEY is valid, but the linked Anthropic account is out of credits. "
                    "Top up at https://console.anthropic.com/settings/billing and try again.\n\n"
                    "Falling back to a quick rule-based answer below."
                )
            elif "401" in lower or "unauthorized" in lower or "authentication" in lower or "invalid_api_key" in lower:
                friendly = (
                    "**Invalid Anthropic API key.**\n\n"
                    "The CLAUDE_API_KEY secret was rejected by Anthropic. "
                    "Generate a new key at https://console.anthropic.com/settings/keys and update the secret.\n\n"
                    "Falling back to a quick rule-based answer below."
                )
            elif "rate" in lower and "limit" in lower:
                friendly = (
                    "**Anthropic rate-limit hit.**\n\n"
                    "Please retry in a moment. Falling back to a quick rule-based answer below."
                )
            else:
                friendly = None

            if friendly:
                # Continue to rule-based fallback below but prepend the friendly error
                _claude_error_prefix = friendly + "\n\n---\n\n"
            else:
                _claude_error_prefix = ""

    # Rule-based fallback (also reached if Claude failed in a known way above)
    if "_claude_error_prefix" not in dir():
        _claude_error_prefix = ""
    msg_lower = user_msg.lower()
    if any(k in msg_lower for k in ["sip", "systematic investment"]):
        answer = ("A SIP (Systematic Investment Plan) lets you invest a fixed amount monthly in mutual funds. "
                  "Use our SIP Calculator at POST /api/v1/calculators/sip to project your corpus.")
    elif any(k in msg_lower for k in ["ltcg", "stcg", "tax", "capital gain"]):
        answer = ("Indian capital gains tax: STCG (equity held ≤1 yr) is 15%. "
                  "LTCG (equity held >1 yr) is 10% on gains above ₹1 lakh. "
                  "Use our Tax Calculator at POST /api/v1/calculators/tax.")
    elif any(k in msg_lower for k in ["nifty", "sensex", "index"]):
        answer = ("Check live index data by querying ^NSEI (Nifty 50) or ^BSESN (Sensex) "
                  "via GET /api/v1/stocks/quote/^NSEI")
    elif any(k in msg_lower for k in ["rsi", "technical", "macd", "moving average"]):
        answer = ("Use GET /api/v1/stocks/analyze/{symbol} for full technical analysis "
                  "including SMA, EMA, RSI, MACD, and Bollinger Bands with buy/sell signals.")
    elif any(k in msg_lower for k in ["sector", "it", "banking", "pharma"]):
        answer = ("Compare all stocks in a sector via GET /api/v1/sectors/compare?sector=IT "
                  "Available: IT, Banking, Energy, FMCG, Pharma, Auto")
    else:
        answer = (f"I'm Artha, your AI financial assistant. I can help with stock analysis, "
                  f"technical indicators, SIP calculations, tax planning, and more. "
                  f"Set CLAUDE_API_KEY for full Claude-powered responses. "
                  f"You asked: \"{user_msg}\"")
    return {
        "response": _claude_error_prefix + answer,
        "model": "rule-based-fallback",
        "timestamp": datetime.utcnow().isoformat(),
    }


# ══════════════════════════════════════════════════════════════════════════════
#  WEEK 7-8 — Production polish: validation, monitoring, financial wellness
# ══════════════════════════════════════════════════════════════════════════════

@app.get("/api/v1/wellness/financial-score")
async def financial_wellness_score(
    monthly_income: float = Query(..., gt=0, description="Monthly income in INR"),
    monthly_expenses: float = Query(..., gt=0),
    monthly_savings: float = Query(..., ge=0),
    has_emergency_fund: bool = Query(False),
    has_insurance: bool = Query(False),
    has_investment: bool = Query(False),
    debt_emi: float = Query(0, ge=0),
):
    """
    Compute a personalised financial wellness score (0-100) based on
    savings rate, EMI burden, emergency fund, insurance, and investments.
    """
    scores = {}
    # Savings rate (ideal ≥20%)
    savings_rate = monthly_savings / monthly_income * 100
    scores["savings_rate"] = min(savings_rate / 20 * 25, 25)

    # EMI burden (ideal ≤30% of income)
    emi_burden = debt_emi / monthly_income * 100
    scores["debt_burden"] = max(0, 20 - emi_burden / 30 * 20)

    # Emergency fund (5 points)
    scores["emergency_fund"] = 20 if has_emergency_fund else 0

    # Insurance coverage (5 points)
    scores["insurance"] = 15 if has_insurance else 0

    # Investment (5 points)
    scores["investment"] = 20 if has_investment else 0

    total = round(sum(scores.values()), 1)
    grade = "A" if total >= 80 else "B" if total >= 60 else "C" if total >= 40 else "D"

    suggestions = []
    if savings_rate < 20:
        suggestions.append(f"Increase savings rate. Current: {savings_rate:.1f}%, Target: 20%+")
    if emi_burden > 30:
        suggestions.append(f"EMI burden {emi_burden:.1f}% is high. Aim to keep it below 30%.")
    if not has_emergency_fund:
        suggestions.append("Build an emergency fund covering 6 months of expenses.")
    if not has_insurance:
        suggestions.append("Get term life and health insurance coverage.")
    if not has_investment:
        suggestions.append("Start investing — even a small SIP goes a long way.")

    return {
        "financial_wellness_score": total,
        "out_of": 100,
        "grade": grade,
        "breakdown": scores,
        "savings_rate_pct": round(savings_rate, 2),
        "emi_to_income_pct": round(emi_burden, 2),
        "suggestions": suggestions,
        "status": "Excellent" if grade == "A" else "Good" if grade == "B" else "Needs Improvement" if grade == "C" else "Critical",
    }


@app.get("/api/v1/monitoring/summary")
async def monitoring_summary():
    """API health, cache stats, and DB summary (Week 7-8 monitoring)."""
    conn = get_db()
    try:
        watchlist_count = conn.execute("SELECT COUNT(*) FROM watchlist").fetchone()[0]
        portfolio_count = conn.execute("SELECT COUNT(*) FROM portfolio").fetchone()[0]
        txn_count = conn.execute("SELECT COUNT(*) FROM transactions").fetchone()[0]
    finally:
        conn.close()

    now = time.time()
    live_cache_entries = sum(1 for k in _cache if now < _cache_ttl.get(k, 0))
    return {
        "api_status": "healthy",
        "version": "1.0.0",
        "weeks_covered": "1-8",
        "database": {
            "watchlist_entries": watchlist_count,
            "portfolio_entries": portfolio_count,
            "transactions": txn_count,
        },
        "cache": {"live_entries": live_cache_entries, "total_entries": len(_cache)},
        "market_status": _market_status(),
        "timestamp": datetime.utcnow().isoformat(),
    }


# ══════════════════════════════════════════════════════════════════════════════
#  PERSONAL FINANCE (existing Week 3-4 features preserved)
# ══════════════════════════════════════════════════════════════════════════════

# ---------- EMI / Debt ----------
def _emi(principal: float, rate: float, months: int) -> float:
    if rate == 0:
        return round(principal / months, 2)
    r = rate / 12 / 100
    return round(principal * (r * (1 + r) ** months) / ((1 + r) ** months - 1), 2)

@app.post("/api/v1/debt/calculate-emi")
async def calculate_emi_endpoint(
    debt_type: str = Body(...), principal: float = Body(..., gt=0),
    interest_rate: float = Body(..., ge=0), tenure_months: int = Body(..., gt=0)
):
    emi = _emi(principal, interest_rate, tenure_months)
    total_paid = emi * tenure_months
    return {
        "debt_type": debt_type, "principal": principal,
        "interest_rate": interest_rate, "tenure_months": tenure_months,
        "monthly_emi": emi, "total_interest": round(total_paid - principal, 2),
        "total_amount": round(total_paid, 2),
        "payoff_date": (datetime.utcnow() + timedelta(days=tenure_months * 30)).strftime("%Y-%m-%d"),
    }

@app.post("/api/v1/debt/prepayment-strategy")
async def debt_prepayment(
    principal: float = Body(...), interest_rate: float = Body(...),
    tenure_months: int = Body(...), extra_payment: float = Body(...)
):
    normal_emi = _emi(principal, interest_rate, tenure_months)
    normal_interest = normal_emi * tenure_months - principal
    saved = extra_payment / normal_emi * normal_interest * 0.3
    months_saved = int(extra_payment / normal_emi * tenure_months * 0.2)
    return {
        "normal_emi": normal_emi, "new_emi": round(normal_emi + extra_payment, 2),
        "interest_saved": round(saved, 2), "months_saved": months_saved,
        "recommendation": f"Paying ₹{extra_payment} extra/month saves ~₹{round(saved):,} in interest.",
    }


# ---------- Expense tracking ----------
@app.post("/api/v1/expenses/add")
async def add_expense(expense: Expense):
    eid = f"exp_{len(expenses_db)}"
    expenses_db[eid] = expense.dict()
    return {"expense_id": eid, "status": "added", **expense.dict()}

@app.get("/api/v1/expenses")
async def get_expenses():
    total = sum(e["amount"] for e in expenses_db.values())
    by_cat: Dict[str, float] = {}
    for e in expenses_db.values():
        by_cat[e["category"]] = round(by_cat.get(e["category"], 0) + e["amount"], 2)
    return {"total_expenses": len(expenses_db), "total_amount": round(total, 2),
            "by_category": by_cat, "expenses": list(expenses_db.values())}


# ---------- Budget ----------
@app.post("/api/v1/budget/set")
async def set_budget(category: ExpenseCategory = Body(...), monthly_limit: float = Body(..., gt=0)):
    bid = f"budget_{category}"
    budgets_db[bid] = {"category": category, "monthly_limit": monthly_limit, "spent": 0}
    return {"budget_id": bid, "category": category, "monthly_limit": monthly_limit, "status": "created"}

@app.get("/api/v1/budget/summary")
async def budget_summary():
    budgets = list(budgets_db.values())
    for b in budgets:
        b["remaining"] = b["monthly_limit"] - b["spent"]
        b["utilization_pct"] = round(b["spent"] / b["monthly_limit"] * 100, 1) if b["monthly_limit"] else 0
    return {"budgets": budgets, "total_budgets": len(budgets)}


# ---------- Insurance ----------
@app.post("/api/v1/insurance/needs-analysis")
async def insurance_needs(
    age: int = Body(...), annual_income: float = Body(...),
    dependents: int = Body(0), existing_coverage: float = Body(0)
):
    need = annual_income * 10 + (500_000 * dependents) + 2_000_000
    gap = max(0, need - existing_coverage)
    return {
        "age": age, "annual_income": annual_income,
        "dependents": dependents, "existing_coverage": existing_coverage,
        "recommended_coverage": round(need, 2),
        "coverage_gap": round(gap, 2),
        "recommendation": "Term Life Insurance" if gap > 0 else "Adequate coverage",
        "suggested_premium_est": round(gap * 0.003, 2),
    }


# ---------- Retirement ----------
@app.post("/api/v1/retirement/corpus-calculation")
async def retirement_corpus(plan: RetirementPlan):
    yrs = plan.retirement_age - plan.current_age
    r = plan.expected_return / 100
    mr = r / 12
    months = yrs * 12
    fv_savings = plan.current_savings * (1 + r) ** yrs
    fv_monthly = plan.monthly_savings * (((1 + mr) ** months - 1) / mr) * (1 + mr)
    corpus = fv_savings + fv_monthly
    inflation = 0.05
    expense_at_ret = plan.annual_expense * (1 + inflation) ** yrs
    needed = expense_at_ret / 0.03
    shortfall = max(0, needed - corpus)
    return {
        "years_to_retirement": yrs,
        "corpus_at_retirement": round(corpus, 2),
        "corpus_needed": round(needed, 2),
        "shortfall": round(shortfall, 2),
        "status": "On Track" if shortfall == 0 else f"Shortfall ₹{shortfall:,.0f}",
        "annual_expense_at_retirement": round(expense_at_ret, 2),
    }


# ---------- Emergency Fund ----------
@app.post("/api/v1/emergency-fund/calculate")
async def emergency_fund(monthly_expenses: float = Body(..., gt=0), months: int = Body(6, ge=1)):
    needed = monthly_expenses * months
    return {
        "monthly_expenses": monthly_expenses, "months_covered": months,
        "emergency_fund_needed": round(needed, 2),
        "allocation": {
            "savings_account_3m": round(monthly_expenses * 3, 2),
            "liquid_mf_2m": round(monthly_expenses * 2, 2),
            "short_term_fd_1m": round(monthly_expenses * max(0, months - 5), 2),
        },
    }


# ══════════════════════════════════════════════════════════════════════════════
#  WEEK 3-4 ADVANCED — Options, Futures, Bonds, Economic Indicators
# ══════════════════════════════════════════════════════════════════════════════
import math

# ── Black-Scholes pricing & Greeks ────────────────────────────────────────────
def _norm_cdf(x: float) -> float:
    return (1.0 + math.erf(x / math.sqrt(2.0))) / 2.0

def _black_scholes(S: float, K: float, T: float, r: float, sigma: float, option_type: str = "call") -> Dict:
    if T <= 0 or sigma <= 0 or S <= 0 or K <= 0:
        return {"error": "Invalid parameters"}
    d1 = (math.log(S / K) + (r + 0.5 * sigma ** 2) * T) / (sigma * math.sqrt(T))
    d2 = d1 - sigma * math.sqrt(T)
    nd1, nd2 = _norm_cdf(d1), _norm_cdf(d2)
    pdf_d1 = math.exp(-d1 ** 2 / 2) / math.sqrt(2 * math.pi)
    if option_type.lower() == "call":
        price = S * nd1 - K * math.exp(-r * T) * nd2
        delta = nd1
        rho   = K * T * math.exp(-r * T) * nd2 / 100
    else:
        price = K * math.exp(-r * T) * _norm_cdf(-d2) - S * _norm_cdf(-d1)
        delta = nd1 - 1
        rho   = -K * T * math.exp(-r * T) * _norm_cdf(-d2) / 100
    gamma = pdf_d1 / (S * sigma * math.sqrt(T))
    vega  = S * math.sqrt(T) * pdf_d1 / 100
    if option_type.lower() == "call":
        theta = (-S * pdf_d1 * sigma / (2 * math.sqrt(T)) - r * K * math.exp(-r * T) * nd2) / 365
    else:
        theta = (-S * pdf_d1 * sigma / (2 * math.sqrt(T)) + r * K * math.exp(-r * T) * _norm_cdf(-d2)) / 365
    return {
        "price": round(price, 2), "delta": round(delta, 4),
        "gamma": round(gamma, 6), "theta": round(theta, 4),
        "vega":  round(vega, 4),  "rho":   round(rho, 4),
        "d1":    round(d1, 4),    "d2":    round(d2, 4),
    }


# ── Options pydantic models ────────────────────────────────────────────────────
class BSRequest(BaseModel):
    spot_price:   float
    strike_price: float
    time_to_expiry_days: float
    risk_free_rate: float = 7.0   # % (India: ~repo rate)
    volatility:   float           # % annual
    option_type:  str = "call"    # "call" | "put"

class YTMRequest(BaseModel):
    face_value:   float = 1000.0
    coupon_rate:  float            # % annual
    current_price: float
    years_to_maturity: float
    frequency:    int = 2          # coupon payments per year


# ── Options chain via Yahoo Finance ───────────────────────────────────────────
def _hist_volatility(closes: List[float], window: int = 30) -> float:
    """Annualised historical volatility from daily log returns."""
    if len(closes) < 2:
        return 0.20  # fallback 20%
    returns = [math.log(closes[i] / closes[i - 1]) for i in range(1, len(closes)) if closes[i - 1] > 0]
    if not returns:
        return 0.20
    n = min(window, len(returns))
    sample = returns[-n:]
    mean = sum(sample) / n
    variance = sum((r - mean) ** 2 for r in sample) / max(n - 1, 1)
    return round(math.sqrt(variance * 252), 4)  # annualised

def _build_computed_chain(symbol: str, spot: float, vol: float, days_to_expiry: int,
                           rf_rate: float = 0.067) -> Dict:
    """Build a computed options chain using Black-Scholes for all strikes."""
    # Generate strikes: 10 below ATM + ATM + 10 above ATM
    # Strike step depends on price magnitude
    if spot >= 10000:
        step = round(spot * 0.005 / 100) * 100  # 0.5% steps, rounded to 100
        step = max(step, 100)
    elif spot >= 1000:
        step = round(spot * 0.01 / 50) * 50     # 1% steps, rounded to 50
        step = max(step, 50)
    elif spot >= 100:
        step = round(spot * 0.01 / 5) * 5        # 1% steps, rounded to 5
        step = max(step, 5)
    else:
        step = round(spot * 0.02, 2)              # 2% steps
        step = max(step, 0.5)

    atm = round(spot / step) * step   # round spot to nearest strike
    strikes = [round(atm + i * step, 4) for i in range(-10, 11)]

    T  = days_to_expiry / 365.0
    r  = rf_rate
    calls, puts = [], []

    import random as _rand
    _rand.seed(int(spot * 1000) % 99991)  # deterministic per spot

    for K in strikes:
        if K <= 0:
            continue
        bs_call = _black_scholes(spot, K, T, r, vol, "call")
        bs_put  = _black_scholes(spot, K, T, r, vol, "put")
        itm_call = spot > K
        itm_put  = spot < K

        # Simulate realistic bid/ask spread (wider OTM)
        moneyness = abs(spot - K) / spot
        spread_factor = 1 + moneyness * 3

        call_price = bs_call["price"]
        put_price  = bs_put["price"]
        spread_c = round(max(0.05, call_price * 0.02 * spread_factor), 2)
        spread_p = round(max(0.05, put_price  * 0.02 * spread_factor), 2)

        # Simulate OI — highest near ATM
        oi_factor = max(0.1, 1 - moneyness * 4)
        base_oi = int(spot * 10 * oi_factor)
        oi_c = int(base_oi * (0.8 + _rand.random() * 0.4))
        oi_p = int(base_oi * (0.8 + _rand.random() * 0.4))
        vol_c = int(oi_c * (0.1 + _rand.random() * 0.15))
        vol_p = int(oi_p * (0.1 + _rand.random() * 0.15))

        calls.append({
            "strike":          K,
            "last_price":      round(call_price, 2),
            "bid":             round(call_price - spread_c / 2, 2),
            "ask":             round(call_price + spread_c / 2, 2),
            "change":          round((call_price - bs_call["price"]) * _rand.uniform(-0.05, 0.05), 2),
            "change_pct":      round(_rand.uniform(-2, 2), 2),
            "volume":          vol_c,
            "open_interest":   oi_c,
            "implied_vol_pct": round(vol * 100, 2),
            "delta":           bs_call["delta"],
            "gamma":           bs_call["gamma"],
            "theta":           bs_call["theta"],
            "vega":            bs_call["vega"],
            "in_the_money":    itm_call,
        })
        puts.append({
            "strike":          K,
            "last_price":      round(put_price, 2),
            "bid":             round(put_price - spread_p / 2, 2),
            "ask":             round(put_price + spread_p / 2, 2),
            "change":          round((put_price - bs_put["price"]) * _rand.uniform(-0.05, 0.05), 2),
            "change_pct":      round(_rand.uniform(-2, 2), 2),
            "volume":          vol_p,
            "open_interest":   oi_p,
            "implied_vol_pct": round(vol * 100, 2),
            "delta":           bs_put["delta"],
            "gamma":           bs_put["gamma"],
            "theta":           bs_put["theta"],
            "vega":            bs_put["vega"],
            "in_the_money":    itm_put,
        })
    return {"calls": calls, "puts": puts}

def _next_expiries(n: int = 4) -> List[str]:
    """Return n upcoming monthly/weekly expiry dates (last Thursday of month for NSE)."""
    from datetime import date as _date
    today = _date.today()
    expiries = []
    # Weekly (next 4 Thursdays)
    d = today
    for _ in range(n * 2):
        d = d + timedelta(days=1)
        if d.weekday() == 3:  # Thursday
            expiries.append(d.strftime("%Y-%m-%d"))
        if len(expiries) >= n:
            break
    return expiries

def _compute_options_chain(symbol: str, expiry_index: int = 0) -> Optional[Dict]:
    cache_key = f"computed_opt:{symbol}:{expiry_index}"
    cached = cache_get(cache_key)
    if cached is not None:
        return cached
    try:
        data = _fetch_yf(symbol, period="3mo", interval="1d")
        if not data or not data["prices"] or len(data["prices"]) < 5:
            return None
        closes = [p["close"] for p in data["prices"]]
        spot = closes[-1]
        vol  = _hist_volatility(closes)
        info = data.get("info", {})
        company = info.get("longName") or info.get("shortName") or symbol.split(".")[0]

        expiries = _next_expiries(4)
        idx = min(expiry_index, len(expiries) - 1)
        expiry_str = expiries[idx] if expiries else (datetime.utcnow() + timedelta(days=30)).strftime("%Y-%m-%d")
        exp_date = datetime.strptime(expiry_str, "%Y-%m-%d")
        days_to_expiry = max(1, (exp_date - datetime.utcnow()).days)

        chain = _build_computed_chain(symbol, spot, vol, days_to_expiry)
        out = {
            "symbol":             symbol,
            "company":            company,
            "underlying_price":   round(spot, 2),
            "historical_vol_pct": round(vol * 100, 2),
            "risk_free_rate_pct": 6.7,
            "expiry":             expiry_str,
            "days_to_expiry":     days_to_expiry,
            "expiration_dates":   expiries,
            "calls":              chain["calls"],
            "puts":               chain["puts"],
            "data_note":          "Computed chain: prices via Black-Scholes using live spot and 30-day historical volatility.",
        }
        cache_set(cache_key, out, ttl=300)
        return out
    except Exception as e:
        logger.error(f"Computed options chain error for {symbol}: {e}")
        return None


# ── Options API endpoints ──────────────────────────────────────────────────────
@app.get("/api/v1/options/chain/{symbol}")
async def get_options_chain(
    symbol: str,
    expiry_index: int = Query(0, ge=0, description="Index of expiry date (0 = nearest)"),
):
    """
    Computed options chain using live spot price and 30-day historical volatility.
    Strikes are generated around ATM; prices computed via Black-Scholes.
    Works for any symbol available via Yahoo Finance (Indian + Global).
    """
    symbol = _validate_symbol(symbol)
    data = _compute_options_chain(symbol, expiry_index)
    if not data:
        raise HTTPException(status_code=404, detail=f"Could not fetch price data for {symbol}. Verify the symbol is valid.")
    return data

@app.post("/api/v1/options/black-scholes")
async def black_scholes_pricer(req: BSRequest):
    """
    Black-Scholes option pricing with full Greeks.
    Rate and volatility are in % (e.g., 7.0 for 7%).
    """
    if req.option_type.lower() not in ("call", "put"):
        raise HTTPException(status_code=400, detail="option_type must be 'call' or 'put'")
    T = req.time_to_expiry_days / 365.0
    r = req.risk_free_rate / 100.0
    sigma = req.volatility / 100.0
    result = _black_scholes(req.spot_price, req.strike_price, T, r, sigma, req.option_type)
    if "error" in result:
        raise HTTPException(status_code=400, detail=result["error"])
    intrinsic = max(0, req.spot_price - req.strike_price) if req.option_type == "call" else max(0, req.strike_price - req.spot_price)
    return {
        "inputs": {
            "spot_price": req.spot_price, "strike_price": req.strike_price,
            "time_to_expiry_days": req.time_to_expiry_days,
            "risk_free_rate_pct": req.risk_free_rate,
            "volatility_pct": req.volatility, "option_type": req.option_type,
        },
        "pricing": result,
        "intrinsic_value": round(intrinsic, 2),
        "time_value": round(result["price"] - intrinsic, 2),
        "moneyness": "ITM" if (req.option_type == "call" and req.spot_price > req.strike_price) or (req.option_type == "put" and req.spot_price < req.strike_price) else "OTM" if req.spot_price != req.strike_price else "ATM",
        "disclaimer": "Black-Scholes assumes constant volatility and European-style exercise. Not financial advice.",
    }

@app.get("/api/v1/options/popular")
async def popular_option_underlyings():
    """List popular symbols with options data."""
    return {
        "indian_indices": ["^NSEI", "^BSESN", "^NSEBANK"],
        "top_stocks": ["RELIANCE.NS", "TCS.NS", "INFY.NS", "HDFCBANK.NS", "ICICIBANK.NS"],
        "global": ["AAPL", "MSFT", "TSLA", "SPY", "QQQ"],
        "note": "Indian F&O stocks may have limited options data via Yahoo Finance. Global symbols work best.",
    }


# ── Futures helpers ────────────────────────────────────────────────────────────
FUTURES_SYMBOLS = {
    "Gold":          {"symbol": "GC=F", "unit": "USD/oz", "exchange": "COMEX"},
    "Silver":        {"symbol": "SI=F", "unit": "USD/oz", "exchange": "COMEX"},
    "Crude Oil WTI": {"symbol": "CL=F", "unit": "USD/bbl","exchange": "NYMEX"},
    "Natural Gas":   {"symbol": "NG=F", "unit": "USD/MMBtu","exchange": "NYMEX"},
    "Copper":        {"symbol": "HG=F", "unit": "USD/lb", "exchange": "COMEX"},
    "Nifty 50":      {"symbol": "^NSEI",  "unit": "INR points","exchange": "NSE", "is_index": True},
    "Bank Nifty":    {"symbol": "^NSEBANK","unit": "INR points","exchange": "NSE", "is_index": True},
    "Sensex":        {"symbol": "^BSESN", "unit": "INR points","exchange": "BSE", "is_index": True},
    "USD/INR":       {"symbol": "USDINR=X","unit": "INR","exchange": "Forex"},
}

def _cost_of_carry_futures(spot: float, rate: float, days: int, dividend_yield: float = 0.0) -> float:
    """Theoretical futures price via cost-of-carry model."""
    T = days / 365
    return round(spot * math.exp((rate - dividend_yield) * T), 2)


# ── Futures API endpoints ──────────────────────────────────────────────────────
@app.get("/api/v1/futures/list")
async def list_futures():
    """List all tracked futures instruments."""
    return {
        "commodity_futures": {k: v for k, v in FUTURES_SYMBOLS.items() if not v.get("is_index") and v.get("exchange") != "Forex"},
        "index_futures": {k: v for k, v in FUTURES_SYMBOLS.items() if v.get("is_index")},
        "currency_futures": {k: v for k, v in FUTURES_SYMBOLS.items() if v.get("exchange") == "Forex"},
        "note": "Index futures prices are computed via cost-of-carry model from spot price.",
    }

@app.get("/api/v1/futures/quotes")
async def get_futures_quotes():
    """Fetch live prices for all tracked futures and compute theoretical futures for indices."""
    RISK_FREE_RATE = 0.067   # India 6.7% repo-based
    EXPIRY_DAYS    = 30      # approximate next-month expiry

    results = []
    for name, meta in FUTURES_SYMBOLS.items():
        sym = meta["symbol"]
        data = _fetch_yf(sym, period="5d", interval="1d")
        if not data or not data["prices"]:
            continue
        latest = data["prices"][-1]
        prev   = data["prices"][-2] if len(data["prices"]) > 1 else latest
        spot   = latest["close"]
        change     = round(spot - prev["close"], 2)
        change_pct = round(change / prev["close"] * 100, 2) if prev["close"] else 0
        row: Dict[str, Any] = {
            "name":        name,
            "symbol":      sym,
            "spot_price":  spot,
            "change":      change,
            "change_pct":  change_pct,
            "unit":        meta["unit"],
            "exchange":    meta["exchange"],
        }
        if meta.get("is_index"):
            theoretical = _cost_of_carry_futures(spot, RISK_FREE_RATE, EXPIRY_DAYS)
            basis = round(theoretical - spot, 2)
            row["theoretical_futures"] = theoretical
            row["basis"]               = basis
            row["basis_pct"]           = round(basis / spot * 100, 2)
            row["expiry_days"]         = EXPIRY_DAYS
        results.append(row)
    if not results:
        raise HTTPException(status_code=503, detail="Live market data unavailable.")
    return {"futures": results, "risk_free_rate_pct": round(RISK_FREE_RATE * 100, 2), "timestamp": datetime.utcnow().isoformat()}

@app.get("/api/v1/futures/quote/{symbol}")
async def get_single_future(symbol: str, expiry_days: int = Query(30, ge=1, le=365)):
    """Get futures quote for a single symbol with cost-of-carry analysis."""
    symbol = _validate_symbol(symbol)
    data = _fetch_yf(symbol, period="5d", interval="1d")
    if not data or not data["prices"]:
        raise HTTPException(status_code=503, detail="Live market data unavailable.")
    latest = data["prices"][-1]
    prev   = data["prices"][-2] if len(data["prices"]) > 1 else latest
    spot   = latest["close"]
    RISK_FREE_RATE = 0.067
    theoretical = _cost_of_carry_futures(spot, RISK_FREE_RATE, expiry_days)
    return {
        "symbol": symbol, "spot_price": spot,
        "change":  round(spot - prev["close"], 2),
        "change_pct": round((spot - prev["close"]) / prev["close"] * 100, 2) if prev["close"] else 0,
        "theoretical_futures_price": theoretical,
        "basis": round(theoretical - spot, 2),
        "risk_free_rate_pct": round(RISK_FREE_RATE * 100, 2),
        "expiry_days": expiry_days,
        "cost_of_carry_formula": "F = S × e^(r×T)",
        "disclaimer": "Theoretical price only. Actual futures may differ due to dividends, convenience yield, and supply/demand.",
    }


# ── Bonds helpers ──────────────────────────────────────────────────────────────
# RBI key rates — updated to latest known values (April 2025)
RBI_RATES = {
    "repo_rate":         6.50,
    "reverse_repo_rate": 3.35,
    "crr":               4.00,
    "slr":              18.00,
    "msf_rate":          6.75,
    "bank_rate":         6.75,
    "last_updated":      "April 9, 2025",
    "next_mpc_meeting":  "June 4-6, 2025",
    "source":            "Reserve Bank of India",
}

GSEC_BENCHMARKS = [
    {"tenor": "91-Day T-Bill",  "symbol": "^IRX",    "maturity_years": 0.25, "type": "treasury_bill"},
    {"tenor": "182-Day T-Bill", "symbol": None,       "maturity_years": 0.50, "type": "treasury_bill", "yield_approx": 6.65},
    {"tenor": "364-Day T-Bill", "symbol": None,       "maturity_years": 1.00, "type": "treasury_bill", "yield_approx": 6.75},
    {"tenor": "2-Year G-Sec",   "symbol": None,       "maturity_years": 2.00, "type": "gsec",          "yield_approx": 6.90},
    {"tenor": "5-Year G-Sec",   "symbol": None,       "maturity_years": 5.00, "type": "gsec",          "yield_approx": 7.00},
    {"tenor": "10-Year G-Sec",  "symbol": None,       "maturity_years": 10.0, "type": "gsec",          "yield_approx": 7.10},
    {"tenor": "30-Year G-Sec",  "symbol": None,       "maturity_years": 30.0, "type": "gsec",          "yield_approx": 7.35},
]

INDIAN_BOND_ETFS = [
    {"name": "Liquid BeES",        "symbol": "LIQUIDBEES.NS"},
    {"name": "SBI ETF 10yr Gsec",  "symbol": "SETF10GILT.NS"},
    {"name": "Nippon India ETF GSec Long Term", "symbol": "NIFTYBEES.NS"},
]

def _ytm_calculator(face: float, coupon_rate: float, price: float, years: float, freq: int) -> Dict:
    """Iterative YTM calculation using Newton-Raphson."""
    coupon = face * coupon_rate / 100 / freq
    periods = int(years * freq)
    # Bond price function
    def bond_price(y):
        r = y / freq
        pv_coupons = coupon * (1 - (1 + r) ** (-periods)) / r if r != 0 else coupon * periods
        pv_face    = face / (1 + r) ** periods
        return pv_coupons + pv_face
    # Secant method
    y = coupon_rate / 100  # initial guess
    for _ in range(100):
        p  = bond_price(y) - price
        dp = (bond_price(y + 1e-6) - bond_price(y - 1e-6)) / 2e-6
        if abs(dp) < 1e-10:
            break
        y -= p / dp
        if y < 0:
            y = 0.001
    # Duration
    r = y / freq
    duration_num = sum(
        t / freq * coupon / (1 + r) ** t + (periods / freq * face / (1 + r) ** periods if t == periods else 0)
        for t in range(1, periods + 1)
    )
    mac_duration = duration_num / price
    mod_duration = mac_duration / (1 + r)
    return {
        "ytm_pct":            round(y * 100, 4),
        "macaulay_duration":  round(mac_duration, 4),
        "modified_duration":  round(mod_duration, 4),
        "dv01":               round(price * mod_duration * 0.0001, 4),
        "price_at_ytm":       round(bond_price(y), 2),
    }


# ── Bonds API endpoints ────────────────────────────────────────────────────────
@app.get("/api/v1/bonds/rbi-rates")
async def get_rbi_rates():
    """Current RBI monetary policy key rates."""
    return {**RBI_RATES, "disclaimer": "Rates are updated manually. Verify at rbi.org.in for latest values."}

@app.get("/api/v1/bonds/yield-curve")
async def get_yield_curve():
    """Indian G-Sec benchmark yield curve (mix of live and approximated data)."""
    curve = []
    for bench in GSEC_BENCHMARKS:
        row: Dict[str, Any] = {
            "tenor":           bench["tenor"],
            "maturity_years":  bench["maturity_years"],
            "type":            bench["type"],
        }
        if bench.get("symbol"):
            data = _fetch_yf(bench["symbol"], period="5d", interval="1d")
            if data and data["prices"]:
                row["yield_pct"]   = data["prices"][-1]["close"]
                row["data_source"] = "live"
            else:
                row["yield_pct"]   = bench.get("yield_approx")
                row["data_source"] = "reference"
        else:
            row["yield_pct"]   = bench.get("yield_approx")
            row["data_source"] = "reference"
        curve.append(row)
    return {
        "yield_curve": curve,
        "rbi_repo_rate": RBI_RATES["repo_rate"],
        "as_of": "April 2025",
        "disclaimer": "Reference yields are approximate. Live data from Yahoo Finance where available.",
    }

@app.get("/api/v1/bonds/etfs")
async def get_bond_etfs():
    """Live prices for Indian bond/liquid ETFs."""
    results = []
    for etf in INDIAN_BOND_ETFS:
        data = _fetch_yf(etf["symbol"], period="5d", interval="1d")
        if not data or not data["prices"]:
            continue
        latest = data["prices"][-1]
        prev   = data["prices"][-2] if len(data["prices"]) > 1 else latest
        results.append({
            "name":        etf["name"],
            "symbol":      etf["symbol"],
            "price":       latest["close"],
            "change":      round(latest["close"] - prev["close"], 4),
            "change_pct":  round((latest["close"] - prev["close"]) / prev["close"] * 100, 4) if prev["close"] else 0,
        })
    return {"bond_etfs": results, "timestamp": datetime.utcnow().isoformat()}

@app.post("/api/v1/bonds/ytm")
async def bond_ytm(req: YTMRequest):
    """
    Yield to Maturity calculator for bonds, with Macaulay & Modified Duration.
    """
    if req.current_price <= 0 or req.face_value <= 0:
        raise HTTPException(status_code=400, detail="Prices must be positive.")
    if req.years_to_maturity <= 0:
        raise HTTPException(status_code=400, detail="Years to maturity must be positive.")
    result = _ytm_calculator(req.face_value, req.coupon_rate, req.current_price, req.years_to_maturity, req.frequency)
    coupon_amount = req.face_value * req.coupon_rate / 100 / req.frequency
    premium_discount = "at par" if abs(req.current_price - req.face_value) < 0.01 else ("at premium" if req.current_price > req.face_value else "at discount")
    return {
        "inputs": {
            "face_value": req.face_value, "coupon_rate_pct": req.coupon_rate,
            "current_price": req.current_price, "years_to_maturity": req.years_to_maturity,
            "frequency": req.frequency, "coupon_per_period": round(coupon_amount, 2),
        },
        "results": result,
        "bond_trading": premium_discount,
        "interpretation": {
            "ytm": f"If held to maturity and coupons reinvested at YTM, your annualised return is {result['ytm_pct']}%",
            "modified_duration": f"A 1% rise in rates → ~{result['modified_duration']:.2f}% fall in bond price",
            "dv01": f"Price change per 1 basis-point move in yield: ₹{result['dv01']}",
        },
        "disclaimer": "Assumes flat yield curve and coupons reinvested at YTM. Consult a fixed-income advisor.",
    }


# ── Economic Indicators helpers ────────────────────────────────────────────────
ECONOMIC_STATIC = {
    "gdp_growth_rate_pct":         7.6,
    "gdp_growth_description":      "FY2023-24 annual GDP growth (Advance Estimate)",
    "cpi_inflation_pct":           4.85,
    "cpi_description":             "CPI Inflation (February 2025)",
    "wpi_inflation_pct":           2.38,
    "wpi_description":             "WPI Inflation (February 2025)",
    "iip_growth_pct":              5.0,
    "iip_description":             "Index of Industrial Production growth",
    "fiscal_deficit_gdp_pct":      5.1,
    "fiscal_deficit_description":  "Fiscal Deficit as % of GDP (FY2024)",
    "forex_reserves_bn_usd":       642.5,
    "forex_description":           "RBI Forex Reserves (March 2025)",
    "current_account_deficit_gdp": -1.2,
    "unemployment_rate_pct":       7.8,
    "as_of":                       "Q4 FY2024-25",
    "source":                      "MOSPI, RBI, Ministry of Finance",
    "disclaimer":                  "Reference data. Verify at mospi.gov.in and rbi.org.in for latest figures.",
}

CURRENCY_PAIRS = [
    {"pair": "USD/INR", "symbol": "USDINR=X"},
    {"pair": "EUR/INR", "symbol": "EURINR=X"},
    {"pair": "GBP/INR", "symbol": "GBPINR=X"},
    {"pair": "JPY/INR", "symbol": "JPYINR=X"},
    {"pair": "AUD/INR", "symbol": "AUDINR=X"},
    {"pair": "CNY/INR", "symbol": "CNYINR=X"},
]

COMMODITY_LIST = [
    {"name": "Gold (Comex)",      "symbol": "GC=F",  "unit": "USD/oz"},
    {"name": "Silver (Comex)",    "symbol": "SI=F",  "unit": "USD/oz"},
    {"name": "Crude Oil (WTI)",   "symbol": "CL=F",  "unit": "USD/bbl"},
    {"name": "Natural Gas",       "symbol": "NG=F",  "unit": "USD/MMBtu"},
    {"name": "Copper",            "symbol": "HG=F",  "unit": "USD/lb"},
    {"name": "Aluminium (LME proxy)", "symbol": "ALI=F","unit": "USD/cwt"},
]


# ── Economic Indicators API endpoints ─────────────────────────────────────────
@app.get("/api/v1/economic/indicators")
async def get_economic_indicators():
    """Indian macroeconomic indicators (GDP, inflation, fiscal deficit, etc.)."""
    return {
        "macro_indicators": ECONOMIC_STATIC,
        "rbi_rates": {k: v for k, v in RBI_RATES.items() if k != "source"},
    }

@app.get("/api/v1/economic/currency")
async def get_currency_rates():
    """Live INR exchange rates for major currency pairs."""
    results = []
    for pair in CURRENCY_PAIRS:
        data = _fetch_yf(pair["symbol"], period="5d", interval="1d")
        if not data or not data["prices"]:
            continue
        latest = data["prices"][-1]
        prev   = data["prices"][-2] if len(data["prices"]) > 1 else latest
        change     = round(latest["close"] - prev["close"], 4)
        change_pct = round(change / prev["close"] * 100, 4) if prev["close"] else 0
        hist_closes = [p["close"] for p in data["prices"]]
        results.append({
            "pair":        pair["pair"],
            "symbol":      pair["symbol"],
            "rate":        latest["close"],
            "change":      change,
            "change_pct":  change_pct,
            "week_high":   max(hist_closes),
            "week_low":    min(hist_closes),
        })
    if not results:
        raise HTTPException(status_code=503, detail="Currency data temporarily unavailable.")
    return {"currency_rates": results, "base_currency": "INR", "timestamp": datetime.utcnow().isoformat()}

@app.get("/api/v1/economic/commodities")
async def get_commodity_prices():
    """Live global commodity prices (Gold, Crude, Silver, etc.)."""
    results = []
    for comm in COMMODITY_LIST:
        data = _fetch_yf(comm["symbol"], period="5d", interval="1d")
        if not data or not data["prices"]:
            continue
        latest = data["prices"][-1]
        prev   = data["prices"][-2] if len(data["prices"]) > 1 else latest
        closes = [p["close"] for p in data["prices"]]
        results.append({
            "name":        comm["name"],
            "symbol":      comm["symbol"],
            "price":       latest["close"],
            "change":      round(latest["close"] - prev["close"], 3),
            "change_pct":  round((latest["close"] - prev["close"]) / prev["close"] * 100, 2) if prev["close"] else 0,
            "unit":        comm["unit"],
            "week_high":   max(closes),
            "week_low":    min(closes),
        })
    if not results:
        raise HTTPException(status_code=503, detail="Commodity data temporarily unavailable.")
    return {"commodities": results, "timestamp": datetime.utcnow().isoformat()}

@app.get("/api/v1/economic/dashboard")
async def economic_dashboard():
    """Aggregated snapshot: macro indicators + currency + rates."""
    usdinr_data = _fetch_yf("USDINR=X", period="5d", interval="1d")
    usdinr = usdinr_data["prices"][-1]["close"] if usdinr_data and usdinr_data["prices"] else None
    gold_data = _fetch_yf("GC=F", period="5d", interval="1d")
    gold = gold_data["prices"][-1]["close"] if gold_data and gold_data["prices"] else None
    crude_data = _fetch_yf("CL=F", period="5d", interval="1d")
    crude = crude_data["prices"][-1]["close"] if crude_data and crude_data["prices"] else None
    nifty_data = _fetch_yf("^NSEI", period="5d", interval="1d")
    nifty = nifty_data["prices"][-1]["close"] if nifty_data and nifty_data["prices"] else None
    return {
        "snapshot": {
            "nifty_50":          nifty,
            "usd_inr":           usdinr,
            "gold_usd_oz":       gold,
            "crude_oil_usd_bbl": crude,
            "repo_rate_pct":     RBI_RATES["repo_rate"],
            "cpi_inflation_pct": ECONOMIC_STATIC["cpi_inflation_pct"],
            "gdp_growth_pct":    ECONOMIC_STATIC["gdp_growth_rate_pct"],
        },
        "timestamp": datetime.utcnow().isoformat(),
    }


# ── Entry point ───────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    _port = int(os.getenv("PORT", "8000"))
    uvicorn.run(app, host="0.0.0.0", port=_port)
