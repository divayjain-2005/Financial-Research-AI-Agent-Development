import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os
import requests
from datetime import datetime, timedelta
from typing import List, Optional, Dict
import time
import json

app = FastAPI(
    title="Financial Research AI Agent",
    version="0.2.0",
    description="AI-powered financial research assistant with Alpha Vantage"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

ALPHA_VANTAGE_KEY = os.getenv("ALPHA_VANTAGE_API_KEY", "demo")
ALPHA_VANTAGE_BASE_URL = "https://www.alphavantage.co/query"

# ==================== Cache System ====================
class CacheEntry:
    def __init__(self, data, ttl_minutes=60):
        self.data = data
        self.created_at = datetime.now()
        self.ttl = timedelta(minutes=ttl_minutes)
    
    def is_expired(self):
        return datetime.now() - self.created_at > self.ttl

cache = {}
last_api_call = {"time": 0}

def get_cached(key):
    if key in cache:
        entry = cache[key]
        if not entry.is_expired():
            return entry.data
        else:
            del cache[key]
    return None

def set_cache(key, data, ttl=60):
    cache[key] = CacheEntry(data, ttl)

def rate_limit():
    """Enforce 1 request per 2 seconds for free tier"""
    now = time.time()
    if now - last_api_call["time"] < 2:
        time.sleep(2 - (now - last_api_call["time"]))
    last_api_call["time"] = time.time()

# ==================== Data Models ====================

class StockQuote(BaseModel):
    symbol: str
    price: float
    change: float
    change_percent: float
    timestamp: str

class TechnicalIndicators(BaseModel):
    symbol: str
    sma_50: Optional[float] = None
    sma_200: Optional[float] = None
    rsi: Optional[float] = None

class StockAnalysis(BaseModel):
    symbol: str
    quote: StockQuote
    indicators: TechnicalIndicators
    sentiment: Optional[str] = None
    recommendation: Optional[str] = None

class PortfolioStock(BaseModel):
    symbol: str
    quantity: float
    purchase_price: float
    purchase_date: str

# ==================== Alpha Vantage Functions ====================

def fetch_stock_quote(symbol: str) -> Optional[Dict]:
    """Fetch stock quote with caching"""
    cache_key = f"quote_{symbol}"
    cached = get_cached(cache_key)
    if cached:
        return cached
    
    try:
        rate_limit()
        params = {
            "function": "GLOBAL_QUOTE",
            "symbol": symbol,
            "apikey": ALPHA_VANTAGE_KEY
        }
        response = requests.get(ALPHA_VANTAGE_BASE_URL, params=params, timeout=10)
        data = response.json()
        
        if "Global Quote" in data and data["Global Quote"].get("05. price"):
            quote = data["Global Quote"]
            result = {
                "symbol": symbol,
                "price": float(quote.get("05. price", 0)),
                "change": float(quote.get("09. change", 0)),
                "change_percent": float(quote.get("10. change percent", "0").replace("%", "")),
                "timestamp": datetime.now().isoformat()
            }
            set_cache(cache_key, result, ttl=30)
            return result
    except Exception as e:
        print(f"Error: {str(e)}")
    
    return None

def fetch_historical_data(symbol: str) -> Optional[Dict]:
    """Fetch historical data with caching"""
    cache_key = f"historical_{symbol}"
    cached = get_cached(cache_key)
    if cached:
        return cached
    
    try:
        rate_limit()
        params = {
            "function": "TIME_SERIES_DAILY",
            "symbol": symbol,
            "outputsize": "full",
            "apikey": ALPHA_VANTAGE_KEY
        }
        response = requests.get(ALPHA_VANTAGE_BASE_URL, params=params, timeout=10)
        data = response.json()
        
        if "Time Series (Daily)" in data:
            set_cache(cache_key, data, ttl=60)
            return data
    except Exception as e:
        print(f"Error: {str(e)}")
    
    return None

def calculate_sma(prices: List[float], period: int) -> Optional[float]:
    """Calculate Simple Moving Average"""
    if len(prices) < period:
        return None
    return sum(prices[:period]) / period

def calculate_rsi(prices: List[float], period: int = 14) -> Optional[float]:
    """Calculate RSI"""
    if len(prices) < period + 1:
        return None
    
    changes = [prices[i] - prices[i+1] for i in range(len(prices)-1)]
    gains = [c for c in changes if c > 0]
    losses = [abs(c) for c in changes if c < 0]
    
    avg_gain = sum(gains) / period if gains else 0
    avg_loss = sum(losses) / period if losses else 0
    
    if avg_loss == 0:
        return 100 if avg_gain > 0 else 0
    
    rs = avg_gain / avg_loss
    rsi = 100 - (100 / (1 + rs))
    return rsi

def get_technical_indicators(symbol: str) -> Optional[TechnicalIndicators]:
    """Get technical indicators"""
    try:
        data = fetch_historical_data(symbol)
        if not data or "Time Series (Daily)" not in data:
            return None
        
        time_series = data["Time Series (Daily)"]
        dates = sorted(time_series.keys())
        prices = [float(time_series[date]["4. close"]) for date in dates[-200:]]
        prices.reverse()
        
        sma_50 = calculate_sma(prices, 50)
        sma_200 = calculate_sma(prices, 200)
        rsi = calculate_rsi(prices)
        
        return TechnicalIndicators(
            symbol=symbol,
            sma_50=sma_50,
            sma_200=sma_200,
            rsi=rsi
        )
    except Exception as e:
        print(f"Error: {str(e)}")
    
    return None

def get_sentiment_score(symbol: str) -> Optional[str]:
    """Get sentiment based on RSI"""
    try:
        indicators = get_technical_indicators(symbol)
        if not indicators or not indicators.rsi:
            return "NEUTRAL"
        
        rsi = indicators.rsi
        if rsi < 30:
            return "OVERSOLD (Strong Buy Signal)"
        elif rsi > 70:
            return "OVERBOUGHT (Strong Sell Signal)"
        elif rsi < 50:
            return "BEARISH"
        else:
            return "BULLISH"
    except:
        return "NEUTRAL"

# ==================== API Endpoints ====================

@app.get("/")
async def root():
    return {
        "message": "Financial Research AI Agent",
        "version": "0.2.0",
        "week": "2",
        "api": "Alpha Vantage (Optimized with Caching)"
    }

@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "service": "Financial Research AI Agent",
        "week": "2",
        "cache_size": len(cache),
        "features": ["Real Stock Data", "Technical Indicators", "Sentiment Analysis"]
    }

