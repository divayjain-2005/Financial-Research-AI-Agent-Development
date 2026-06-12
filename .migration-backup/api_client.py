import asyncio
import aiohttp
import logging
from typing import Dict, Optional, List, Any
from datetime import datetime, timedelta
from functools import wraps
import json
import time

logger = logging.getLogger(__name__)


class APIError(Exception):
    """Custom exception for API errors."""
    pass


class RateLimiter:
    """Rate limiter for API calls."""
    
    def __init__(self, max_requests: int, window_seconds: int):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self.requests = []
    
    async def wait_if_needed(self):
        """Wait if rate limit exceeded."""
        now = time.time()
        # Remove old requests outside the window
        self.requests = [req_time for req_time in self.requests 
                        if now - req_time < self.window_seconds]
        
        if len(self.requests) >= self.max_requests:
            wait_time = self.window_seconds - (now - self.requests[0])
            if wait_time > 0:
                logger.warning(f"Rate limit reached. Waiting {wait_time:.2f}s")
                await asyncio.sleep(wait_time)
                self.requests = []
        
        self.requests.append(now)


class AlphaVantageAPI:
    """Alpha Vantage API client for stock data."""
    
    BASE_URL = "https://www.alphavantage.co/query"
    
    def __init__(self, api_key: str, rate_limiter: Optional[RateLimiter] = None):
        self.api_key = api_key
        self.rate_limiter = rate_limiter or RateLimiter(max_requests=5, window_seconds=60)
    
    async def get_quote(self, symbol: str) -> Dict[str, Any]:
        """Get current stock quote."""
        try:
            await self.rate_limiter.wait_if_needed()
            
            params = {
                "function": "GLOBAL_QUOTE",
                "symbol": symbol,
                "apikey": self.api_key
            }
            
            async with aiohttp.ClientSession() as session:
                async with session.get(self.BASE_URL, params=params, timeout=aiohttp.ClientTimeout(total=10)) as response:
                    if response.status != 200:
                        raise APIError(f"API returned status {response.status}")
                    
                    data = await response.json()
                    
                    if "Error Message" in data:
                        raise APIError(f"API Error: {data['Error Message']}")
                    
                    if "Note" in data:
                        logger.warning("API rate limit reached")
                        return {}
                    
                    return data.get("Global Quote", {})
        
        except asyncio.TimeoutError:
            raise APIError("API request timeout")
        except Exception as e:
            logger.error(f"Error fetching quote for {symbol}: {str(e)}")
            raise APIError(f"Failed to fetch quote: {str(e)}")
    
    async def get_daily_prices(self, symbol: str, limit: int = 100) -> List[Dict[str, Any]]:
        """Get daily price data."""
        try:
            await self.rate_limiter.wait_if_needed()
            
            params = {
                "function": "TIME_SERIES_DAILY",
                "symbol": symbol,
                "apikey": self.api_key,
                "outputsize": "full" if limit > 100 else "compact"
            }
            
            async with aiohttp.ClientSession() as session:
                async with session.get(self.BASE_URL, params=params, timeout=aiohttp.ClientTimeout(total=10)) as response:
                    if response.status != 200:
                        raise APIError(f"API returned status {response.status}")
                    
                    data = await response.json()
                    
                    if "Error Message" in data:
                        raise APIError(f"API Error: {data['Error Message']}")
                    
                    if "Note" in data:
                        logger.warning("API rate limit reached")
                        return []
                    
                    time_series = data.get("Time Series (Daily)", {})
                    prices = []
                    
                    for date, values in sorted(time_series.items(), reverse=True)[:limit]:
                        prices.append({
                            "date": date,
                            "open": float(values["1. open"]),
                            "high": float(values["2. high"]),
                            "low": float(values["3. low"]),
                            "close": float(values["4. close"]),
                            "volume": int(values["5. volume"])
                        })
                    
                    return prices
        
        except asyncio.TimeoutError:
            raise APIError("API request timeout")
        except Exception as e:
            logger.error(f"Error fetching daily prices for {symbol}: {str(e)}")
            raise APIError(f"Failed to fetch prices: {str(e)}")
    
    async def get_intraday_prices(self, symbol: str, interval: str = "5min") -> List[Dict[str, Any]]:
        """Get intraday price data."""
        try:
            await self.rate_limiter.wait_if_needed()
            
            params = {
                "function": "TIME_SERIES_INTRADAY",
                "symbol": symbol,
                "interval": interval,
                "apikey": self.api_key
            }
            
            async with aiohttp.ClientSession() as session:
                async with session.get(self.BASE_URL, params=params, timeout=aiohttp.ClientTimeout(total=10)) as response:
                    if response.status != 200:
                        raise APIError(f"API returned status {response.status}")
                    
                    data = await response.json()
                    
                    if "Error Message" in data:
                        raise APIError(f"API Error: {data['Error Message']}")
                    
                    if "Note" in data:
                        logger.warning("API rate limit reached")
                        return []
                    
                    key = f"Time Series ({interval})"
                    time_series = data.get(key, {})
                    prices = []
                    
                    for timestamp, values in list(time_series.items())[:50]:
                        prices.append({
                            "timestamp": timestamp,
                            "open": float(values["1. open"]),
                            "high": float(values["2. high"]),
                            "low": float(values["3. low"]),
                            "close": float(values["4. close"]),
                            "volume": int(values["5. volume"])
                        })
                    
                    return prices
        
        except asyncio.TimeoutError:
            raise APIError("API request timeout")
        except Exception as e:
            logger.error(f"Error fetching intraday prices for {symbol}: {str(e)}")
            raise APIError(f"Failed to fetch intraday prices: {str(e)}")


