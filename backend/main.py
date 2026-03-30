import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from datetime import datetime, timedelta
from typing import List, Optional, Dict
from enum import Enum

app = FastAPI(
    title="Financial Research AI Agent",
    version="0.4.0",
    description="Complete personal finance management with expense tracking, budgeting, and planning"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==================== Data Models ====================

class ExpenseCategory(str, Enum):
    FOOD = "Food"
    TRANSPORT = "Transport"
    UTILITIES = "Utilities"
    ENTERTAINMENT = "Entertainment"
    HEALTHCARE = "Healthcare"
    SHOPPING = "Shopping"
    EDUCATION = "Education"
    OTHER = "Other"

class Expense(BaseModel):
    amount: float
    category: ExpenseCategory
    description: str
    date: str
    payment_method: Optional[str] = "Cash"

class Budget(BaseModel):
    category: ExpenseCategory
    monthly_limit: float
    current_month_spent: Optional[float] = 0

class MutualFund(BaseModel):
    name: str
    category: str  # Equity, Debt, Hybrid
    nav: float
    one_year_return: float
    three_year_return: float
    five_year_return: float
    risk_rating: str  # Low, Medium, High

class SIPComparison(BaseModel):
    fund1_name: str
    fund1_return: float
    fund2_name: str
    fund2_return: float
    monthly_investment: float
    years: int

class InsurancePlan(BaseModel):
    age: int
    annual_income: float
    dependents: int
    existing_coverage: float

class RetirementPlan(BaseModel):
    current_age: int
    retirement_age: int
    current_savings: float
    monthly_savings: float
    expected_return: float
    annual_expense: float

class DebtDetails(BaseModel):
    debt_type: str  # Home Loan, Personal Loan, Credit Card, Auto Loan
    principal_amount: float
    interest_rate: float
    tenure_months: int
    monthly_emi: Optional[float] = None

class EmergencyFund(BaseModel):
    monthly_expenses: float
    months_covered: int = 6

# ==================== Mock Database ====================

expenses_db = {}
budgets_db = {}
user_profile = {}

# ==================== Calculations ====================

def calculate_emi(principal: float, rate: float, months: int) -> float:
    """Calculate EMI (Equated Monthly Installment)"""
    if rate == 0:
        return principal / months
    
    monthly_rate = rate / 12 / 100
    emi = principal * (monthly_rate * (1 + monthly_rate) ** months) / ((1 + monthly_rate) ** months - 1)
    return round(emi, 2)

def calculate_total_interest(principal: float, rate: float, months: int) -> float:
    """Calculate total interest paid"""
    emi = calculate_emi(principal, rate, months)
    total_paid = emi * months
    interest = total_paid - principal
    return round(interest, 2)

def calculate_retirement_corpus(current_age: int, retirement_age: int, current_savings: float,
                               monthly_savings: float, expected_return: float, annual_expense: float) -> Dict:
    """Calculate retirement corpus needed"""
    
    years_to_retirement = retirement_age - current_age
    years_in_retirement = 30  # Assume 30 years post-retirement
    
    # Future value of current savings
    fv_current = current_savings * ((1 + expected_return/100) ** years_to_retirement)
    
    # Future value of monthly savings
    monthly_rate = (expected_return / 100) / 12
    months = years_to_retirement * 12
    fv_monthly = monthly_savings * (((1 + monthly_rate) ** months - 1) / monthly_rate) * (1 + monthly_rate)
    
    # Total corpus at retirement
    corpus_at_retirement = fv_current + fv_monthly
    
    # Annual expense adjusted for inflation (assume 5% inflation)
    inflation = 0.05
    annual_expense_at_retirement = annual_expense * ((1 + inflation) ** years_to_retirement)
    
    # Corpus needed for retirement (assume 3% withdrawal rate)
    corpus_needed = annual_expense_at_retirement / 0.03
    
    # Shortfall or surplus
    shortfall = max(0, corpus_needed - corpus_at_retirement)
    
    return {
        "current_savings": round(current_savings, 2),
        "years_to_retirement": years_to_retirement,
        "fv_current_savings": round(fv_current, 2),
        "fv_monthly_savings": round(fv_monthly, 2),
        "corpus_at_retirement": round(corpus_at_retirement, 2),
        "annual_expense_at_retirement": round(annual_expense_at_retirement, 2),
        "corpus_needed": round(corpus_needed, 2),
        "shortfall": round(shortfall, 2),
        "status": "On Track" if shortfall == 0 else f"Shortfall: ₹{shortfall:,.0f}"
    }

def calculate_insurance_need(age: int, annual_income: float, dependents: int, existing_coverage: float) -> Dict:
    """Calculate life insurance need"""
    
    # Insurance need = Income replacement (10 years) + Children education + Spouse needs
    income_replacement = annual_income * 10
    education_cost = 5000000 if dependents > 0 else 0  # ₹50 lakh per child
    spouse_needs = 2000000  # ₹20 lakh
    
    total_need = income_replacement + education_cost + spouse_needs
    gap = max(0, total_need - existing_coverage)
    
    return {
        "age": age,
        "annual_income": annual_income,
        "dependents": dependents,
        "existing_coverage": existing_coverage,
        "income_replacement_need": round(income_replacement, 2),
        "education_fund_need": round(education_cost, 2),
        "spouse_security_need": round(spouse_needs, 2),
        "total_need": round(total_need, 2),
        "coverage_gap": round(gap, 2),
        "recommended_coverage": round(gap + existing_coverage, 2),
        "recommendation": "Term Insurance" if gap > 0 else "Adequate coverage"
    }

def calculate_emergency_fund(monthly_expenses: float, months: int = 6) -> Dict:
    """Calculate emergency fund needed"""
    
    emergency_fund = monthly_expenses * months
    
    return {
        "monthly_expenses": monthly_expenses,
        "months_covered": months,
        "emergency_fund_needed": round(emergency_fund, 2),
        "where_to_keep": [
            "Savings Account (3 months)",
            "Liquid Mutual Funds (2 months)",
            "Short-term FDs (1 month)"
        ]
    }

# ==================== API Endpoints ====================

@app.get("/")
async def root():
    return {
        "message": "Financial Research AI Agent",
        "version": "0.4.0",
        "week": "4",
        "features": ["Expense Tracking", "Budget Management", "Insurance Planning", "Retirement Planning", "Debt Management", "Emergency Fund"]
    }

@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "version": "0.4.0",
        "week": "4",
        "features": [
            "Expense Tracking",
            "Budget Management",
            "Monthly Reports",
            "Insurance Planning",
            "Retirement Planning",
            "Debt Management",
            "Emergency Fund"
        ]
    }

