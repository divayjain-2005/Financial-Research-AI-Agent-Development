from pydantic_settings import BaseSettings
from typing import List
from functools import lru_cache


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""
    
    # Server Configuration
    environment: str = "development"
    debug: bool = True
    api_title: str = "Financial Research AI Agent"
    api_version: str = "0.1.0"
    api_description: str = "AI-powered financial research assistant for Indian markets"
    host: str = "0.0.0.0"
    port: int = 8000
    
    # CORS Configuration
    cors_origins: List[str] = [
        "http://localhost:3000",
        "http://localhost:3001",
        "http://localhost:8000",
    ]
    
    # Database Configuration
    database_url: str
    
    # Redis Configuration
    redis_url: str = "redis://localhost:6379/0"
    redis_max_connections: int = 50
    cache_ttl: int = 3600  # seconds
    
    # Claude API Configuration
    claude_api_key: str = ""
    claude_model: str = "claude-3-5-sonnet-20241022"
    
    # Financial APIs Configuration
    alpha_vantage_api_key: str = ""
    zerodha_api_key: str = ""
    zerodha_api_secret: str = ""
    
    # Market APIs
    nse_api_base: str = "https://www.nseindia.com"
    bse_api_base: str = "https://api.bseindia.com"
    rbi_api_base: str = "https://rbidocs.rbi.org.in/DHOSP"
    
    # News APIs
    newsapi_key: str = ""
    newsapi_base: str = "https://newsapi.org"
    
    # Monitoring
    langsmith_api_key: str = ""
    langsmith_endpoint: str = "https://api.smith.langchain.com"
    log_level: str = "INFO"
    
    # Security
    secret_key: str = "change-me-in-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 30
    
    # Email Configuration (Optional)
    smtp_server: str = ""
    smtp_port: int = 587
    smtp_username: str = ""
    smtp_password: str = ""
    email_from: str = ""
    
    # Feature Flags
    enable_sentiment_analysis: bool = True
    enable_portfolio_optimization: bool = True
    enable_real_time_alerts: bool = False
    enable_crypto_integration: bool = False
    
    # Rate Limiting
    rate_limit_requests: int = 100
    rate_limit_window: int = 3600
    
    # API Timeout
    api_timeout: int = 30
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = False


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()


# Constants
INDIAN_MARKET_HOURS = {
    "open": "09:15",
    "close": "15:30",
    "timezone": "IST"
}

TRADING_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]

STOCK_SYMBOLS = {
    "NSE": {
        "RELIANCE": "RELIANCE.NS",
        "TCS": "TCS.NS",
        "INFY": "INFY.NS",
        "WIPRO": "WIPRO.NS",
        "HDFC": "HDFC.NS",
    },
    "BSE": {
        "RELIANCE": "RELIANCE.BO",
        "TCS": "TCS.BO",
        "INFY": "INFY.BO",
    }
}

# Technical Indicators
TECHNICAL_INDICATORS = [
    "SMA",      # Simple Moving Average
    "EMA",      # Exponential Moving Average
    "RSI",      # Relative Strength Index
    "MACD",     # Moving Average Convergence Divergence
    "BOLLINGER" # Bollinger Bands
]

# Risk Levels
RISK_LEVELS = ["LOW", "MEDIUM", "HIGH"]

# Investment Types
INVESTMENT_TYPES = ["EQUITY", "DEBT", "HYBRID", "COMMODITY", "FOREX"]

# Indian Tax Categories
TAX_CATEGORIES = {
    "LTCG": "Long Term Capital Gains",  # > 1 year
    "STCG": "Short Term Capital Gains", # < 1 year
    "DIVIDEND": "Dividend Income",
    "INTEREST": "Interest Income"
}