class TechnicalAnalysisUtils:
    """Technical analysis calculations."""
    
    @staticmethod
    def calculate_sma(prices: List[float], period: int) -> Optional[float]:
        """Calculate Simple Moving Average."""
        if len(prices) < period:
            return None
        return sum(prices[-period:]) / period
    
    @staticmethod
    def calculate_ema(prices: List[float], period: int) -> Optional[float]:
        """Calculate Exponential Moving Average."""
        if len(prices) < period:
            return None
        
        multiplier = 2 / (period + 1)
        ema = sum(prices[:period]) / period
        
        for price in prices[period:]:
            ema = price * multiplier + ema * (1 - multiplier)
        
        return ema
    
    @staticmethod
    def calculate_rsi(prices: List[float], period: int = 14) -> Optional[float]:
        """Calculate Relative Strength Index."""
        if len(prices) < period + 1:
            return None
        
        deltas = [prices[i] - prices[i-1] for i in range(1, len(prices))]
        seed = deltas[:period]
        
        up = sum([d for d in seed if d > 0]) / period
        down = -sum([d for d in seed if d < 0]) / period
        
        rs = up / down if down != 0 else 0
        rsi = 100 - (100 / (1 + rs))
        
        for delta in deltas[period:]:
            up = (up * (period - 1) + (delta if delta > 0 else 0)) / period
            down = (down * (period - 1) + (-delta if delta < 0 else 0)) / period
            
            rs = up / down if down != 0 else 0
            rsi = 100 - (100 / (1 + rs))
        
        return rsi
    
    @staticmethod
    def calculate_macd(prices: List[float]) -> Optional[Dict[str, float]]:
        """Calculate MACD (Moving Average Convergence Divergence)."""
        if len(prices) < 26:
            return None
        
        ema_12 = TechnicalAnalysisUtils.calculate_ema(prices, 12)
        ema_26 = TechnicalAnalysisUtils.calculate_ema(prices, 26)
        
        if ema_12 is None or ema_26 is None:
            return None
        
        macd = ema_12 - ema_26
        return {
            "macd": macd,
            "ema_12": ema_12,
            "ema_26": ema_26
        }


class SentimentAnalysis:
    """Sentiment analysis utilities."""
    
    @staticmethod
    def analyze_text(text: str) -> Dict[str, Any]:
        """Analyze sentiment of text using TextBlob."""
        try:
            from textblob import TextBlob
            
            blob = TextBlob(text)
            polarity = blob.sentiment.polarity
            
            if polarity > 0.1:
                sentiment = "POSITIVE"
            elif polarity < -0.1:
                sentiment = "NEGATIVE"
            else:
                sentiment = "NEUTRAL"
            
            return {
                "sentiment": sentiment,
                "score": polarity,
                "subjectivity": blob.sentiment.subjectivity
            }
        except Exception as e:
            logger.error(f"Sentiment analysis error: {str(e)}")
            return {
                "sentiment": "NEUTRAL",
                "score": 0,
                "subjectivity": 0
            }


class MarketHours:
    """Check if market is open."""
    
    # IST timezone (UTC+5:30)
    MARKET_OPEN = "09:15"
    MARKET_CLOSE = "15:30"
    TRADING_DAYS = [0, 1, 2, 3, 4]  # Monday to Friday
    
    @staticmethod
    def is_market_open(dt: Optional[datetime] = None) -> bool:
        """Check if Indian stock market is open."""
        if dt is None:
            dt = datetime.now()
        
        # Check if trading day
        if dt.weekday() not in MarketHours.TRADING_DAYS:
            return False
        
        # Check market hours
        market_open = datetime.strptime(MarketHours.MARKET_OPEN, "%H:%M").time()
        market_close = datetime.strptime(MarketHours.MARKET_CLOSE, "%H:%M").time()
        
        current_time = dt.time()
        return market_open <= current_time <= market_close


def retry_on_failure(max_retries: int = 3, backoff_factor: float = 1.0):
    """Decorator to retry failed async functions."""
    def decorator(func):
        @wraps(func)
        async def async_wrapper(*args, **kwargs):
            for attempt in range(max_retries):
                try:
                    return await func(*args, **kwargs)
                except Exception as e:
                    if attempt == max_retries - 1:
                        raise
                    
                    wait_time = backoff_factor ** attempt
                    logger.warning(f"Attempt {attempt + 1} failed. Retrying in {wait_time}s: {str(e)}")
                    await asyncio.sleep(wait_time)
        
        return async_wrapper
    return decorator
