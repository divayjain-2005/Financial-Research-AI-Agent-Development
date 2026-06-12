from sqlalchemy import Column, Integer, String, Float, DateTime, Boolean, ForeignKey, Text, JSON
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from datetime import datetime

Base = declarative_base()


class Stock(Base):
    """Stock information and metadata cache."""
    __tablename__ = "stocks"
    
    id = Column(Integer, primary_key=True, index=True)
    symbol = Column(String(50), unique=True, index=True)
    company_name = Column(String(255))
    sector = Column(String(100))
    market = Column(String(10))  # NSE or BSE
    exchange = Column(String(20))
    last_updated = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    market_data = relationship("MarketData", back_populates="stock", cascade="all, delete-orphan")
    portfolio_stocks = relationship("PortfolioStock", back_populates="stock")
    technical_indicators = relationship("TechnicalIndicator", back_populates="stock", cascade="all, delete-orphan")


class MarketData(Base):
    """Historical and real-time market data for stocks."""
    __tablename__ = "market_data"
    
    id = Column(Integer, primary_key=True, index=True)
    stock_id = Column(Integer, ForeignKey("stocks.id"), index=True)
    timestamp = Column(DateTime, index=True)
    
    open_price = Column(Float)
    high_price = Column(Float)
    low_price = Column(Float)
    close_price = Column(Float)
    volume = Column(Integer)
    
    # Technical indicators (cached)
    sma_20 = Column(Float, nullable=True)
    sma_50 = Column(Float, nullable=True)
    ema_12 = Column(Float, nullable=True)
    rsi_14 = Column(Float, nullable=True)
    macd = Column(Float, nullable=True)
    
    # Relationships
    stock = relationship("Stock", back_populates="market_data")


class TechnicalIndicator(Base):
    """Technical indicators calculated for stocks."""
    __tablename__ = "technical_indicators"
    
    id = Column(Integer, primary_key=True, index=True)
    stock_id = Column(Integer, ForeignKey("stocks.id"), index=True)
    
    indicator_type = Column(String(50), index=True)  # SMA, EMA, RSI, MACD, etc.
    period = Column(Integer)  # 20, 50, 200, etc.
    value = Column(Float)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)
    
    # Relationships
    stock = relationship("Stock", back_populates="technical_indicators")


class User(Base):
    """User accounts."""
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True)
    username = Column(String(100), unique=True, index=True)
    full_name = Column(String(255))
    hashed_password = Column(String(255))
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    portfolios = relationship("Portfolio", back_populates="user", cascade="all, delete-orphan")
    transactions = relationship("Transaction", back_populates="user", cascade="all, delete-orphan")
    preferences = relationship("UserPreference", back_populates="user", uselist=False, cascade="all, delete-orphan")


class Portfolio(Base):
    """User investment portfolios."""
    __tablename__ = "portfolios"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    name = Column(String(255))
    description = Column(Text, nullable=True)
    risk_profile = Column(String(50))  # LOW, MEDIUM, HIGH
    target_return = Column(Float, nullable=True)
    is_public = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    user = relationship("User", back_populates="portfolios")
    stocks = relationship("PortfolioStock", back_populates="portfolio", cascade="all, delete-orphan")
    transactions = relationship("Transaction", back_populates="portfolio")
    performance = relationship("PortfolioPerformance", back_populates="portfolio", cascade="all, delete-orphan")


class PortfolioStock(Base):
    """Stocks in a portfolio."""
    __tablename__ = "portfolio_stocks"
    
    id = Column(Integer, primary_key=True, index=True)
    portfolio_id = Column(Integer, ForeignKey("portfolios.id"), index=True)
    stock_id = Column(Integer, ForeignKey("stocks.id"), index=True)
    
    quantity = Column(Float)
    average_buy_price = Column(Float)
    current_weight = Column(Float, nullable=True)  # Percentage
    added_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    portfolio = relationship("Portfolio", back_populates="stocks")
    stock = relationship("Stock", back_populates="portfolio_stocks")


class Transaction(Base):
    """Buy/sell transactions."""
    __tablename__ = "transactions"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    portfolio_id = Column(Integer, ForeignKey("portfolios.id"), index=True, nullable=True)
    
    transaction_type = Column(String(10))  # BUY, SELL
    stock_symbol = Column(String(50))
    quantity = Column(Float)
    price_per_unit = Column(Float)
    total_amount = Column(Float)
    
    transaction_date = Column(DateTime, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    user = relationship("User", back_populates="transactions")
    portfolio = relationship("Portfolio", back_populates="transactions")


class PortfolioPerformance(Base):
    """Portfolio performance metrics over time."""
    __tablename__ = "portfolio_performance"
    
    id = Column(Integer, primary_key=True, index=True)
    portfolio_id = Column(Integer, ForeignKey("portfolios.id"), index=True)
    
    date = Column(DateTime, index=True)
    total_value = Column(Float)
    invested_amount = Column(Float)
    current_gain_loss = Column(Float)
    return_percentage = Column(Float)
    
    # Relationships
    portfolio = relationship("Portfolio", back_populates="performance")


class EconomicIndicator(Base):
    """Economic indicators from RBI and other sources."""
    __tablename__ = "economic_indicators"
    
    id = Column(Integer, primary_key=True, index=True)
    indicator_name = Column(String(255), index=True)
    category = Column(String(100))  # Interest Rate, Inflation, GDP, etc.
    
    value = Column(Float)
    unit = Column(String(50))
    date = Column(DateTime, index=True)
    source = Column(String(100))
    
    created_at = Column(DateTime, default=datetime.utcnow)


class NewsArticle(Base):
    """Financial news articles for sentiment analysis."""
    __tablename__ = "news_articles"
    
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255))
    content = Column(Text)
    source = Column(String(100))
    url = Column(String(500), unique=True)
    
    sentiment_score = Column(Float, nullable=True)  # -1 to 1
    sentiment_label = Column(String(20), nullable=True)  # POSITIVE, NEGATIVE, NEUTRAL
    
    related_stocks = Column(JSON, nullable=True)  # List of relevant stock symbols
    published_date = Column(DateTime)
    fetched_at = Column(DateTime, default=datetime.utcnow)


class UserPreference(Base):
    """User preferences and settings."""
    __tablename__ = "user_preferences"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, index=True)
    
    preferred_currency = Column(String(10), default="INR")
    notification_enabled = Column(Boolean, default=True)
    alert_threshold = Column(Float, default=5.0)  # Percentage change
    
    preferred_stocks = Column(JSON, nullable=True)  # List of favorite stocks
    settings = Column(JSON, nullable=True)  # JSON for flexible settings
    
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    user = relationship("User", back_populates="preferences")


class InvestmentGoal(Base):
    """User investment goals."""
    __tablename__ = "investment_goals"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), index=True)
    
    goal_name = Column(String(255))
    goal_type = Column(String(50))  # RETIREMENT, EDUCATION, WEDDING, etc.
    target_amount = Column(Float)
    target_date = Column(DateTime)
    current_amount = Column(Float, default=0)
    priority = Column(String(20))  # HIGH, MEDIUM, LOW
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
