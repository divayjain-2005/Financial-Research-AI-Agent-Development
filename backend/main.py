import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import yfinance as yf
from datetime import datetime, timedelta
from typing import List, Optional, Dict
import numpy as np
import time

app = FastAPI(
    title="Financial Research AI Agent",
    version="0.2.0",
    description="AI-powered financial research with yfinance"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==================== Cache & Rate Limiting ====================
class CacheEntry:
    def __init__(self, data, ttl_minutes=10):
        self.data = data
        self.created_at = datetime.now()
        self.ttl = timedelta(minutes=ttl_minutes)
    
    def is_expired(self):
        return datetime.now() - self.created_at > self.ttl

cache = {}
request_times = []

def get_cached(key):
    if key in cache:
        entry = cache[key]
        if not entry.is_expired():
            return entry.data
        else:
            del cache[key]
    return None

def set_cache(key, data, ttl=10):
    cache[key] = CacheEntry(data, ttl)

def rate_limit_request():
    """Simple rate limiting - max 2 requests per second"""
    now = time.time()
    request_times.append(now)
    request_times[:] = [t for t in request_times if now - t < 2]
    
    if len(request_times) > 2:
        sleep_time = 2 - (now - request_times[0])
        if sleep_time > 0:
            time.sleep(sleep_time)

def fetch_with_retry(symbol: str, max_retries=3):
    """Fetch ticker with retry logic"""
    for attempt in range(max_retries):
        try:
            rate_limit_request()
            ticker = yf.Ticker(symbol)
            data = ticker.history(period="1d")
            info = ticker.info
            
            if len(data) > 0 and 'Close' in data.columns:
                return data, info
        except Exception as e:
            if attempt < max_retries - 1:
                wait_time = 2 ** attempt
                time.sleep(wait_time)
            else:
                print(f"Failed to fetch {symbol} after {max_retries} attempts: {str(e)}")
    
    return None, {}

# ==================== Data Models ====================

class StockQuote(BaseModel):
    symbol: str
    price: float
    change: Optional[float] = None
    change_percent: Optional[float] = None
    timestamp: str
    status: str = "success"

class TechnicalIndicators(BaseModel):
    symbol: str
    sma_50: Optional[float] = None
    sma_200: Optional[float] = None
    rsi: Optional[float] = None
    current_price: Optional[float] = None

class StockAnalysis(BaseModel):
    symbol: str
    price: float
    rsi: Optional[float] = None
    sma_50: Optional[float] = None
    sma_200: Optional[float] = None
    sentiment: Optional[str] = None
    recommendation: Optional[str] = None
    timestamp: str

class PortfolioStock(BaseModel):
    symbol: str
    quantity: float
    purchase_price: float
    purchase_date: str

# ==================== Technical Calculations ====================

def calculate_sma(prices: List[float], period: int) -> Optional[float]:
    """Calculate SMA"""
    try:
        if len(prices) < period:
            return None
        return round(float(np.mean(prices[:period])), 2)
    except:
        return None

def calculate_rsi(prices: List[float], period: int = 14) -> Optional[float]:
    """Calculate RSI"""
    try:
        if len(prices) < period + 1:
            return None
        
        prices_array = np.array(prices, dtype=float)
        deltas = np.diff(prices_array)
        seed = deltas[:period+1]
        
        up = seed[seed >= 0].sum() / period
        down = -seed[seed < 0].sum() / period
        
        rs = up / down if down != 0 else 0
        rsi = 100 - 100 / (1 + rs) if rs >= 0 else 0
        
        return round(float(rsi), 2)
    except:
        return None

# ==================== API Endpoints ====================

@app.get("/")
async def root():
    return {
        "message": "Financial Research AI Agent",
        "version": "0.2.0",
        "week": "2",
        "data_source": "yfinance",
        "status": "✅ Running"
    }

@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "version": "0.2.0",
        "week": "2",
        "data_source": "yfinance",
        "cache_size": len(cache),
        "features": ["Stock Quotes", "Technical Analysis", "Portfolio Tracking"]
    }

@app.get("/api/v1/stocks/quote/{symbol}", response_model=StockQuote)
async def get_stock_quote(symbol: str):
    """Get stock quote"""
    cache_key = f"quote_{symbol}"
    cached = get_cached(cache_key)
    if cached:
        return cached
    
    try:
        data, info = fetch_with_retry(symbol)
        
        if data is not None and len(data) > 0:
            price = float(data['Close'].iloc[-1])
            
            prev_close = info.get('previousClose')
            if prev_close:
                change = price - prev_close
                change_percent = (change / prev_close * 100)
            else:
                change = 0
                change_percent = 0
            
            result = StockQuote(
                symbol=symbol,
                price=round(price, 2),
                change=round(change, 2),
                change_percent=round(change_percent, 2),
                timestamp=datetime.now().isoformat(),
                status="success"
            )
            set_cache(cache_key, result, ttl=10)
            return result
    except Exception as e:
        print(f"Error: {str(e)}")
    
    raise HTTPException(status_code=404, detail=f"Could not fetch {symbol}")

