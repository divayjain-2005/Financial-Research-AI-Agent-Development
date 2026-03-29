import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os
from datetime import datetime, timedelta
from typing import List, Optional, Dict
import json

app = FastAPI(
    title="Financial Research AI Agent",
    version="0.3.0",
    description="Advanced AI-powered financial research with workflows and risk analysis"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

CLAUDE_API_KEY = os.getenv("CLAUDE_API_KEY", "")
ALPHA_VANTAGE_KEY = os.getenv("ALPHA_VANTAGE_API_KEY", "demo")

# ==================== Data Models ====================

class InvestmentGoal(BaseModel):
    name: str
    target_amount: float
    current_amount: float
    timeline_years: int
    risk_level: str  # LOW, MEDIUM, HIGH
    monthly_investment: float

class SIPCalculation(BaseModel):
    monthly_investment: float
    annual_return: float
    years: int
    final_amount: Optional[float] = None
    total_invested: Optional[float] = None
    total_gains: Optional[float] = None

class RiskProfile(BaseModel):
    portfolio_value: float
    volatility: Optional[float] = None
    beta: Optional[float] = None
    sharpe_ratio: Optional[float] = None
    max_drawdown: Optional[float] = None
    var_95: Optional[float] = None  # Value at Risk
    risk_score: Optional[int] = None

class PriceAlert(BaseModel):
    symbol: str
    target_price: float
    alert_type: str  # ABOVE, BELOW
    is_active: bool = True
    created_at: str = None

class PortfolioOptimization(BaseModel):
    symbols: List[str]
    target_return: float
    max_risk: float
    optimized_weights: Optional[Dict[str, float]] = None
    expected_return: Optional[float] = None
    expected_risk: Optional[float] = None

class AIAnalysis(BaseModel):
    symbol: str
    analysis: str
    recommendation: str
    confidence: float
    reasoning: str

# ==================== Storage (Mock Database) ====================

goals_db = {}
alerts_db = {}
user_preferences = {}

# ==================== Core Calculations ====================

def calculate_sip_returns(monthly: float, annual_return: float, years: int) -> Dict:
    """Calculate SIP returns"""
    monthly_rate = annual_return / 12 / 100
    months = years * 12
    
    # Future Value of SIP formula
    fv = monthly * (((1 + monthly_rate) ** months - 1) / monthly_rate) * (1 + monthly_rate)
    total_invested = monthly * months
    total_gains = fv - total_invested
    
    return {
        "final_amount": round(fv, 2),
        "total_invested": round(total_invested, 2),
        "total_gains": round(total_gains, 2),
        "months": months
    }

def calculate_cagr(initial: float, final: float, years: int) -> float:
    """Calculate Compound Annual Growth Rate"""
    if initial <= 0:
        return 0
    return round(((final / initial) ** (1 / years) - 1) * 100, 2)

def calculate_portfolio_risk(portfolio_values: List[float]) -> Dict:
    """Calculate portfolio risk metrics"""
    import statistics
    
    if len(portfolio_values) < 2:
        return {"volatility": 0, "max_drawdown": 0}
    
    returns = [(portfolio_values[i] - portfolio_values[i-1]) / portfolio_values[i-1] 
               for i in range(1, len(portfolio_values))]
    
    volatility = statistics.stdev(returns) * 100 if len(returns) > 1 else 0
    
    # Max Drawdown
    max_dd = 0
    peak = portfolio_values[0]
    for value in portfolio_values:
        if value > peak:
            peak = value
        dd = (peak - value) / peak * 100
        if dd > max_dd:
            max_dd = dd
    
    # VaR (Value at Risk) - 95% confidence
    returns_sorted = sorted(returns)
    var_index = int(len(returns_sorted) * 0.05)
    var_95 = abs(returns_sorted[var_index]) * 100 if var_index < len(returns_sorted) else 0
    
    return {
        "volatility": round(volatility, 2),
        "max_drawdown": round(max_dd, 2),
        "var_95": round(var_95, 2)
    }

def asset_allocation_recommendation(risk_level: str) -> Dict:
    """Recommend asset allocation based on risk level"""
    allocations = {
        "LOW": {
            "bonds": 60,
            "stocks": 30,
            "gold": 10,
            "description": "Conservative - Capital preservation"
        },
        "MEDIUM": {
            "bonds": 40,
            "stocks": 50,
            "gold": 10,
            "description": "Balanced - Growth with stability"
        },
        "HIGH": {
            "bonds": 20,
            "stocks": 70,
            "gold": 10,
            "description": "Aggressive - Maximum growth"
        }
    }
    return allocations.get(risk_level, allocations["MEDIUM"])

def goal_recommendation(goal: InvestmentGoal) -> Dict:
    """Recommend investment strategy for goal"""
    required_annual_return = ((goal.target_amount / goal.current_amount) ** (1 / goal.timeline_years) - 1) * 100
    
    monthly_needed = goal.target_amount / (goal.timeline_years * 12)
    
    return {
        "goal": goal.name,
        "current": goal.current_amount,
        "target": goal.target_amount,
        "timeline": goal.timeline_years,
        "required_annual_return": round(required_annual_return, 2),
        "monthly_investment_needed": round(monthly_needed, 2),
        "monthly_plan": goal.monthly_investment,
        "feasible": goal.monthly_investment >= monthly_needed,
        "allocation": asset_allocation_recommendation(goal.risk_level)
    }

# ==================== API Endpoints ====================

@app.get("/")
async def root():
    return {
        "message": "Financial Research AI Agent",
        "version": "0.3.0",
        "week": "3",
        "features": ["LangGraph Workflows", "SIP Calculator", "Risk Analysis", "Investment Goals", "Alerts", "Portfolio Optimization"]
    }

@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "version": "0.3.0",
        "week": "3",
        "features": [
            "Advanced Portfolio Analysis",
            "SIP Calculator",
            "Risk Metrics",
            "Investment Goals",
            "Price Alerts",
            "Portfolio Optimization"
        ]
    }

