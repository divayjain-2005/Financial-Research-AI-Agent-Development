from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
import logging
import json

from app.db.database import get_db, get_redis
from app.schemas import StockPriceQuery, StockPriceResponse, StockAnalysisRequest, StockAnalysisResponse
from app.utils.api_client import (
    AlphaVantageAPI, 
    TechnicalAnalysisUtils, 
    SentimentAnalysis,
    APIError,
    MarketHours,
    retry_on_failure
)
from app.core.config import get_settings

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/v1/stocks",
    tags=["Stocks"],
)

settings = get_settings()


async def get_alpha_vantage() -> AlphaVantageAPI:
    """Dependency to get Alpha Vantage API client."""
    from main import alpha_vantage_api
    if not alpha_vantage_api:
        raise HTTPException(
            status_code=503,
            detail="Alpha Vantage API not configured"
        )
    return alpha_vantage_api


@router.get("/quote/{symbol}", response_model=StockPriceResponse)
@retry_on_failure(max_retries=3, backoff_factor=1.0)
async def get_stock_quote(
    symbol: str,
    api: AlphaVantageAPI = Depends(get_alpha_vantage),
    db: Session = Depends(get_db),
    redis_client=Depends(get_redis)
):
    """
    Get current stock quote.
    
    - **symbol**: Stock symbol (e.g., RELIANCE.NS)
    """
    try:
        # Check Redis cache first
        cache_key = f"quote:{symbol}"
        cached_data = redis_client.get(cache_key)
        
        if cached_data:
            logger.info(f"Cache hit for {symbol}")
            return json.loads(cached_data)
        
        # Fetch from API
        logger.info(f"Fetching quote for {symbol} from Alpha Vantage")
        quote_data = await api.get_quote(symbol)
        
        if not quote_data:
            raise HTTPException(
                status_code=404,
                detail=f"No data found for symbol {symbol}"
            )
        
        # Parse response
        price_data = {
            "symbol": symbol,
            "current_price": float(quote_data.get("05. price", 0)),
            "previous_close": float(quote_data.get("08. previous close", 0)),
            "change": float(quote_data.get("09. change", 0)),
            "change_percent": float(quote_data.get("10. change percent", "0").replace("%", "")),
            "timestamp": datetime.utcnow(),
            "sma_20": None,
            "sma_50": None,
            "rsi_14": None
        }
        
        # Cache the result
        redis_client.setex(
            cache_key,
            settings.cache_ttl,
            json.dumps(price_data, default=str)
        )
        
        return price_data
    
    except APIError as e:
        logger.error(f"API Error: {str(e)}")
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        logger.error(f"Error fetching quote: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/historical/{symbol}")
@retry_on_failure(max_retries=3)
async def get_historical_data(
    symbol: str,
    limit: int = Query(100, ge=1, le=1000),
    api: AlphaVantageAPI = Depends(get_alpha_vantage),
    redis_client=Depends(get_redis)
):
    """
    Get historical daily price data.
    
    - **symbol**: Stock symbol
    - **limit**: Number of records (1-1000)
    """
    try:
        # Check cache
        cache_key = f"historical:{symbol}:{limit}"
        cached_data = redis_client.get(cache_key)
        
        if cached_data:
            logger.info(f"Cache hit for historical data {symbol}")
            return json.loads(cached_data)
        
        # Fetch from API
        logger.info(f"Fetching historical data for {symbol}")
        prices = await api.get_daily_prices(symbol, limit)
        
        if not prices:
            raise HTTPException(
                status_code=404,
                detail=f"No historical data found for {symbol}"
            )
        
        result = {
            "symbol": symbol,
            "data": prices,
            "count": len(prices),
            "timestamp": datetime.utcnow()
        }
        
        # Cache result
        redis_client.setex(
            cache_key,
            settings.cache_ttl,
            json.dumps(result, default=str)
        )
        
        return result
    
    except APIError as e:
        logger.error(f"API Error: {str(e)}")
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        logger.error(f"Error fetching historical data: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/intraday/{symbol}")
@retry_on_failure(max_retries=3)
async def get_intraday_data(
    symbol: str,
    interval: str = Query("5min", regex="^(1min|5min|15min|30min|60min)$"),
    api: AlphaVantageAPI = Depends(get_alpha_vantage),
    redis_client=Depends(get_redis)
):
    """
    Get intraday price data.
    
    - **symbol**: Stock symbol
    - **interval**: Time interval (1min, 5min, 15min, 30min, 60min)
    """
    try:
        # Check cache (shorter TTL for intraday)
        cache_key = f"intraday:{symbol}:{interval}"
        cached_data = redis_client.get(cache_key)
        
        if cached_data:
            return json.loads(cached_data)
        
        # Fetch from API
        prices = await api.get_intraday_prices(symbol, interval)
        
        if not prices:
            raise HTTPException(
                status_code=404,
                detail=f"No intraday data found for {symbol}"
            )
        
        result = {
            "symbol": symbol,
            "interval": interval,
            "data": prices,
            "count": len(prices),
            "timestamp": datetime.utcnow()
        }
        
        # Cache with shorter TTL for intraday (5 minutes)
        redis_client.setex(
            cache_key,
            300,
            json.dumps(result, default=str)
        )
        
        return result
    
    except APIError as e:
        logger.error(f"API Error: {str(e)}")
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        logger.error(f"Error fetching intraday data: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/analyze", response_model=StockAnalysisResponse)
async def analyze_stock(
    request: StockAnalysisRequest,
    api: AlphaVantageAPI = Depends(get_alpha_vantage),
    db: Session = Depends(get_db),
    redis_client=Depends(get_redis)
):
    """
    Comprehensive stock analysis including technicals and sentiment.
    """
    try:
        symbol = request.symbol
        
        # Get current quote
        quote_data = await api.get_quote(symbol)
        if not quote_data:
            raise HTTPException(status_code=404, detail=f"Stock {symbol} not found")
        
        current_price = float(quote_data.get("05. price", 0))
        change_percent = float(quote_data.get("10. change percent", "0").replace("%", ""))
        
        # Get historical data for technical analysis
        prices = await api.get_daily_prices(symbol, 100)
        close_prices = [float(p["close"]) for p in prices][::-1]  # Reverse to get chronological order
        
        # Calculate technical indicators
        technicals = []
        
        # SMA 20
        sma_20 = TechnicalAnalysisUtils.calculate_sma(close_prices, 20)
        if sma_20:
            signal = "BUY" if current_price < sma_20 else "SELL" if current_price > sma_20 else "HOLD"
            technicals.append({
                "indicator": "SMA_20",
                "value": round(sma_20, 2),
                "signal": signal
            })
        
        # SMA 50
        sma_50 = TechnicalAnalysisUtils.calculate_sma(close_prices, 50)
        if sma_50:
            signal = "BUY" if current_price < sma_50 else "SELL" if current_price > sma_50 else "HOLD"
            technicals.append({
                "indicator": "SMA_50",
                "value": round(sma_50, 2),
                "signal": signal
            })
        
        # RSI 14
        rsi = TechnicalAnalysisUtils.calculate_rsi(close_prices, 14)
        if rsi:
            signal = "BUY" if rsi < 30 else "SELL" if rsi > 70 else "HOLD"
            technicals.append({
                "indicator": "RSI_14",
                "value": round(rsi, 2),
                "signal": signal
            })
        
        # MACD
        macd_data = TechnicalAnalysisUtils.calculate_macd(close_prices)
        if macd_data:
            technicals.append({
                "indicator": "MACD",
                "value": round(macd_data["macd"], 2),
                "signal": "BUY" if macd_data["macd"] > 0 else "SELL"
            })
        
        # Sentiment analysis (if enabled and text provided)
        sentiment_score = None
        sentiment_label = None
        
        if request.include_sentiment:
            # For demo, using placeholder sentiment
            sentiment_score = 0.5  # Neutral by default
            sentiment_label = "NEUTRAL"
        
        # Overall recommendation
        buy_signals = sum(1 for t in technicals if t["signal"] == "BUY")
        sell_signals = sum(1 for t in technicals if t["signal"] == "SELL")
        
        if buy_signals > sell_signals:
            recommendation = "BUY"
        elif sell_signals > buy_signals:
            recommendation = "SELL"
        else:
            recommendation = "HOLD"
        
        confidence_score = min(abs(buy_signals - sell_signals) / max(len(technicals), 1), 1.0)
        
        # Get company name (placeholder)
        company_name = symbol.split(".")[0]
        
        return {
            "symbol": symbol,
            "company_name": company_name,
            "current_price": current_price,
            "change_percent": change_percent,
            "technicals": technicals if request.include_technicals else None,
            "sentiment_score": sentiment_score,
            "sentiment_label": sentiment_label,
            "pe_ratio": None,  # TODO: Fetch from API
            "dividend_yield": None,  # TODO: Fetch from API
            "recommendation": recommendation,
            "confidence_score": round(confidence_score, 2),
            "analysis_timestamp": datetime.utcnow()
        }
    
    except APIError as e:
        logger.error(f"API Error during analysis: {str(e)}")
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        logger.error(f"Error analyzing stock: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/compare")
async def compare_stocks(
    symbols: str = Query(..., example="RELIANCE.NS,TCS.NS"),
    api: AlphaVantageAPI = Depends(get_alpha_vantage),
    redis_client=Depends(get_redis)
):
    """
    Compare multiple stocks.
    
    - **symbols**: Comma-separated stock symbols
    """
    try:
        symbol_list = [s.strip() for s in symbols.split(",")]
        
        results = []
        for symbol in symbol_list:
            quote_data = await api.get_quote(symbol)
            if quote_data:
                results.append({
                    "symbol": symbol,
                    "price": float(quote_data.get("05. price", 0)),
                    "change": float(quote_data.get("09. change", 0)),
                    "change_percent": float(quote_data.get("10. change percent", "0").replace("%", ""))
                })
        
        return {
            "symbols": symbol_list,
            "data": results,
            "timestamp": datetime.utcnow()
        }
    
    except Exception as e:
        logger.error(f"Error comparing stocks: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/market-status")
async def market_status():
    """Check if market is currently open."""
    is_open = MarketHours.is_market_open()
    
    return {
        "market_open": is_open,
        "market_hours": f"{MarketHours.MARKET_OPEN} - {MarketHours.MARKET_CLOSE} IST",
        "trading_days": "Monday - Friday",
        "timestamp": datetime.utcnow()
    }
