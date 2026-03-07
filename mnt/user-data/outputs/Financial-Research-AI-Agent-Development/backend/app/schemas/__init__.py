from pydantic import BaseModel, EmailStr, Field
from datetime import datetime
from typing import List, Optional, Dict, Any


# Stock Schemas
class StockBase(BaseModel):
    symbol: str
    company_name: str
    sector: str
    market: str


class StockCreate(StockBase):
    pass


class StockResponse(StockBase):
    id: int
    last_updated: datetime
    
    class Config:
        from_attributes = True


# Market Data Schemas
class MarketDataBase(BaseModel):
    timestamp: datetime
    open_price: float
    high_price: float
    low_price: float
    close_price: float
    volume: int


class MarketDataCreate(MarketDataBase):
    stock_id: int


class MarketDataResponse(MarketDataBase):
    id: int
    stock_id: int
    sma_20: Optional[float] = None
    sma_50: Optional[float] = None
    rsi_14: Optional[float] = None
    
    class Config:
        from_attributes = True


# Stock Price Query
class StockPriceQuery(BaseModel):
    symbol: str = Field(..., example="RELIANCE.NS")
    interval: Optional[str] = Field("daily", example="intraday")


class StockPriceResponse(BaseModel):
    symbol: str
    current_price: float
    previous_close: float
    change: float
    change_percent: float
    timestamp: datetime
    
    # Technical indicators
    sma_20: Optional[float] = None
    sma_50: Optional[float] = None
    rsi_14: Optional[float] = None
    
    class Config:
        from_attributes = True


# User Schemas
class UserBase(BaseModel):
    email: EmailStr
    username: str
    full_name: str


class UserCreate(UserBase):
    password: str


class UserResponse(UserBase):
    id: int
    is_active: bool
    created_at: datetime
    
    class Config:
        from_attributes = True


# Portfolio Schemas
class PortfolioStockBase(BaseModel):
    stock_id: int
    quantity: float
    average_buy_price: float


class PortfolioStockResponse(PortfolioStockBase):
    id: int
    current_weight: Optional[float]
    
    class Config:
        from_attributes = True


class PortfolioBase(BaseModel):
    name: str
    description: Optional[str] = None
    risk_profile: str = Field(..., example="MEDIUM")
    target_return: Optional[float] = None


class PortfolioCreate(PortfolioBase):
    pass


class PortfolioResponse(PortfolioBase):
    id: int
    user_id: int
    stocks: List[PortfolioStockResponse]
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


# Transaction Schemas
class TransactionBase(BaseModel):
    transaction_type: str  # BUY, SELL
    stock_symbol: str
    quantity: float
    price_per_unit: float


class TransactionCreate(TransactionBase):
    portfolio_id: Optional[int] = None


class TransactionResponse(TransactionBase):
    id: int
    user_id: int
    total_amount: float
    transaction_date: datetime
    
    class Config:
        from_attributes = True


# Portfolio Performance Schemas
class PortfolioPerformanceResponse(BaseModel):
    date: datetime
    total_value: float
    invested_amount: float
    current_gain_loss: float
    return_percentage: float
    
    class Config:
        from_attributes = True


# Economic Indicator Schemas
class EconomicIndicatorResponse(BaseModel):
    indicator_name: str
    category: str
    value: float
    unit: str
    date: datetime
    source: str
    
    class Config:
        from_attributes = True


# News Article Schemas
class NewsArticleResponse(BaseModel):
    id: int
    title: str
    source: str
    url: str
    sentiment_score: Optional[float]
    sentiment_label: Optional[str]
    related_stocks: Optional[List[str]]
    published_date: datetime
    
    class Config:
        from_attributes = True


# Stock Analysis Schemas
class StockAnalysisRequest(BaseModel):
    symbol: str = Field(..., example="RELIANCE.NS")
    include_sentiment: bool = True
    include_technicals: bool = True
    include_fundamentals: bool = True


class TechnicalAnalysis(BaseModel):
    indicator: str
    value: float
    signal: str  # BUY, SELL, HOLD


class StockAnalysisResponse(BaseModel):
    symbol: str
    company_name: str
    current_price: float
    change_percent: float
    
    # Technical analysis
    technicals: Optional[List[TechnicalAnalysis]] = None
    
    # Sentiment
    sentiment_score: Optional[float] = None
    sentiment_label: Optional[str] = None
    
    # Fundamentals
    pe_ratio: Optional[float] = None
    dividend_yield: Optional[float] = None
    
    # Overall recommendation
    recommendation: str  # BUY, SELL, HOLD
    confidence_score: float
    
    analysis_timestamp: datetime


# SIP Calculator Schemas
class SIPCalculatorRequest(BaseModel):
    monthly_investment: float = Field(..., gt=0)
    annual_return_rate: float = Field(default=12, ge=0, le=100)
    time_period_years: int = Field(..., gt=0)


class SIPCalculatorResponse(BaseModel):
    monthly_investment: float
    total_invested: float
    total_value: float
    total_gain: float
    gain_percentage: float
    annual_return_rate: float
    time_period_years: int


# Tax Calculation Schemas
class TaxCalculationRequest(BaseModel):
    buy_date: datetime
    sell_date: datetime
    buy_price: float
    sell_price: float
    quantity: float


class TaxCalculationResponse(BaseModel):
    capital_gain: float
    tax_type: str  # LTCG, STCG
    tax_rate: float
    tax_amount: float
    net_gain: float


# Investment Goal Schemas
class InvestmentGoalBase(BaseModel):
    goal_name: str
    goal_type: str
    target_amount: float
    target_date: datetime
    priority: str


class InvestmentGoalCreate(InvestmentGoalBase):
    pass


class InvestmentGoalResponse(InvestmentGoalBase):
    id: int
    user_id: int
    current_amount: float
    created_at: datetime
    
    class Config:
        from_attributes = True


# Chat/Agent Schemas
class ChatMessage(BaseModel):
    role: str  # user, assistant
    content: str


class ChatRequest(BaseModel):
    message: str
    history: Optional[List[ChatMessage]] = []
    context: Optional[Dict[str, Any]] = None


class ChatResponse(BaseModel):
    response: str
    sources: Optional[List[str]] = None
    confidence: float
    timestamp: datetime


# Error Response
class ErrorResponse(BaseModel):
    error: str
    detail: str
    timestamp: datetime