@app.get("/api/v1/stocks/analyze/{symbol}", response_model=StockAnalysis)
async def analyze_stock(symbol: str):
    """Complete stock analysis"""
    try:
        cache_key = f"analysis_{symbol}"
        cached = get_cached(cache_key)
        if cached:
            return cached
        
        # Get quote
        data, info = fetch_with_retry(symbol)
        if data is None or len(data) == 0:
            raise HTTPException(status_code=404, detail=f"No data for {symbol}")
        
        price = float(data['Close'].iloc[-1])
        
        # Get indicators
        prices = data['Close'].values.tolist()
        prices.reverse()
        
        sma_50 = calculate_sma(prices, 50)
        sma_200 = calculate_sma(prices, 200)
        rsi = calculate_rsi(prices)
        
        # Determine sentiment and recommendation
        sentiment = "NEUTRAL"
        recommendation = "HOLD"
        
        if rsi:
            if rsi < 30:
                sentiment = "OVERSOLD"
                recommendation = "STRONG BUY"
            elif rsi < 40:
                sentiment = "WEAK"
                recommendation = "BUY"
            elif rsi > 70:
                sentiment = "OVERBOUGHT"
                recommendation = "STRONG SELL"
            elif rsi > 60:
                sentiment = "STRONG"
                recommendation = "SELL"
            else:
                sentiment = "NEUTRAL"
                recommendation = "HOLD"
        
        result = StockAnalysis(
            symbol=symbol,
            price=round(price, 2),
            rsi=rsi,
            sma_50=sma_50,
            sma_200=sma_200,
            sentiment=sentiment,
            recommendation=recommendation,
            timestamp=datetime.now().isoformat()
        )
        set_cache(cache_key, result, ttl=10)
        return result
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/v1/stocks/compare")
async def compare_stocks(symbols: List[str] = Query(...)):
    """Compare stocks"""
    if len(symbols) < 2:
        raise HTTPException(status_code=400, detail="Provide at least 2 symbols")
    
    results = []
    for symbol in symbols:
        try:
            data, info = fetch_with_retry(symbol)
            if data is not None and len(data) > 0:
                price = float(data['Close'].iloc[-1])
                prev_close = info.get('previousClose', price)
                change_percent = ((price - prev_close) / prev_close * 100) if prev_close > 0 else 0
                
                results.append({
                    "symbol": symbol,
                    "price": round(price, 2),
                    "change_percent": round(change_percent, 2),
                    "status": "✅ UP" if change_percent > 0 else "❌ DOWN" if change_percent < 0 else "➡️ NEUTRAL"
                })
        except:
            pass
    
    if not results:
        raise HTTPException(status_code=404, detail="Could not fetch data")
    
    results = sorted(results, key=lambda x: x["change_percent"], reverse=True)
    return {
        "symbols": symbols,
        "count": len(results),
        "results": results,
        "best": results[0]["symbol"] if results else None,
        "worst": results[-1]["symbol"] if results else None
    }

@app.post("/api/v1/portfolio/calculate")
async def calculate_portfolio(stocks: List[PortfolioStock]):
    """Calculate portfolio"""
    if not stocks:
        raise HTTPException(status_code=400, detail="Empty portfolio")
    
    total_invested = 0
    total_current = 0
    portfolio = []
    
    for stock in stocks:
        try:
            data, info = fetch_with_retry(stock.symbol)
            if data is None or len(data) == 0:
                continue
            
            price = float(data['Close'].iloc[-1])
            invested = stock.quantity * stock.purchase_price
            current = stock.quantity * price
            gain_loss = current - invested
            gain_loss_pct = (gain_loss / invested * 100) if invested > 0 else 0
            
            total_invested += invested
            total_current += current
            
            portfolio.append({
                "symbol": stock.symbol,
                "qty": stock.quantity,
                "buy_price": stock.purchase_price,
                "current_price": round(price, 2),
                "invested": round(invested, 2),
                "current_value": round(current, 2),
                "gain_loss": round(gain_loss, 2),
                "gain_loss_pct": round(gain_loss_pct, 2),
                "status": "📈" if gain_loss > 0 else "📉" if gain_loss < 0 else "➡️"
            })
        except:
            pass
    
    total_gain_loss = total_current - total_invested
    total_gain_loss_pct = (total_gain_loss / total_invested * 100) if total_invested > 0 else 0
    
    return {
        "portfolio": portfolio,
        "total_invested": round(total_invested, 2),
        "total_current": round(total_current, 2),
        "total_gain_loss": round(total_gain_loss, 2),
        "total_gain_loss_pct": round(total_gain_loss_pct, 2),
        "status": "📈 PROFIT" if total_gain_loss > 0 else "📉 LOSS" if total_gain_loss < 0 else "➡️ BREAK EVEN"
    }

@app.get("/api/v1/market-status")
async def market_status():
    """Market overview"""
    symbols = ["RELIANCE.NS", "TCS.NS", "INFY.NS", "HDFC.NS", "ICICIBANK.NS"]
    
    results = []
    for symbol in symbols:
        try:
            data, info = fetch_with_retry(symbol)
            if data is not None and len(data) > 0:
                price = float(data['Close'].iloc[-1])
                prev_close = info.get('previousClose', price)
                change_pct = ((price - prev_close) / prev_close * 100) if prev_close > 0 else 0
                
                results.append({
                    "symbol": symbol,
                    "price": round(price, 2),
                    "change_percent": round(change_pct, 2)
                })
        except:
            pass
    
    if not results:
        return {"status": "Loading market data...", "message": "Try again in a moment"}
    
    results = sorted(results, key=lambda x: x["change_percent"], reverse=True)
    
    return {
        "market": "NSE/BSE",
        "timestamp": datetime.now().isoformat(),
        "top_gainers": results[:3],
        "top_losers": results[-3:],
        "total": len(results)
    }

@app.get("/api/v1/cache")
async def cache_info():
    """Cache status"""
    return {
        "cached_items": len(cache),
        "keys": list(cache.keys()),
        "status": "✅ Active"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
