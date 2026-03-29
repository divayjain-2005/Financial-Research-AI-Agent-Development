import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import yfinance as yf
from datetime import datetime, timedelta
from typing import List, Optional, Dict
import pandas as pd
import numpy as np

app = FastAPI(
    title="Financial Research AI Agent",
    version="0.2.0",
    description="AI-powered financial research with real-time data"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==================== Cache System ====================
class CacheEntry:
    def __init__(self, data, ttl_minutes=5):
        self.data = data
        self.created_at = datetime.now()
        self.ttl = timedelta(minutes=ttl_minutes)
    
    def is_expired(self):
        return datetime.now() - self.created_at > self.ttl

cache = {}

def get_cached(key):
    if key in cache:
        entry = cache[key]
        if not entry.is_expired():
            return entry.data
        else:
            del cache[key]
    return None

def set_cache(key, data, ttl=5):
    cache[key] = CacheEntry(data, ttl)

# ==================== Data Models ====================

class StockQuote(BaseModel):
    symbol: str
    price: float
    change: float
    change_percent: float
    timestamp: str
    currency: Optional[str] = None

class TechnicalIndicators(BaseModel):
    symbol: str
    sma_50: Optional[float] = None
    sma_200: Optional[float] = None
    rsi: Optional[float] = None
    current_price: Optional[float] = None

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

# ==================== yfinance Functions ====================

def fetch_stock_quote(symbol: str) -> Optional[Dict]:
    """Fetch real stock quote using yfinance"""
    cache_key = f"quote_{symbol}"
    cached = get_cached(cache_key)
    if cached:
        return cached
    
    try:
        ticker = yf.Ticker(symbol)
        data = ticker.history(period="1d")
        info = ticker.info
        
        if len(data) > 0:
            price = float(data['Close'].iloc[-1])
            
            # Get previous close for change calculation
            prev_close = info.get('previousClose', price)
            change = price - prev_close
            change_percent = (change / prev_close * 100) if prev_close > 0 else 0
            
            result = {
                "symbol": symbol,
                "price": round(price, 2),
                "change": round(change, 2),
                "change_percent": round(change_percent, 2),
                "currency": info.get('currency', 'INR'),
                "timestamp": datetime.now().isoformat()
            }
            set_cache(cache_key, result, ttl=5)
            return result
    except Exception as e:
        print(f"Error fetching {symbol}: {str(e)}")
    
    return None

def calculate_sma(prices: List[float], period: int) -> Optional[float]:
    """Calculate Simple Moving Average"""
    if len(prices) < period:
        return None
    return round(float(np.mean(prices[:period])), 2)

def calculate_rsi(prices: List[float], period: int = 14) -> Optional[float]:
    """Calculate RSI"""
    if len(prices) < period + 1:
        return None
    
    prices_array = np.array(prices)
    deltas = np.diff(prices_array)
    seed = deltas[:period+1]
    
    up = seed[seed >= 0].sum() / period
    down = -seed[seed < 0].sum() / period
    
    rs = up / down if down != 0 else 0
    rsi = 100 - 100 / (1 + rs)
    
    return round(float(rsi), 2)

def get_technical_indicators(symbol: str) -> Optional[TechnicalIndicators]:
    """Get technical indicators"""
    cache_key = f"indicators_{symbol}"
    cached = get_cached(cache_key)
    if cached:
        return cached
    
    try:
        ticker = yf.Ticker(symbol)
        data = ticker.history(period="1y")
        
        if len(data) < 50:
            return TechnicalIndicators(symbol=symbol)
        
        prices = data['Close'].values.tolist()
        prices.reverse()
        
        sma_50 = calculate_sma(prices, 50)
        sma_200 = calculate_sma(prices, 200)
        rsi = calculate_rsi(prices)
        current_price = round(float(prices[0]), 2)
        
        result = TechnicalIndicators(
            symbol=symbol,
            sma_50=sma_50,
            sma_200=sma_200,
            rsi=rsi,
            current_price=current_price
        )
        set_cache(cache_key, result, ttl=5)
        return result
    except Exception as e:
        print(f"Error: {str(e)}")
        return TechnicalIndicators(symbol=symbol)

def get_sentiment_score(symbol: str) -> Optional[str]:
    """Get sentiment based on RSI"""
    try:
        indicators = get_technical_indicators(symbol)
        if not indicators or not indicators.rsi:
            return "NEUTRAL"
        
        rsi = indicators.rsi
        if rsi < 30:
            return "OVERSOLD (Strong Buy)"
        elif rsi > 70:
            return "OVERBOUGHT (Strong Sell)"
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
        "data_source": "yfinance (Real-time)",
        "status": "✅ Working"
    }

@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "service": "Financial Research AI Agent",
        "version": "0.2.0",
        "week": "2",
        "data_source": "yfinance",
        "cache_items": len(cache),
        "features": ["Real Stock Data", "Technical Indicators", "Sentiment Analysis", "Portfolio Tracking"]
    }

@app.get("/api/v1/stocks/quote/{symbol}", response_model=StockQuote)
async def get_stock_quote_endpoint(symbol: str):
    """Get real stock quote from yfinance"""
    quote = fetch_stock_quote(symbol)
    if not quote:
        raise HTTPException(status_code=404, detail=f"Could not fetch quote for {symbol}")
    return StockQuote(**quote)

