import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os
import requests
from datetime import datetime
from typing import List, Optional, Dict
import json

app = FastAPI(
    title="Financial Research AI Agent",
    version="0.2.0",
    description="AI-powered financial research assistant with real stock data"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Environment Variables
ALPHA_VANTAGE_KEY = os.getenv("ALPHA_VANTAGE_API_KEY", "demo")
CLAUDE_API_KEY = os.getenv("CLAUDE_API_KEY", "")

# Constants
ALPHA_VANTAGE_BASE_URL = "https://www.alphavantage.co/query"

# ==================== Data Models ====================

class StockQuote(BaseModel):
    symbol: str
    price: float
    change: float
    change_percent: float
    timestamp: str
    high_52week: Optional[float] = None
    low_52week: Optional[float] = None

class TechnicalIndicators(BaseModel):
    symbol: str
    sma_50: Optional[float] = None
    sma_200: Optional[float] = None
    rsi: Optional[float] = None
    macd: Optional[float] = None
    signal: Optional[float] = None

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

class Portfolio(BaseModel):
    stocks: List[PortfolioStock]
    total_value: float
    total_invested: float
    total_gain_loss: float
    gain_loss_percent: float

# ==================== Alpha Vantage API Integration ====================

def fetch_stock_quote(symbol: str) -> Optional[Dict]:
    """Fetch real stock quote from Alpha Vantage"""
    try:
        params = {
            "function": "GLOBAL_QUOTE",
            "symbol": symbol,
            "apikey": ALPHA_VANTAGE_KEY
        }
        response = requests.get(ALPHA_VANTAGE_BASE_URL, params=params, timeout=10)
        data = response.json()
        
        if "Global Quote" in data and data["Global Quote"]:
            quote = data["Global Quote"]
            return {
                "symbol": symbol,
                "price": float(quote.get("05. price", 0)),
                "change": float(quote.get("09. change", 0)),
                "change_percent": float(quote.get("10. change percent", "0").replace("%", "")),
                "high_52week": float(quote.get("52 Week High", 0)),
                "low_52week": float(quote.get("52 Week Low", 0)),
                "timestamp": datetime.now().isoformat()
            }
    except Exception as e:
        print(f"Error fetching quote for {symbol}: {str(e)}")
    
    return None

def fetch_historical_data(symbol: str, function: str = "TIME_SERIES_DAILY") -> Optional[Dict]:
    """Fetch historical data for technical indicators"""
    try:
        params = {
            "function": function,
            "symbol": symbol,
            "apikey": ALPHA_VANTAGE_KEY
        }
        response = requests.get(ALPHA_VANTAGE_BASE_URL, params=params, timeout=10)
        data = response.json()
        return data
    except Exception as e:
        print(f"Error fetching historical data for {symbol}: {str(e)}")
    
    return None

def calculate_sma(prices: List[float], period: int) -> Optional[float]:
    """Calculate Simple Moving Average"""
    if len(prices) < period:
        return None
    return sum(prices[:period]) / period

def calculate_rsi(prices: List[float], period: int = 14) -> Optional[float]:
    """Calculate Relative Strength Index"""
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
    """Get technical indicators for a stock"""
    try:
        data = fetch_historical_data(symbol, "TIME_SERIES_DAILY")
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
        print(f"Error calculating indicators for {symbol}: {str(e)}")
    
    return None

# ==================== Sentiment Analysis ====================

def get_sentiment_score(symbol: str) -> Optional[str]:
    """Simple sentiment based on technical indicators"""
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
        "message": "Financial Research AI Agent API",
        "version": "0.2.0",
        "week": "Week 2 - Real Data & Technical Analysis"
    }

@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "service": "Financial Research AI Agent",
        "environment": "production",
        "week": "2",
        "features": ["Real Stock Data", "Technical Indicators", "Sentiment Analysis", "Portfolio Tracking"]
    }

@app.get("/api/v1/stocks/quote/{symbol}", response_model=StockQuote)
async def get_stock_quote_endpoint(symbol: str):
    """Get real stock quote"""
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
    data = fetch_historical_data(symbol)
    if not data or "Time Series (Daily)" not in data:
        raise HTTPException(status_code=404, detail=f"Could not fetch historical data for {symbol}")
    
    time_series = data["Time Series (Daily)"]
    dates = sorted(time_series.keys())[-days:]
    
    return {
        "symbol": symbol,
        "days": days,
        "data": [
            {
                "date": date,
                "open": float(time_series[date]["1. open"]),
                "high": float(time_series[date]["2. high"]),
                "low": float(time_series[date]["3. low"]),
                "close": float(time_series[date]["4. close"]),
                "volume": int(time_series[date]["5. volume"])
            }
            for date in dates
        ]
    }

@app.get("/api/v1/stocks/technical/{symbol}")
async def get_technical_indicators_endpoint(symbol: str):
    """Get technical indicators"""
    indicators = get_technical_indicators(symbol)
    if not indicators:
        raise HTTPException(status_code=404, detail=f"Could not calculate indicators for {symbol}")
    return indicators

@app.get("/api/v1/stocks/analyze/{symbol}", response_model=StockAnalysis)
async def analyze_stock(symbol: str):
    """Complete stock analysis with quote, indicators, and sentiment"""
    try:
        quote = fetch_stock_quote(symbol)
        if not quote:
            raise HTTPException(status_code=404, detail=f"Could not fetch data for {symbol}")
        
        indicators = get_technical_indicators(symbol)
        sentiment = get_sentiment_score(symbol)
        
        # Generate recommendation
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
        raise HTTPException(status_code=400, detail="Provide at least 2 symbols to compare")
    
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
        raise HTTPException(status_code=404, detail="Could not fetch data for any symbols")
    
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

@app.get("/api/v1/stocks/screener")
async def stock_screener(
    min_rsi: float = Query(0, ge=0, le=100),
    max_rsi: float = Query(100, ge=0, le=100),
    min_price: float = Query(0, ge=0),
    max_price: float = Query(100000, ge=0)
):
    """Screen stocks by technical criteria"""
    # Example stocks to screen
    example_stocks = ["RELIANCE.NS", "TCS.NS", "INFY.NS", "HDFC.NS", "ICICIBANK.NS"]
    
    results = []
    for symbol in example_stocks:
        try:
            quote = fetch_stock_quote(symbol)
            indicators = get_technical_indicators(symbol)
            
            if quote and indicators and indicators.rsi:
                if (min_rsi <= indicators.rsi <= max_rsi and 
                    min_price <= quote["price"] <= max_price):
                    results.append({
                        "symbol": symbol,
                        "price": quote["price"],
                        "rsi": indicators.rsi,
                        "sma_50": indicators.sma_50,
                        "sma_200": indicators.sma_200
                    })
        except:
            pass
    
    return {
        "criteria": {
            "rsi_range": f"{min_rsi}-{max_rsi}",
            "price_range": f"{min_price}-{max_price}"
        },
        "results": results,
        "count": len(results)
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
    
    data = sorted(data, key=lambda x: x["change_percent"], reverse=True)
    
    return {
        "market": "NSE",
        "timestamp": datetime.now().isoformat(),
        "top_gainers": data[:3],
        "top_losers": data[-3:],
        "total_stocks": len(data)
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