# ==================== Expense Tracking ====================

@app.post("/api/v1/expenses/add")
async def add_expense(expense: Expense):
    """Add an expense"""
    expense_id = f"exp_{len(expenses_db)}"
    expenses_db[expense_id] = expense.dict()
    
    return {
        "expense_id": expense_id,
        "status": "added",
        "amount": expense.amount,
        "category": expense.category,
        "date": expense.date
    }

@app.get("/api/v1/expenses")
async def get_expenses(month: Optional[int] = None, year: Optional[int] = None):
    """Get all expenses"""
    total = sum(e["amount"] for e in expenses_db.values())
    
    by_category = {}
    for expense in expenses_db.values():
        category = expense["category"]
        by_category[category] = by_category.get(category, 0) + expense["amount"]
    
    return {
        "total_expenses": len(expenses_db),
        "total_amount": round(total, 2),
        "by_category": {k: round(v, 2) for k, v in by_category.items()},
        "expenses": list(expenses_db.values())
    }

@app.get("/api/v1/expenses/monthly-summary")
async def monthly_summary(month: int, year: int):
    """Get monthly expense summary"""
    
    total = 500000  # Mock total
    food = 150000
    transport = 50000
    utilities = 30000
    entertainment = 80000
    shopping = 100000
    other = 90000
    
    return {
        "month": month,
        "year": year,
        "total_spent": total,
        "breakdown": {
            "Food": food,
            "Transport": transport,
            "Utilities": utilities,
            "Entertainment": entertainment,
            "Shopping": shopping,
            "Other": other
        },
        "average_daily": round(total / 30, 2),
        "trends": "Expenses up 5% vs last month"
    }

# ==================== Budget Management ====================

@app.post("/api/v1/budget/set")
async def set_budget(category: ExpenseCategory, monthly_limit: float):
    """Set budget for category"""
    budget_id = f"budget_{category}"
    budgets_db[budget_id] = {
        "category": category,
        "monthly_limit": monthly_limit,
        "current_month_spent": 0
    }
    
    return {
        "budget_id": budget_id,
        "category": category,
        "monthly_limit": monthly_limit,
        "status": "created"
    }

