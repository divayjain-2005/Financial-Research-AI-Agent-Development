# API Documentation

## Base URL
```
http://localhost:8000
```

## Health Checks

### GET /health
Simple health check endpoint.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-03-04T10:30:00Z",
  "environment": "development"
}
```

### GET /health/detailed
Detailed health check with database and cache status.

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2024-03-04T10:30:00Z",
  "database": "healthy",
  "redis": "healthy",
  "api_client": "healthy",
  "environment": "development"
}
```

## Stock API Endpoints

### GET /api/v1/stocks/quote/{symbol}
Get current stock quote.

**Parameters:**
- `symbol` (path): Stock symbol (e.g., RELIANCE.NS)

**Response:**
```json
{
  "symbol": "RELIANCE.NS",
  "current_price": 2850.50,
  "previous_close": 2840.00,
  "change": 10.50,
  "change_percent": 0.37,
  "timestamp": "2024-03-04T15:30:00Z",
  "sma_20": 2835.25,
  "sma_50": 2820.75,
  "rsi_14": 65.42
}
```

### GET /api/v1/stocks/historical/{symbol}
Get historical daily price data.

**Parameters:**
- `symbol` (path): Stock symbol
- `limit` (query): Number of records (1-1000, default: 100)

**Response:**
```json
{
  "symbol": "RELIANCE.NS",
  "data": [
    {
      "date": "2024-03-04",
      "open": 2845.00,
      "high": 2860.00,
      "low": 2840.00,
      "close": 2850.50,
      "volume": 15000000
    }
  ],
  "count": 100,
  "timestamp": "2024-03-04T10:30:00Z"
}
```

### GET /api/v1/stocks/intraday/{symbol}
Get intraday price data.

**Parameters:**
- `symbol` (path): Stock symbol
- `interval` (query): Time interval (1min, 5min, 15min, 30min, 60min)

**Response:**
```json
{
  "symbol": "RELIANCE.NS",
  "interval": "5min",
  "data": [
    {
      "timestamp": "2024-03-04T15:25:00Z",
      "open": 2850.00,
      "high": 2852.00,
      "low": 2848.00,
      "close": 2851.00,
      "volume": 500000
    }
  ],
  "count": 50,
  "timestamp": "2024-03-04T10:30:00Z"
}
```

### POST /api/v1/stocks/analyze
Comprehensive stock analysis with technical indicators and sentiment.

**Request:**
```json
{
  "symbol": "RELIANCE.NS",
  "include_sentiment": true,
  "include_technicals": true,
  "include_fundamentals": false
}
```

**Response:**
```json
{
  "symbol": "RELIANCE.NS",
  "company_name": "RELIANCE",
  "current_price": 2850.50,
  "change_percent": 0.37,
  "technicals": [
    {
      "indicator": "SMA_20",
      "value": 2835.25,
      "signal": "BUY"
    },
    {
      "indicator": "RSI_14",
      "value": 65.42,
      "signal": "SELL"
    }
  ],
  "sentiment_score": 0.65,
  "sentiment_label": "POSITIVE",
  "recommendation": "HOLD",
  "confidence_score": 0.75,
  "analysis_timestamp": "2024-03-04T10:30:00Z"
}
```

### GET /api/v1/stocks/compare
Compare multiple stocks.

**Parameters:**
- `symbols` (query): Comma-separated stock symbols (e.g., RELIANCE.NS,TCS.NS)

**Response:**
```json
{
  "symbols": ["RELIANCE.NS", "TCS.NS"],
  "data": [
    {
      "symbol": "RELIANCE.NS",
      "price": 2850.50,
      "change": 10.50,
      "change_percent": 0.37
    },
    {
      "symbol": "TCS.NS",
      "price": 3950.00,
      "change": -5.00,
      "change_percent": -0.13
    }
  ],
  "timestamp": "2024-03-04T10:30:00Z"
}
```

### GET /api/v1/stocks/market-status
Check if market is currently open.

