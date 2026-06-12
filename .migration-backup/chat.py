from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session
from typing import Optional, List
from datetime import datetime
import logging
import json

from app.db.database import get_db, get_redis
from app.schemas import ChatRequest, ChatResponse, ChatMessage
from app.core.config import get_settings

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/api/v1/chat",
    tags=["Chat"],
)

settings = get_settings()


# Placeholder for LangGraph workflow - will be implemented in next phase
class FinancialAssistantWorkflow:
    """Financial research assistant using LangGraph."""
    
    def __init__(self, api_key: str):
        self.api_key = api_key
        # Initialize Claude API when key is available
        if api_key:
            try:
                from anthropic import Anthropic
                self.client = Anthropic(api_key=api_key)
                self.initialized = True
            except Exception as e:
                logger.error(f"Failed to initialize Claude: {str(e)}")
                self.initialized = False
        else:
            self.initialized = False
    
    async def process_message(
        self,
        message: str,
        history: List[ChatMessage] = None,
        context: dict = None
    ) -> dict:
        """Process user message and generate response."""
        
        if not self.initialized:
            return {
                "response": "Financial assistant is not available. Claude API key not configured.",
                "sources": [],
                "confidence": 0.0
            }
        
        try:
            # Build conversation history
            messages = []
            if history:
                for msg in history:
                    messages.append({
                        "role": msg.role,
                        "content": msg.content
                    })
            
            # Add current message
            messages.append({
                "role": "user",
                "content": message
            })
            
            # System prompt for financial advisor
            system_prompt = """You are an expert financial research assistant specializing in Indian stock markets. 
            You provide detailed analysis of stocks, market trends, and investment insights. 
            Always include a disclaimer that you are providing analysis, not investment advice.
            
            Rules:
            - Provide data-driven analysis
            - Include relevant technical and fundamental analysis
            - Consider market sentiment
            - Always recommend consulting a financial advisor
            - Format responses clearly with headers and bullet points
            """
            
            # Call Claude API
            response = self.client.messages.create(
                model=settings.claude_model,
                max_tokens=1024,
                system=system_prompt,
                messages=messages
            )
            
            assistant_message = response.content[0].text
            
            return {
                "response": assistant_message,
                "sources": [],
                "confidence": 0.85
            }
        
        except Exception as e:
            logger.error(f"Error processing message: {str(e)}")
            return {
                "response": f"Error processing request: {str(e)}",
                "sources": [],
                "confidence": 0.0
            }


# Global workflow instance
financial_workflow = None


def get_financial_workflow() -> FinancialAssistantWorkflow:
    """Dependency to get financial workflow instance."""
    global financial_workflow
    
    if financial_workflow is None:
        financial_workflow = FinancialAssistantWorkflow(
            api_key=settings.claude_api_key
        )
    
    return financial_workflow


@router.post("/query", response_model=ChatResponse)
async def query_financial_assistant(
    request: ChatRequest,
    workflow: FinancialAssistantWorkflow = Depends(get_financial_workflow),
    redis_client=Depends(get_redis)
):
    """
    Query the financial research assistant.
    
    Accepts:
    - message: User's question or query
    - history: Previous conversation messages (optional)
    - context: Additional context like stock symbols (optional)
    """
    try:
        # Check cache for similar queries
        cache_key = f"chat:{hash(request.message)}"
        cached_response = redis_client.get(cache_key)
        
        if cached_response:
            logger.info("Cache hit for chat query")
            return json.loads(cached_response)
        
        # Process message
        result = await workflow.process_message(
            message=request.message,
            history=request.history,
            context=request.context
        )
        
        response = ChatResponse(
            response=result["response"],
            sources=result.get("sources", []),
            confidence=result.get("confidence", 0.0),
            timestamp=datetime.utcnow()
        )
        
        # Cache response
        redis_client.setex(
            cache_key,
            settings.cache_ttl,
            json.dumps(response.dict(), default=str)
        )
        
        return response
    
    except Exception as e:
        logger.error(f"Error in chat query: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Error processing query: {str(e)}"
        )