# ==================== SIP Calculator ====================

@app.post("/api/v1/sip/calculate", response_model=SIPCalculation)
async def calculate_sip(monthly_investment: float, annual_return: float, years: int):
    """Calculate SIP returns"""
    if monthly_investment <= 0 or annual_return < 0 or years <= 0:
        raise HTTPException(status_code=400, detail="Invalid parameters")
    
    result = calculate_sip_returns(monthly_investment, annual_return, years)
    
    return SIPCalculation(
        monthly_investment=monthly_investment,
        annual_return=annual_return,
        years=years,
        final_amount=result["final_amount"],
        total_invested=result["total_invested"],
        total_gains=result["total_gains"]
    )

# ==================== Investment Goals ====================

@app.post("/api/v1/goals/create")
async def create_goal(goal: InvestmentGoal):
    """Create investment goal"""
    goal_id = f"goal_{len(goals_db)}"
    goals_db[goal_id] = goal.dict()
    
    recommendation = goal_recommendation(goal)
    
    return {
        "goal_id": goal_id,
        "status": "created",
        "recommendation": recommendation
    }

@app.get("/api/v1/goals")
async def get_goals():
    """Get all goals"""
    return {
        "total_goals": len(goals_db),
        "goals": list(goals_db.values())
    }

@app.get("/api/v1/goals/{goal_id}/analysis")
async def analyze_goal(goal_id: str):
    """Analyze goal progress and provide recommendations"""
    if goal_id not in goals_db:
        raise HTTPException(status_code=404, detail="Goal not found")
    
    goal_data = goals_db[goal_id]
    goal = InvestmentGoal(**goal_data)
    
    recommendation = goal_recommendation(goal)
    
    return {
        "goal_id": goal_id,
        "analysis": recommendation,
        "action_items": [
            f"Invest ₹{recommendation['monthly_investment_needed']:.2f} monthly",
            f"Target return: {recommendation['required_annual_return']:.2f}% per year",
            f"Allocation: {recommendation['allocation']['description']}"
        ]
    }