**Response:**
```json
{
  "market_open": true,
  "market_hours": "09:15 - 15:30 IST",
  "trading_days": "Monday - Friday",
  "timestamp": "2024-03-04T10:30:00Z"
}
```

## Chat API Endpoints

### POST /api/v1/chat/query
Query the financial research assistant.

**Request:**
```json
{
  "message": "What is the current market sentiment?",
  "history": [
    {
      "role": "user",
      "content": "Previous message"
    },
    {
      "role": "assistant",
      "content": "Previous response"
    }
  ],
  "context": {
    "stocks": ["RELIANCE.NS", "TCS.NS"]
  }
}
```

**Response:**
```json
{
  "response": "The Indian stock market is showing...",
  "sources": ["economic-times.com", "rbi.org"],
  "confidence": 0.85,
  "timestamp": "2024-03-04T10:30:00Z"
}
```

### POST /api/v1/chat/stock-analysis
Analyze a specific stock using natural language.

**Request:**
```json
{
  "symbol": "RELIANCE.NS",
  "query": "Should I buy this stock?"
}
```

**Response:**
```json
{
  "response": "Based on current analysis...",
  "sources": [],
  "confidence": 0.80,
  "timestamp": "2024-03-04T10:30:00Z"
}
```

### POST /api/v1/chat/portfolio-advice
Get advice on a portfolio.

**Request:**
```json
{
  "portfolio_symbols": ["RELIANCE.NS", "TCS.NS", "INFY.NS"],
  "query": "Is my portfolio diversified enough?"
}
```

### POST /api/v1/chat/market-sentiment
Get market sentiment analysis.

**Request:**
```json
{
  "sector": "IT"
}
```

### POST /api/v1/chat/economic-update
Get latest economic indicators and analysis.

**Request:**
```json
{
  "indicator": "interest-rate"
}
```

### POST /api/v1/chat/investment-strategy
Get personalized investment strategy.

**Request:**
```json
{
  "risk_profile": "MEDIUM",
  "investment_amount": 100000,
  "time_horizon_months": 60
}
```

## Error Responses

All endpoints return errors in this format:

```json
{
  "error": "Error Type",
  "detail": "Detailed error message",
  "timestamp": "2024-03-04T10:30:00Z"
}
```

### Common Status Codes
- `200`: Success
- `400`: Bad Request
- `404`: Not Found
- `500`: Internal Server Error
- `503`: Service Unavailable

## Authentication

Currently no authentication required. In production, add:
- Bearer token in Authorization header
- API key validation
- Rate limiting per user

## Rate Limiting

- Global: 100 requests per 3600 seconds
- Per-API: 5 requests per minute (Alpha Vantage)
- Caching: 3600 seconds default TTL

## Example Requests

### Using cURL
```bash
# Get stock quote
curl http://localhost:8000/api/v1/stocks/quote/RELIANCE.NS

# Analyze stock
curl -X POST http://localhost:8000/api/v1/stocks/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "symbol": "RELIANCE.NS",
    "include_sentiment": true
  }'

# Chat with assistant
curl -X POST http://localhost:8000/api/v1/chat/query \
  -H "Content-Type: application/json" \
  -d '{
    "message": "What stocks should I invest in?"
  }'
```

### Using Python
```python
import requests

# Get quote
response = requests.get('http://localhost:8000/api/v1/stocks/quote/RELIANCE.NS')
print(response.json())

# Analyze stock
data = {
    'symbol': 'RELIANCE.NS',
    'include_sentiment': True
}
response = requests.post('http://localhost:8000/api/v1/stocks/analyze', json=data)
print(response.json())
```

### Using JavaScript/Fetch
```javascript
// Get quote
fetch('http://localhost:8000/api/v1/stocks/quote/RELIANCE.NS')
  .then(r => r.json())
  .then(data => console.log(data));

// Chat with assistant
fetch('http://localhost:8000/api/v1/chat/query', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({
    message: 'Analyze RELIANCE.NS'
  })
})
  .then(r => r.json())
  .then(data => console.log(data));
```