@app.get("/api/v1/budget/summary")
async def budget_summary():
    """Get budget summary"""
    
    budgets = [
        {"category": "Food", "limit": 100000, "spent": 85000, "remaining": 15000},
        {"category": "Transport", "limit": 20000, "spent": 18000, "remaining": 2000},
        {"category": "Entertainment", "limit": 50000, "spent": 45000, "remaining": 5000},
        {"category": "Shopping", "limit": 80000, "spent": 75000, "remaining": 5000},
    ]
    
    total_limit = sum(b["limit"] for b in budgets)
    total_spent = sum(b["spent"] for b in budgets)
    total_remaining = sum(b["remaining"] for b in budgets)
    
    return {
        "total_budget": total_limit,
        "total_spent": total_spent,
        "total_remaining": total_remaining,
        "budget_utilization": round(total_spent / total_limit * 100, 2),
        "budgets": budgets,
        "alert": "Over budget in Food category" if any(b["spent"] > b["limit"] for b in budgets) else "On track"
    }

# ==================== Debt Management ====================

@app.post("/api/v1/debt/calculate-emi")
async def calculate_debt_emi(debt_type: str, principal: float, interest_rate: float, tenure_months: int):
    """Calculate EMI for debt"""
    
    emi = calculate_emi(principal, interest_rate, tenure_months)
    total_interest = calculate_total_interest(principal, interest_rate, tenure_months)
    total_amount = principal + total_interest
    
    return {
        "debt_type": debt_type,
        "principal": principal,
        "interest_rate": interest_rate,
        "tenure_months": tenure_months,
        "monthly_emi": emi,
        "total_interest": round(total_interest, 2),
        "total_amount": round(total_amount, 2),
        "payoff_date": (datetime.now() + timedelta(days=tenure_months*30)).isoformat()
    }

@app.post("/api/v1/debt/prepayment-strategy")
async def debt_prepayment(principal: float, interest_rate: float, tenure_months: int, extra_payment: float):
    """Calculate prepayment impact"""
    
    normal_emi = calculate_emi(principal, interest_rate, tenure_months)
    new_emi = normal_emi + extra_payment
    
    normal_total_interest = calculate_total_interest(principal, interest_rate, tenure_months)
    
    # Simplified - interest saved approximately
    interest_saved = (extra_payment / normal_emi) * normal_total_interest * 0.3
    
    months_saved = int((extra_payment / normal_emi) * tenure_months * 0.2)
    
    return {
        "normal_emi": round(normal_emi, 2),
        "new_emi_with_extra": round(new_emi, 2),
        "extra_payment": extra_payment,
        "interest_saved": round(interest_saved, 2),
        "months_saved": months_saved,
        "new_tenure": tenure_months - months_saved,
        "recommendation": f"Pay extra ₹{extra_payment} monthly to save ₹{interest_saved:,.0f}"
    }

# ==================== Insurance Planning ====================

@app.post("/api/v1/insurance/needs-analysis")
async def insurance_needs(age: int, annual_income: float, dependents: int = 0, existing_coverage: float = 0):
    """Analyze insurance needs"""
    
    analysis = calculate_insurance_need(age, annual_income, dependents, existing_coverage)
    
    return analysis

@app.get("/api/v1/insurance/comparison")
async def insurance_comparison():
    """Compare insurance products"""
    
    return {
        "products": [
            {
                "name": "Term Life Insurance",
                "coverage": "₹50 lakh",
                "premium": "₹500/month",
                "best_for": "Young professionals",
                "features": ["Pure protection", "Affordable", "No maturity benefit"]
            },
            {
                "name": "Whole Life Insurance",
                "coverage": "₹50 lakh",
                "premium": "₹5000/month",
                "best_for": "Wealth creation",
                "features": ["Coverage + savings", "Maturity benefit", "High premium"]
            },
            {
                "name": "ULIP",
                "coverage": "₹50 lakh",
                "premium": "₹2000/month",
                "best_for": "Long-term growth",
                "features": ["Market-linked returns", "Flexible", "Moderate costs"]
            }
        ]
    }

# ==================== Retirement Planning ====================

@app.post("/api/v1/retirement/corpus-calculation")
async def retirement_corpus(current_age: int, retirement_age: int, current_savings: float,
                           monthly_savings: float, expected_return: float, annual_expense: float):
    """Calculate retirement corpus needed"""
    
    analysis = calculate_retirement_corpus(current_age, retirement_age, current_savings,
                                          monthly_savings, expected_return, annual_expense)
    
    return analysis