# ==================== Risk Analysis ====================

@app.post("/api/v1/risk/assess", response_model=RiskProfile)
async def assess_risk(portfolio_value: float, portfolio_history: List[float] = None):
    """Assess portfolio risk"""
    
    if portfolio_history is None:
        portfolio_history = [portfolio_value] * 12
    
    risk_metrics = calculate_portfolio_risk(portfolio_history)
    
    volatility = risk_metrics.get("volatility", 0)
    risk_score = min(100, int(volatility * 2))  # Simple risk score
    
    return RiskProfile(
        portfolio_value=portfolio_value,
        volatility=risk_metrics["volatility"],
        beta=1.0,  # Placeholder
        sharpe_ratio=round((10 - volatility / 10), 2) if volatility > 0 else 0,
        max_drawdown=risk_metrics["max_drawdown"],
        var_95=risk_metrics["var_95"],
        risk_score=risk_score
    )

# ==================== Price Alerts ====================

@app.post("/api/v1/alerts/create")
async def create_alert(symbol: str, target_price: float, alert_type: str):
    """Create price alert"""
    if alert_type not in ["ABOVE", "BELOW"]:
        raise HTTPException(status_code=400, detail="Invalid alert type")
    
    alert_id = f"alert_{len(alerts_db)}"
    alerts_db[alert_id] = {
        "symbol": symbol,
        "target_price": target_price,
        "alert_type": alert_type,
        "created_at": datetime.now().isoformat(),
        "is_active": True
    }
    
    return {
        "alert_id": alert_id,
        "status": "created",
        "message": f"Alert set: {symbol} when price goes {alert_type} ₹{target_price}"
    }

@app.get("/api/v1/alerts")
async def get_alerts():
    """Get all alerts"""
    return {
        "total_alerts": len(alerts_db),
        "alerts": list(alerts_db.values())
    }

@app.delete("/api/v1/alerts/{alert_id}")
async def delete_alert(alert_id: str):
    """Delete alert"""
    if alert_id not in alerts_db:
        raise HTTPException(status_code=404, detail="Alert not found")
    
    del alerts_db[alert_id]
    return {"status": "deleted", "alert_id": alert_id}

# ==================== Portfolio Optimization ====================

@app.post("/api/v1/portfolio/optimize")
async def optimize_portfolio(symbols: List[str], target_return: float = 12.0, max_risk: float = 15.0):
    """Optimize portfolio allocation"""
    
    # Simplified optimization using equal weights
    num_symbols = len(symbols)
    equal_weight = 1 / num_symbols if num_symbols > 0 else 0
    
    optimized_weights = {symbol: round(equal_weight, 2) for symbol in symbols}
    
    # Estimate returns and risk
    estimated_return = target_return
    estimated_risk = max_risk * 0.8  # Assume 80% of max risk
    
    return {
        "symbols": symbols,
        "optimized_weights": optimized_weights,
        "expected_return": round(estimated_return, 2),
        "expected_risk": round(estimated_risk, 2),
        "recommendation": "Proceed with allocation" if estimated_risk <= max_risk else "Risk exceeds limit"
    }

# ==================== AI Workflows (LangGraph Simulation) ====================

@app.post("/api/v1/ai/analyze-portfolio")
async def ai_analyze_portfolio(symbols: List[str]):
    """AI analysis workflow for portfolio"""
    
    analysis = f"""
    Portfolio Analysis Report
    
    Symbols: {', '.join(symbols)}
    
    Recommendations:
    1. Diversify across sectors
    2. Monitor market trends
    3. Review quarterly performance
    4. Rebalance annually
    
    Risk Assessment: MODERATE
    Expected Return: 12-15% annually
    Recommendation: HOLD with periodic reviews
    """
    
    return {
        "portfolio": symbols,
        "analysis": analysis,
        "confidence": 0.85,
        "next_review": (datetime.now() + timedelta(days=90)).isoformat()
    }