@app.get("/api/v1/stocks/historical/{symbol}")
async def get_historical_data(
    symbol: str,
    days: int = Query(30, ge=1, le=365)
):
    """Get historical stock data"""
    try:
        ticker = yf.Ticker(symbol)
        data = ticker.history(period=f"{days}d")
        
        if len(data) == 0:
            raise HTTPException(status_code=404, detail=f"No data for {symbol}")
        
        result = []
        for date, row in data.iterrows():
            result.append({
                "date": date.strftime("%Y-%m-%d"),
                "open": round(float(row['Open']), 2),
                "high": round(float(row['High']), 2),
                "low": round(float(row['Low']), 2),
                "close": round(float(row['Close']), 2),
                "volume": int(row['Volume'])
            })
        
        return {
            "symbol": symbol,
            "days": len(result),
            "data": result
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/v1/stocks/technical/{symbol}")
async def get_technical_indicators_endpoint(symbol: str):
    """Get technical indicators (SMA, RSI)"""
    indicators = get_technical_indicators(symbol)
    if not indicators:
        raise HTTPException(status_code=404, detail=f"Could not calculate indicators for {symbol}")
    return indicators

@app.get("/api/v1/stocks/analyze/{symbol}", response_model=StockAnalysis)
async def analyze_stock(symbol: str):
    """Complete stock analysis with recommendation"""
    try:
        quote = fetch_stock_quote(symbol)
        if not quote:
            raise HTTPException(status_code=404, detail=f"Could not fetch data for {symbol}")
        
        indicators = get_technical_indicators(symbol)
        sentiment = get_sentiment_score(symbol)
        
        # Generate recommendation based on RSI
        recommendation = "HOLD"
        if indicators and indicators.rsi:
            if indicators.rsi < 30:
                recommendation = "STRONG BUY ⬆️"
            elif indicators.rsi < 40:
                recommendation = "BUY"
            elif indicators.rsi > 70:
                recommendation = "STRONG SELL ⬇️"
            elif indicators.rsi > 60:
                recommendation = "SELL"
            elif 40 <= indicators.rsi <= 60:
                recommendation = "HOLD"
        
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
        raise HTTPException(status_code=400, detail="Provide at least 2 symbols to compare")
    
    comparisons = []
    for symbol in symbols:
        try:
            quote = fetch_stock_quote(symbol)
            if quote:
                comparisons.append({
                    "symbol": symbol,
                    "price": quote["price"],
                    "change": quote["change"],
                    "change_percent": quote["change_percent"],
                    "performance": "⬆️ UP" if quote["change"] > 0 else "⬇️ DOWN" if quote["change"] < 0 else "➡️ NEUTRAL"
                })
        except:
            pass
    
    if not comparisons:
        raise HTTPException(status_code=404, detail="Could not fetch data for any symbols")
    
    comparisons = sorted(comparisons, key=lambda x: x["change_percent"], reverse=True)
    
    return {
        "symbols": symbols,
        "count": len(comparisons),
        "comparisons": comparisons,
        "best_performer": comparisons[0]["symbol"] if comparisons else None,
        "worst_performer": comparisons[-1]["symbol"] if comparisons else None
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
            "invested": round(invested, 2),
            "current_value": round(current_value, 2),
            "gain_loss": round(gain_loss, 2),
            "gain_loss_percent": round(gain_loss_percent, 2),
            "status": "📈 PROFIT" if gain_loss > 0 else "📉 LOSS" if gain_loss < 0 else "➡️ BREAK EVEN"
        })
    
    total_gain_loss = total_current_value - total_invested
    total_gain_loss_percent = (total_gain_loss / total_invested * 100) if total_invested > 0 else 0
    
    return {
        "stocks": portfolio_data,
        "total_invested": round(total_invested, 2),
        "total_current_value": round(total_current_value, 2),
        "total_gain_loss": round(total_gain_loss, 2),
        "total_gain_loss_percent": round(total_gain_loss_percent, 2),
        "performance": "📈 UP" if total_gain_loss > 0 else "📉 DOWN" if total_gain_loss < 0 else "➡️ NEUTRAL"
    }

@app.get("/api/v1/market-status")
async def market_status():
    """Get market status and top movers"""
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
        return {"market": "NSE", "status": "Data fetching...", "message": "Try again in few seconds"}
    
    data = sorted(data, key=lambda x: x["change_percent"], reverse=True)
    
    return {
        "market": "NSE",
        "timestamp": datetime.now().isoformat(),
        "top_gainers": data[:3],
        "top_losers": data[-3:],
        "total_stocks": len(data)
    }

@app.get("/api/v1/stocks/screener")
async def stock_screener(
    min_rsi: float = Query(0, ge=0, le=100),
    max_rsi: float = Query(100, ge=0, le=100)
):
    """Screen stocks by RSI criteria"""
    symbols = ["RELIANCE.NS", "TCS.NS", "INFY.NS", "HDFC.NS", "ICICIBANK.NS", "MARUTI.NS", "WIPRO.NS"]
    
    results = []
    for symbol in symbols:
        try:
            indicators = get_technical_indicators(symbol)
            quote = fetch_stock_quote(symbol)
            
            if indicators and indicators.rsi and quote and min_rsi <= indicators.rsi <= max_rsi:
                results.append({
                    "symbol": symbol,
                    "price": quote["price"],
                    "rsi": indicators.rsi,
                    "sma_50": indicators.sma_50,
                    "sma_200": indicators.sma_200,
                    "signal": "BUY" if indicators.rsi < 40 else "SELL" if indicators.rsi > 60 else "HOLD"
                })
        except:
            pass
    
    return {
        "criteria": {"rsi_range": f"{min_rsi}-{max_rsi}"},
        "results": results,
        "count": len(results)
    }

@app.get("/api/v1/cache/status")
async def cache_status():
    """Check cache status"""
    return {
        "cached_items": len(cache),
        "cache_keys": list(cache.keys()),
        "status": "✅ Healthy"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