@app.get("/api/v1/retirement/strategies")
async def retirement_strategies():
    """Get retirement planning strategies"""
    
    return {
        "strategies": [
            {
                "name": "Aggressive Growth",
                "allocation": "80% Stocks, 20% Bonds",
                "suitable_for": "Age 25-40",
                "returns": "12-15% annually",
                "risk": "High"
            },
            {
                "name": "Balanced Growth",
                "allocation": "60% Stocks, 40% Bonds",
                "suitable_for": "Age 40-50",
                "returns": "9-12% annually",
                "risk": "Medium"
            },
            {
                "name": "Conservative",
                "allocation": "40% Stocks, 60% Bonds",
                "suitable_for": "Age 50+",
                "returns": "7-9% annually",
                "risk": "Low"
            }
        ]
    }

# ==================== Emergency Fund ====================

@app.post("/api/v1/emergency-fund/calculate")
async def calculate_emergency_fund_endpoint(monthly_expenses: float, months: int = 6):
    """Calculate emergency fund needed"""
    
    result = calculate_emergency_fund(monthly_expenses, months)
    
    return result

@app.get("/api/v1/emergency-fund/guidelines")
async def emergency_fund_guidelines():
    """Get emergency fund guidelines"""
    
    return {
        "guidelines": [
            {
                "life_stage": "Young Single",
                "months_needed": 3,
                "reason": "Low dependents, stable income"
            },
            {
                "life_stage": "Married with Family",
                "months_needed": 6,
                "reason": "Multiple dependents, fixed expenses"
            },
            {
                "life_stage": "Self-Employed",
                "months_needed": 12,
                "reason": "Irregular income, uncertain business"
            },
            {
                "life_stage": "Pre-Retirement",
                "months_needed": 12,
                "reason": "Transition planning"
            }
        ],
        "where_to_keep": {
            "3_months": "Savings Account (0.5% interest)",
            "2_months": "Liquid Mutual Funds (3-4% returns)",
            "1_month": "Short-term FDs (4-5% returns)"
        }
    }

# ==================== Financial Reports ====================

@app.get("/api/v1/reports/personal-finance")
async def personal_finance_report():
    """Generate personal finance report"""
    
    return {
        "report_date": datetime.now().isoformat(),
        "income": {
            "salary": 500000,
            "bonus": 100000,
            "other": 50000,
            "total": 650000
        },
        "expenses": {
            "fixed": 200000,
            "variable": 250000,
            "discretionary": 100000,
            "total": 550000
        },
        "savings": 100000,
        "savings_rate": 15.4,
        "net_worth": 2500000,
        "recommendations": [
            "Increase emergency fund to 6 months",
            "Review insurance coverage",
            "Start retirement planning",
            "Optimize tax planning"
        ]
    }

@app.get("/api/v1/reports/debt-analysis")
async def debt_analysis_report():
    """Analyze debt portfolio"""
    
    return {
        "total_debt": 1500000,
        "debts": [
            {
                "type": "Home Loan",
                "principal": 1000000,
                "outstanding": 800000,
                "rate": 6.5,
                "remaining_tenure": 180,
                "monthly_emi": 6500
            },
            {
                "type": "Personal Loan",
                "principal": 500000,
                "outstanding": 300000,
                "rate": 12,
                "remaining_tenure": 24,
                "monthly_emi": 14000
            }
        ],
        "total_monthly_emi": 20500,
        "dti_ratio": 3.2,
        "recommendation": "Debt manageable. Focus on home loan prepayment"
    }

# ==================== Financial Wellness ====================

@app.get("/api/v1/wellness/financial-score")
async def financial_wellness_score():
    """Calculate financial wellness score"""
    
    return {
        "overall_score": 72,
        "out_of": 100,
        "categories": {
            "Income Stability": 85,
            "Expense Management": 70,
            "Savings Rate": 65,
            "Debt Management": 75,
            "Insurance Coverage": 60,
            "Retirement Planning": 55,
            "Emergency Fund": 80,
            "Investment Diversity": 70
        },
        "strengths": [
            "Good expense tracking",
            "Adequate emergency fund",
            "Regular savings"
        ],
        "areas_to_improve": [
            "Increase retirement savings",
            "Review insurance coverage",
            "Diversify investments"
        ],
        "next_steps": [
            "Complete insurance gap analysis",
            "Start retirement planning",
            "Review and rebalance portfolio"
        ]
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