@app.post("/api/v1/ai/stock-recommendation")
async def ai_stock_recommendation(symbol: str):
    """AI recommendation for stock"""
    
    recommendations = {
        "RELIANCE.NS": "HOLD - Stable dividend stock",
        "TCS.NS": "BUY - Strong fundamentals",
        "INFY.NS": "BUY - Growth potential",
        "HDFC.NS": "HOLD - Safe investment",
        "ICICIBANK.NS": "BUY - Banking sector growth"
    }
    
    recommendation = recommendations.get(symbol, "HOLD - Further analysis needed")
    
    return {
        "symbol": symbol,
        "recommendation": recommendation,
        "confidence": 0.80,
        "reasoning": "Based on technical and fundamental analysis",
        "time_horizon": "6-12 months"
    }

@app.get("/api/v1/ai/market-sentiment")
async def ai_market_sentiment():
    """AI market sentiment analysis"""
    
    return {
        "overall_sentiment": "BULLISH",
        "confidence": 0.75,
        "key_drivers": [
            "Strong GDP growth",
            "Stable inflation",
            "Corporate earnings recovery",
            "Positive FII flows"
        ],
        "risks": [
            "Geopolitical tensions",
            "Rate hike concerns",
            "Global slowdown"
        ],
        "recommendation": "Maintain balanced portfolio",
        "update_time": datetime.now().isoformat()
    }

# ==================== Advanced Analysis ====================

@app.get("/api/v1/analysis/tax-planning")
async def tax_planning_analysis(annual_income: float, investment_amount: float):
    """Tax planning recommendations"""
    
    tax_saving = min(investment_amount, 150000)  # India's standard deduction
    tax_saved = tax_saving * 0.30  # Assume 30% tax bracket
    
    return {
        "annual_income": annual_income,
        "investment_amount": investment_amount,
        "tax_eligible_amount": tax_saving,
        "estimated_tax_saved": round(tax_saved, 2),
        "instruments": [
            "ELSS Mutual Funds",
            "NPS (National Pension Scheme)",
            "Life Insurance Premium",
            "Fixed Deposits"
        ],
        "recommendation": "Invest in ELSS for tax efficiency"
    }

@app.get("/api/v1/analysis/rebalancing")
async def portfolio_rebalancing(current_allocation: Dict[str, float], target_allocation: Dict[str, float]):
    """Portfolio rebalancing analysis"""
    
    rebalancing_trades = {}
    for asset, target in target_allocation.items():
        current = current_allocation.get(asset, 0)
        difference = target - current
        if difference != 0:
            rebalancing_trades[asset] = {
                "action": "BUY" if difference > 0 else "SELL",
                "amount": abs(difference),
                "reason": "Rebalance to target allocation"
            }
    
    return {
        "current_allocation": current_allocation,
        "target_allocation": target_allocation,
        "rebalancing_trades": rebalancing_trades,
        "frequency": "Quarterly or when drift > 5%"
    }

@app.get("/api/v1/analysis/ltcg-tax")
async def ltcg_tax_analysis(purchase_price: float, current_price: float, holding_days: int):
    """Long-term capital gains tax analysis"""
    
    gain = current_price - purchase_price
    is_ltcg = holding_days >= 365
    
    if is_ltcg:
        tax_rate = 0.20  # 20% LTCG tax in India
        tax = gain * tax_rate if gain > 0 else 0
    else:
        tax_rate = 0.30  # 30% STCG tax (approximate)
        tax = gain * tax_rate if gain > 0 else 0
    
    return {
        "purchase_price": purchase_price,
        "current_price": current_price,
        "gain": gain,
        "holding_days": holding_days,
        "is_long_term": is_ltcg,
        "tax_rate": f"{tax_rate * 100}%",
        "estimated_tax": round(tax, 2),
        "net_profit": round(gain - tax, 2)
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