@router.post("/stock-analysis")
async def analyze_stock_chat(
    symbol: str = Body(..., embed=True),
    query: str = Body(..., embed=True),
    workflow: FinancialAssistantWorkflow = Depends(get_financial_workflow)
):
    """
    Analyze a specific stock using natural language.
    
    - **symbol**: Stock symbol (e.g., RELIANCE.NS)
    - **query**: Specific question about the stock
    """
    try:
        full_message = f"Analyze {symbol}: {query}"
        
        result = await workflow.process_message(message=full_message)
        
        return ChatResponse(
            response=result["response"],
            sources=result.get("sources", []),
            confidence=result.get("confidence", 0.0),
            timestamp=datetime.utcnow()
        )
    
    except Exception as e:
        logger.error(f"Error in stock analysis: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/portfolio-advice")
async def get_portfolio_advice(
    portfolio_symbols: List[str] = Body(...),
    query: str = Body(...),
    workflow: FinancialAssistantWorkflow = Depends(get_financial_workflow)
):
    """
    Get advice on a portfolio.
    
    - **portfolio_symbols**: List of stock symbols in portfolio
    - **query**: Question about the portfolio
    """
    try:
        symbols_str = ", ".join(portfolio_symbols)
        full_message = f"For portfolio: {symbols_str}. {query}"
        
        result = await workflow.process_message(message=full_message)
        
        return ChatResponse(
            response=result["response"],
            sources=result.get("sources", []),
            confidence=result.get("confidence", 0.0),
            timestamp=datetime.utcnow()
        )
    
    except Exception as e:
        logger.error(f"Error in portfolio advice: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/market-sentiment")
async def get_market_sentiment(
    sector: Optional[str] = Body(None),
    workflow: FinancialAssistantWorkflow = Depends(get_financial_workflow)
):
    """
    Get market sentiment analysis.
    
    - **sector**: Specific sector to analyze (optional)
    """
    try:
        message = f"What is the current market sentiment? " + (f"Focus on {sector} sector." if sector else "")
        
        result = await workflow.process_message(message=message)
        
        return ChatResponse(
            response=result["response"],
            sources=result.get("sources", []),
            confidence=result.get("confidence", 0.0),
            timestamp=datetime.utcnow()
        )
    
    except Exception as e:
        logger.error(f"Error in sentiment analysis: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/economic-update")
async def get_economic_update(
    indicator: Optional[str] = Body(None),
    workflow: FinancialAssistantWorkflow = Depends(get_financial_workflow)
):
    """
    Get latest economic indicators and analysis.
    
    - **indicator**: Specific indicator (interest rate, inflation, GDP, etc.)
    """
    try:
        message = f"Provide economic update. " + (f"Focus on {indicator}." if indicator else "")
        
        result = await workflow.process_message(message=message)
        
        return ChatResponse(
            response=result["response"],
            sources=result.get("sources", []),
            confidence=result.get("confidence", 0.0),
            timestamp=datetime.utcnow()
        )
    
    except Exception as e:
        logger.error(f"Error in economic update: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/investment-strategy")
async def get_investment_strategy(
    risk_profile: str = Body(...),
    investment_amount: float = Body(...),
    time_horizon_months: int = Body(...),
    workflow: FinancialAssistantWorkflow = Depends(get_financial_workflow)
):
    """
    Get personalized investment strategy.
    
    - **risk_profile**: LOW, MEDIUM, or HIGH
    - **investment_amount**: Amount to invest
    - **time_horizon_months**: Investment time horizon in months
    """
    try:
        message = f"""Suggest an investment strategy with these parameters:
        Risk Profile: {risk_profile}
        Investment Amount: ₹{investment_amount}
        Time Horizon: {time_horizon_months} months
        Include specific stock recommendations and allocation percentages."""
        
        result = await workflow.process_message(message=message)
        
        return ChatResponse(
            response=result["response"],
            sources=result.get("sources", []),
            confidence=result.get("confidence", 0.0),
            timestamp=datetime.utcnow()
        )
    
    except Exception as e:
        logger.error(f"Error in investment strategy: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
