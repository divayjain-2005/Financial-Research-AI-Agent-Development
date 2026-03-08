from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(
    title="Financial Research AI Agent",
    version="0.1.0",
    description="AI-powered financial research assistant"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {"message": "Financial Research AI Agent API"}

@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "service": "Financial Research AI Agent",
        "environment": "production"
    }

@app.get("/api/v1/stocks/quote/{symbol}")
async def get_stock_quote(symbol: str):
    return {
        "symbol": symbol,
        "price": 0,
        "change": 0,
        "timestamp": ""
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)