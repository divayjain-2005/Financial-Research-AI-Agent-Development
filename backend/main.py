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

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
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
    """)
    conn.commit()
    conn.close()

init_db()

# ── yfinance helper (Week 1-2: Indian stock support) ──────────────────────────
# Circuit-breaker: once yfinance fails, skip retries for 10 minutes
_yf_circuit_open = False
_yf_circuit_reset_time = 0.0
YF_CIRCUIT_COOLDOWN = 600  # seconds

def _fetch_yf(symbol: str, period: str = "3mo", interval: str = "1d") -> Optional[Dict]:
    global _yf_circuit_open, _yf_circuit_reset_time
    cache_key = f"yf:{symbol}:{period}:{interval}"
    cached = cache_get(cache_key)
    if cached is not None:
        return cached
    # Skip network call if circuit is open
    if _yf_circuit_open and time.time() < _yf_circuit_reset_time:
        return None
    try:
        import yfinance as yf
        ticker = yf.Ticker(symbol)
        hist = ticker.history(period=period, interval=interval)
        info = {}
        try:
            info = ticker.info or {}
        except Exception:
            pass
        if hist.empty:
            _yf_circuit_open = True
            _yf_circuit_reset_time = time.time() + YF_CIRCUIT_COOLDOWN
            return None
        prices = [
            {
                "date": str(idx.date()),
                "open": round(float(row["Open"]), 2),
                "high": round(float(row["High"]), 2),
                "low": round(float(row["Low"]), 2),
                "close": round(float(row["Close"]), 2),
                "volume": int(row["Volume"]),
            }
            for idx, row in hist.iterrows()
        ]
        result = {"symbol": symbol, "prices": prices, "info": info}
        cache_set(cache_key, result, ttl=300)
        return result
    except Exception as e:
        logger.error(f"yfinance error for {symbol}: {e}")
        _yf_circuit_open = True
        _yf_circuit_reset_time = time.time() + YF_CIRCUIT_COOLDOWN
        return None


def _validate_symbol(symbol: str) -> str:
    """Normalise and validate a stock symbol (Week 7-8: input validation)."""
    symbol = symbol.strip().upper()
    if not symbol:
        raise HTTPException(status_code=400, detail="Stock symbol cannot be empty.")
    if len(symbol) > 20:
        raise HTTPException(status_code=400, detail="Symbol too long.")
    return symbol


# ── Demo / fallback data (used when yfinance network calls fail) ───────────────
_DEMO_QUOTES: Dict[str, Dict] = {
    # Indices
    "^NSEI":    {"company_name":"NIFTY 50",                "current_price":22847.55,"open":22700.0,"high":22910.0,"low":22650.0,"previous_close":22724.10,"change":123.45,"change_percent":0.54,"volume":300000000,"market_cap":None,"pe_ratio":None,"fifty_two_week_high":24198.85,"fifty_two_week_low":19270.25,"currency":"INR","exchange":"NSE"},
    "^BSESN":   {"company_name":"BSE SENSEX",              "current_price":75418.04,"open":75020.0,"high":75620.0,"low":74880.0,"previous_close":75017.24,"change":400.80,"change_percent":0.53,"volume":None,"market_cap":None,"pe_ratio":None,"fifty_two_week_high":79671.58,"fifty_two_week_low":63117.15,"currency":"INR","exchange":"BSE"},
    "^NSEBANK": {"company_name":"NIFTY BANK",              "current_price":49281.65,"open":49350.0,"high":49510.0,"low":49100.0,"previous_close":49331.85,"change":-50.20,"change_percent":-0.10,"volume":None,"market_cap":None,"pe_ratio":None,"fifty_two_week_high":53357.70,"fifty_two_week_low":42213.55,"currency":"INR","exchange":"NSE"},
    # Top NSE stocks
    "RELIANCE.NS":   {"company_name":"Reliance Industries Ltd",        "current_price":2938.50,"open":2920.0,"high":2965.0,"low":2905.0,"previous_close":2920.25,"change":18.25,"change_percent":0.63,"volume":5842310,"market_cap":19868000000000,"pe_ratio":27.4,"fifty_two_week_high":3217.90,"fifty_two_week_low":2220.15,"currency":"INR","exchange":"NSE"},
    "TCS.NS":        {"company_name":"Tata Consultancy Services Ltd",  "current_price":4102.80,"open":4115.0,"high":4140.0,"low":4090.0,"previous_close":4115.10,"change":-12.30,"change_percent":-0.30,"volume":1234567,"market_cap":14898000000000,"pe_ratio":31.2,"fifty_two_week_high":4592.25,"fifty_two_week_low":3311.80,"currency":"INR","exchange":"NSE"},
    "INFY.NS":       {"company_name":"Infosys Ltd",                    "current_price":1756.40,"open":1748.0,"high":1770.0,"low":1742.0,"previous_close":1747.50,"change":8.90,"change_percent":0.51,"volume":2341234,"market_cap":7298000000000,"pe_ratio":24.8,"fifty_two_week_high":1987.00,"fifty_two_week_low":1355.40,"currency":"INR","exchange":"NSE"},
    "HDFCBANK.NS":   {"company_name":"HDFC Bank Ltd",                  "current_price":1678.25,"open":1658.0,"high":1692.0,"low":1652.0,"previous_close":1656.15,"change":22.10,"change_percent":1.33,"volume":4521234,"market_cap":12781000000000,"pe_ratio":18.6,"fifty_two_week_high":1880.00,"fifty_two_week_low":1363.55,"currency":"INR","exchange":"NSE"},
    "ICICIBANK.NS":  {"company_name":"ICICI Bank Ltd",                 "current_price":1245.60,"open":1238.0,"high":1256.0,"low":1230.0,"previous_close":1251.00,"change":-5.40,"change_percent":-0.43,"volume":3214567,"market_cap":8763000000000,"pe_ratio":20.1,"fifty_two_week_high":1388.80,"fifty_two_week_low":970.00,"currency":"INR","exchange":"NSE"},
    "WIPRO.NS":      {"company_name":"Wipro Ltd",                      "current_price":543.80,"open":540.0,"high":549.0,"low":537.0,"previous_close":540.60,"change":3.20,"change_percent":0.59,"volume":1876543,"market_cap":2853000000000,"pe_ratio":22.3,"fifty_two_week_high":627.00,"fifty_two_week_low":420.00,"currency":"INR","exchange":"NSE"},
    "SBIN.NS":       {"company_name":"State Bank of India",            "current_price":756.40,"open":750.0,"high":762.0,"low":748.0,"previous_close":750.85,"change":5.55,"change_percent":0.74,"volume":9876543,"market_cap":6748000000000,"pe_ratio":10.2,"fifty_two_week_high":912.00,"fifty_two_week_low":600.65,"currency":"INR","exchange":"NSE"},
    "MARUTI.NS":     {"company_name":"Maruti Suzuki India Ltd",        "current_price":12450.60,"open":12400.0,"high":12520.0,"low":12380.0,"previous_close":12402.80,"change":47.80,"change_percent":0.39,"volume":456789,"market_cap":3767000000000,"pe_ratio":29.8,"fifty_two_week_high":13680.00,"fifty_two_week_low":9650.00,"currency":"INR","exchange":"NSE"},
    "SUNPHARMA.NS":  {"company_name":"Sun Pharmaceutical Industries",  "current_price":1687.30,"open":1675.0,"high":1698.0,"low":1668.0,"previous_close":1672.45,"change":14.85,"change_percent":0.89,"volume":1234432,"market_cap":4045000000000,"pe_ratio":36.4,"fifty_two_week_high":1936.15,"fifty_two_week_low":1195.00,"currency":"INR","exchange":"NSE"},
    "TATAMOTORS.NS": {"company_name":"Tata Motors Ltd",                "current_price":872.45,"open":866.0,"high":882.0,"low":860.0,"previous_close":868.90,"change":3.55,"change_percent":0.41,"volume":5432109,"market_cap":3213000000000,"pe_ratio":8.6,"fifty_two_week_high":1179.00,"fifty_two_week_low":700.00,"currency":"INR","exchange":"NSE"},
    "HCLTECH.NS":    {"company_name":"HCL Technologies Ltd",           "current_price":1568.20,"open":1558.0,"high":1580.0,"low":1550.0,"previous_close":1555.40,"change":12.80,"change_percent":0.82,"volume":1876540,"market_cap":4247000000000,"pe_ratio":27.6,"fifty_two_week_high":1960.00,"fifty_two_week_low":1235.00,"currency":"INR","exchange":"NSE"},
    "BAJFINANCE.NS": {"company_name":"Bajaj Finance Ltd",              "current_price":7234.50,"open":7180.0,"high":7280.0,"low":7165.0,"previous_close":7198.60,"change":35.90,"change_percent":0.50,"volume":876543,"market_cap":4363000000000,"pe_ratio":28.4,"fifty_two_week_high":8192.00,"fifty_two_week_low":6187.00,"currency":"INR","exchange":"NSE"},
    "ITC.NS":        {"company_name":"ITC Ltd",                        "current_price":448.70,"open":445.0,"high":453.0,"low":444.0,"previous_close":446.30,"change":2.40,"change_percent":0.54,"volume":8765432,"market_cap":5604000000000,"pe_ratio":27.1,"fifty_two_week_high":528.45,"fifty_two_week_low":399.35,"currency":"INR","exchange":"NSE"},
    "AXISBANK.NS":   {"company_name":"Axis Bank Ltd",                  "current_price":1142.80,"open":1136.0,"high":1155.0,"low":1130.0,"previous_close":1138.55,"change":4.25,"change_percent":0.37,"volume":2345678,"market_cap":3516000000000,"pe_ratio":15.8,"fifty_two_week_high":1339.65,"fifty_two_week_low":970.00,"currency":"INR","exchange":"NSE"},
    "KOTAKBANK.NS":  {"company_name":"Kotak Mahindra Bank Ltd",        "current_price":1876.40,"open":1868.0,"high":1890.0,"low":1860.0,"previous_close":1870.25,"change":6.15,"change_percent":0.33,"volume":1234321,"market_cap":3731000000000,"pe_ratio":23.4,"fifty_two_week_high":2062.00,"fifty_two_week_low":1543.85,"currency":"INR","exchange":"NSE"},
    "NTPC.NS":       {"company_name":"NTPC Ltd",                       "current_price":342.80,"open":340.0,"high":347.0,"low":338.0,"previous_close":340.45,"change":2.35,"change_percent":0.69,"volume":6543210,"market_cap":3318000000000,"pe_ratio":17.2,"fifty_two_week_high":448.45,"fifty_two_week_low":271.75,"currency":"INR","exchange":"NSE"},
    "ONGC.NS":       {"company_name":"Oil & Natural Gas Corporation",  "current_price":268.40,"open":265.0,"high":271.0,"low":264.0,"previous_close":266.85,"change":1.55,"change_percent":0.58,"volume":7654321,"market_cap":3372000000000,"pe_ratio":7.8,"fifty_two_week_high":345.00,"fifty_two_week_low":215.85,"currency":"INR","exchange":"NSE"},
    "DRREDDY.NS":    {"company_name":"Dr Reddy's Laboratories Ltd",    "current_price":6234.80,"open":6200.0,"high":6270.0,"low":6185.0,"previous_close":6215.40,"change":19.40,"change_percent":0.31,"volume":345678,"market_cap":1037000000000,"pe_ratio":19.7,"fifty_two_week_high":7453.00,"fifty_two_week_low":5100.00,"currency":"INR","exchange":"NSE"},
    "CIPLA.NS":      {"company_name":"Cipla Ltd",                      "current_price":1478.50,"open":1470.0,"high":1490.0,"low":1462.0,"previous_close":1471.80,"change":6.70,"change_percent":0.46,"volume":987654,"market_cap":1191000000000,"pe_ratio":22.3,"fifty_two_week_high":1702.00,"fifty_two_week_low":1165.00,"currency":"INR","exchange":"NSE"},
    # Also support .BO suffix (same data)
    "RELIANCE.BO":   {"company_name":"Reliance Industries Ltd",        "current_price":2937.20,"open":2919.0,"high":2963.0,"low":2904.0,"previous_close":2919.00,"change":18.20,"change_percent":0.62,"volume":1234567,"market_cap":19868000000000,"pe_ratio":27.4,"fifty_two_week_high":3217.90,"fifty_two_week_low":2220.15,"currency":"INR","exchange":"BSE"},
    "TCS.BO":        {"company_name":"Tata Consultancy Services Ltd",  "current_price":4101.50,"open":4114.0,"high":4139.0,"low":4089.0,"previous_close":4113.90,"change":-12.40,"change_percent":-0.30,"volume":234567,"market_cap":14898000000000,"pe_ratio":31.2,"fifty_two_week_high":4592.25,"fifty_two_week_low":3311.80,"currency":"INR","exchange":"BSE"},
}

def _demo_history(symbol: str, period: str = "3mo") -> List[Dict]:
    """Generate synthetic price history from demo quote data."""
    import math, random
    q = _DEMO_QUOTES.get(symbol)
    if not q:
        return []
    base = q["current_price"]
    period_days = {"1mo": 22, "3mo": 66, "6mo": 132, "1y": 252, "2y": 504, "5y": 1260, "5d": 5}
    days = period_days.get(period, 66)
    random.seed(hash(symbol) % 100000)
    prices = []
    price = base * (1 - (days / 252) * 0.12)
    end = datetime.now()
    trading_dates = []
    d = end - timedelta(days=int(days * 1.5))
    while len(trading_dates) < days and d <= end:
        if d.weekday() < 5:
            trading_dates.append(d)
        d += timedelta(days=1)
    for dt in trading_dates[-days:]:
        daily_return = random.gauss(0.0003, 0.015)
        price = max(price * (1 + daily_return), 1)
        high = price * (1 + abs(random.gauss(0, 0.008)))
        low  = price * (1 - abs(random.gauss(0, 0.008)))
        open_ = price * (1 + random.gauss(0, 0.005))
        vol = int((q.get("volume") or 1000000) * random.uniform(0.5, 1.5))
        prices.append({
            "date": dt.strftime("%Y-%m-%d"),
            "open": round(open_, 2),
            "high": round(high, 2),
            "low": round(low, 2),
            "close": round(price, 2),
            "volume": vol,
        })
    # Ensure last close matches demo current_price
    if prices:
        prices[-1]["close"] = base
    return prices


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

# ── LTCG / STCG tax rates (Week 5-6) ─────────────────────────────────────────
LTCG_EQUITY_RATE = 0.10      # 10% on gains > ₹1 lakh (held > 1 year)
LTCG_EXEMPTION = 100000      # ₹1 lakh exemption
STCG_EQUITY_RATE = 0.15      # 15% (held ≤ 1 year)

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


# ══════════════════════════════════════════════════════════════════════════════
#  WEEK 1-2 — Stock price chatbot & Indian stock support
# ══════════════════════════════════════════════════════════════════════════════

@app.get("/api/v1/stocks/quote/{symbol}")
async def get_stock_quote(symbol: str):
    """
    Get current stock quote for any symbol.
    Use .NS suffix for NSE (e.g. RELIANCE.NS) and .BO for BSE (e.g. RELIANCE.BO).
    Falls back to demo data when live market data is unavailable.
    """
    symbol = _validate_symbol(symbol)
    data = _fetch_yf(symbol, period="5d", interval="1d")
    if data and data["prices"]:
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
            "demo": False,
        }
    # Fallback to demo data when yfinance unavailable
    demo = _DEMO_QUOTES.get(symbol)
    if demo:
        return {**demo, "symbol": symbol, "timestamp": datetime.utcnow().isoformat(), "demo": True}
    raise HTTPException(status_code=404, detail=f"No data found for {symbol}")


@app.get("/api/v1/stocks/historical/{symbol}")
async def get_historical_data(
    symbol: str,
    period: str = Query("3mo", description="1mo | 3mo | 6mo | 1y | 2y | 5y"),
    interval: str = Query("1d", description="1d | 1wk | 1mo"),
):
    """Historical OHLCV data for a stock. Falls back to synthetic demo data when live data unavailable."""
    symbol = _validate_symbol(symbol)
    data = _fetch_yf(symbol, period=period, interval=interval)
    if data and data["prices"]:
        return {
            "symbol": symbol,
            "period": period,
            "interval": interval,
            "count": len(data["prices"]),
            "data": data["prices"],
            "demo": False,
        }
    # Fallback: synthetic history
    demo_prices = _demo_history(symbol, period)
    if demo_prices:
        return {
            "symbol": symbol,
            "period": period,
            "interval": interval,
            "count": len(demo_prices),
            "data": demo_prices,
            "demo": True,
        }
    raise HTTPException(status_code=404, detail=f"No data for {symbol}")


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
    Falls back to demo data when live data is unavailable.
    """
    symbol = _validate_symbol(symbol)
    data = _fetch_yf(symbol, period="1y", interval="1d")
    if data and data["prices"]:
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
            "demo": False,
            "disclaimer": "This is not financial advice. Consult a SEBI-registered advisor.",
        }
    # Fallback: use synthetic history to compute real technicals
    demo_prices = _demo_history(symbol, "1y")
    demo_quote = _DEMO_QUOTES.get(symbol)
    if not demo_prices and not demo_quote:
        raise HTTPException(status_code=404, detail=f"No data for {symbol}")
    closes = [p["close"] for p in demo_prices] if demo_prices else []
    current = (demo_quote or {}).get("current_price", closes[-1] if closes else 0)
    if len(closes) < 2:
        closes = [current * 0.98, current]
    technicals = _technicals_summary(closes, current)
    company_name = (demo_quote or {}).get("company_name", symbol.split(".")[0])
    return {
        "symbol": symbol,
        "company_name": company_name,
        "current_price": current,
        "sector": "N/A",
        "industry": "N/A",
        "pe_ratio": (demo_quote or {}).get("pe_ratio"),
        "pb_ratio": None,
        "dividend_yield": None,
        "market_cap": (demo_quote or {}).get("market_cap"),
        "debt_to_equity": None,
        "roe": None,
        "revenue_growth": None,
        "technicals": technicals,
        "analysis_date": datetime.utcnow().isoformat(),
        "demo": True,
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
        if data and data["prices"]:
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
                "demo": False,
            })
        else:
            # Fallback to demo data
            demo_q = _DEMO_QUOTES.get(sym)
            demo_prices = _demo_history(sym, "1y")
            if demo_q:
                closes = [p["close"] for p in demo_prices] if demo_prices else [demo_q["current_price"]]
                current = demo_q["current_price"]
                week_ago = closes[-5] if len(closes) >= 5 else closes[0]
                month_ago = closes[-21] if len(closes) >= 21 else closes[0]
                year_ago = closes[0]
                results.append({
                    "symbol": sym,
                    "company": demo_q.get("company_name", sym.split(".")[0]),
                    "price": current,
                    "change_1w_pct": round((current - week_ago) / week_ago * 100, 2) if week_ago else 0,
                    "change_1m_pct": round((current - month_ago) / month_ago * 100, 2) if month_ago else 0,
                    "change_1y_pct": round((current - year_ago) / year_ago * 100, 2) if year_ago else 0,
                    "pe_ratio": demo_q.get("pe_ratio"),
                    "market_cap": demo_q.get("market_cap"),
                    "sector": None,
                    "rsi": _rsi(closes) if len(closes) > 14 else None,
                    "recommendation": _technicals_summary(closes, current)["recommendation"] if len(closes) > 1 else "HOLD",
                    "demo": True,
                })
            else:
                results.append({"symbol": sym, "error": "No data found"})
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
    used_demo = False
    for sym in stocks:
        data = _fetch_yf(sym, period="3mo", interval="1d")
        if data and data["prices"]:
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
        else:
            # Fallback to demo data for this stock
            demo_q = _DEMO_QUOTES.get(sym)
            demo_prices = _demo_history(sym, "3mo")
            if demo_q:
                used_demo = True
                closes = [p["close"] for p in demo_prices] if demo_prices else [demo_q["current_price"]]
                start = closes[0] if closes else demo_q["current_price"]
                current = demo_q["current_price"]
                ret = round((current - start) / start * 100, 2) if start else 0
                results.append({
                    "symbol": sym,
                    "company": demo_q.get("company_name", sym.split(".")[0]),
                    "price": current,
                    "return_3m_pct": ret,
                    "pe_ratio": demo_q.get("pe_ratio"),
                    "market_cap": demo_q.get("market_cap"),
                    "recommendation": _technicals_summary(closes, current)["recommendation"] if len(closes) > 1 else "HOLD",
                })
    results.sort(key=lambda x: x.get("return_3m_pct", 0), reverse=True)
    return {
        "sector": sector,
        "stocks_analysed": len(results),
        "data": results,
        "top_performer": results[0]["symbol"] if results else None,
        "demo": used_demo,
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
    Equity: STCG 15% (≤1 yr) | LTCG 10% on gains > ₹1 lakh (>1 yr)
    Debt: taxed at income slab rate (assumed 30% for estimate)
    """
    total_buy = req.buy_price * req.quantity
    total_sell = req.sell_price * req.quantity
    gain = total_sell - total_buy
    holding_months = req.holding_days / 30

    if req.asset_type.lower() == "equity":
        is_ltcg = req.holding_days > 365
        if is_ltcg:
            taxable_gain = max(0, gain - LTCG_EXEMPTION)
            tax = taxable_gain * LTCG_EQUITY_RATE
            txn_type = "LTCG"
            rate_applied = f"{LTCG_EQUITY_RATE*100}% on gains above ₹{LTCG_EXEMPTION:,}"
        else:
            taxable_gain = gain if gain > 0 else 0
            tax = taxable_gain * STCG_EQUITY_RATE
            txn_type = "STCG"
            rate_applied = f"{STCG_EQUITY_RATE*100}%"
    else:
        is_ltcg = req.holding_days > 1095
        taxable_gain = gain if gain > 0 else 0
        tax = taxable_gain * 0.20 if is_ltcg else taxable_gain * 0.30
        txn_type = "LTCG" if is_ltcg else "STCG"
        rate_applied = "20% with indexation" if is_ltcg else "30% (as per slab)"

    return {
        "asset_type": req.asset_type,
        "buy_price": req.buy_price,
        "sell_price": req.sell_price,
        "quantity": req.quantity,
        "holding_days": req.holding_days,
        "holding_months": round(holding_months, 1),
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
    """AI financial assistant. Uses Claude if ANTHROPIC_API_KEY is set, else rule-based fallback."""
    api_key = os.environ.get("ANTHROPIC_API_KEY", "")
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
            logger.error(f"Claude error: {e}")

    # Rule-based fallback
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
                  f"Set ANTHROPIC_API_KEY for full Claude-powered responses. "
                  f"You asked: \"{user_msg}\"")
    return {
        "response": answer,
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


# ── Entry point ───────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