@app.get("/api/v1/stocks/quote/{symbol}", response_model=StockQuote)
async def get_stock_quote_endpoint(symbol: str):
    """Get real stock quote"""
    quote = fetch_stock_quote(symbol)
    if not quote:
        raise HTTPException(status_code=404, detail=f"Could not fetch quote for {symbol}")
    return StockQuote(**quote)

@app.get("/api/v1/stocks/technical/{symbol}")
async def get_technical_indicators_endpoint(symbol: str):
    """Get technical indicators"""
    indicators = get_technical_indicators(symbol)
    if not indicators:
        raise HTTPException(status_code=404, detail=f"Could not calculate indicators for {symbol}")
    return indicators

@app.get("/api/v1/stocks/analyze/{symbol}", response_model=StockAnalysis)
async def analyze_stock(symbol: str):
    """Complete stock analysis"""
    try:
        quote = fetch_stock_quote(symbol)
        if not quote:
            raise HTTPException(status_code=404, detail=f"Could not fetch data for {symbol}")
        
        indicators = get_technical_indicators(symbol)
        sentiment = get_sentiment_score(symbol)
        
        recommendation = "HOLD"
        if indicators and indicators.rsi:
            if indicators.rsi < 30:
                recommendation = "STRONG BUY"
            elif indicators.rsi < 40:
                recommendation = "BUY"
            elif indicators.rsi > 70:
                recommendation = "STRONG SELL"
            elif indicators.rsi > 60:
                recommendation = "SELL"
        
        return StockAnalysis(
            symbol=symbol,
            quote=StockQuote(**quote),
            indicators=indicators or TechnicalIndicators(symbol=symbol),
            sentiment=sentiment,
            recommendation=recommendation
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/v1/stocks/compare")
async def compare_stocks(symbols: List[str] = Query(...)):
    """Compare multiple stocks"""
    if len(symbols) < 2:
        raise HTTPException(status_code=400, detail="Provide at least 2 symbols")
    
    comparisons = []
    for symbol in symbols:
        try:
            quote = fetch_stock_quote(symbol)
            if quote:
                comparisons.append({
                    "symbol": symbol,
                    "price": quote["price"],
                    "change_percent": quote["change_percent"],
                    "performance": "UP" if quote["change"] > 0 else "DOWN"
                })
        except:
            pass
    
    if not comparisons:
        raise HTTPException(status_code=404, detail="Could not fetch data")
    
    return {
        "symbols": symbols,
        "comparisons": sorted(comparisons, key=lambda x: x["change_percent"], reverse=True),
        "best_performer": max(comparisons, key=lambda x: x["change_percent"])["symbol"],
        "worst_performer": min(comparisons, key=lambda x: x["change_percent"])["symbol"]
    }

@app.post("/api/v1/portfolio/calculate")
async def calculate_portfolio(stocks: List[PortfolioStock]):
    """Calculate portfolio performance"""
    if not stocks:
        raise HTTPException(status_code=400, detail="Portfolio cannot be empty")
    
    total_invested = 0
    total_current_value = 0
    portfolio_data = []
    
    for stock in stocks:
        quote = fetch_stock_quote(stock.symbol)
        if not quote:
            continue
        
        invested = stock.quantity * stock.purchase_price
        current_value = stock.quantity * quote["price"]
        gain_loss = current_value - invested
        gain_loss_percent = (gain_loss / invested * 100) if invested > 0 else 0
        
        total_invested += invested
        total_current_value += current_value
        
        portfolio_data.append({
            "symbol": stock.symbol,
            "quantity": stock.quantity,
            "purchase_price": stock.purchase_price,
            "current_price": quote["price"],
            "invested": invested,
            "current_value": current_value,
            "gain_loss": gain_loss,
            "gain_loss_percent": gain_loss_percent
        })
    
    total_gain_loss = total_current_value - total_invested
    total_gain_loss_percent = (total_gain_loss / total_invested * 100) if total_invested > 0 else 0
    
    return {
        "stocks": portfolio_data,
        "total_invested": total_invested,
        "total_current_value": total_current_value,
        "total_gain_loss": total_gain_loss,
        "total_gain_loss_percent": total_gain_loss_percent,
        "performance": "UP" if total_gain_loss > 0 else "DOWN" if total_gain_loss < 0 else "NEUTRAL"
    }

@app.get("/api/v1/market-status")
async def market_status():
    """Get market status"""
    symbols = ["RELIANCE.NS", "TCS.NS", "INFY.NS", "HDFC.NS", "ICICIBANK.NS"]
    
    data = []
    for symbol in symbols:
        try:
            quote = fetch_stock_quote(symbol)
            if quote:
                data.append({
                    "symbol": symbol,
                    "price": quote["price"],
                    "change": quote["change"],
                    "change_percent": quote["change_percent"]
                })
        except:
            pass
    
    if not data:
        return {"market": "NSE", "message": "No data available. Please wait and try again.", "reason": "Rate limit"}
    
    data = sorted(data, key=lambda x: x["change_percent"], reverse=True)
    
    return {
        "market": "NSE",
        "timestamp": datetime.now().isoformat(),
        "top_gainers": data[:3],
        "top_losers": data[-3:],
        "total_stocks": len(data)
    }

@app.get("/api/v1/cache/status")
async def cache_status():
    """Check cache status"""
    return {
        "cached_items": len(cache),
        "cache_keys": list(cache.keys()),
        "last_api_call": last_api_call["time"]
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
