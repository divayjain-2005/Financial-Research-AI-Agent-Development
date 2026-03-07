# Quick Start Guide

Get the Financial Research AI Agent up and running in 10 minutes!

## Option 1: Docker Compose (Fastest - 5 minutes)

### Prerequisites
- Docker & Docker Compose installed
- Claude API key
- Alpha Vantage API key (optional)

### Steps

1. **Clone and Navigate**
   ```bash
   cd Financial-Research-AI-Agent-Development
   ```

2. **Configure Environment**
   ```bash
   # Create .env file
   cp backend/.env.example backend/.env
   
   # Edit and add your API keys:
   # - CLAUDE_API_KEY
   # - ALPHA_VANTAGE_API_KEY
   nano backend/.env
   ```

3. **Start Everything**
   ```bash
   docker-compose up
   ```

4. **Access Services**
   - **Frontend**: http://localhost:3000
   - **Backend API**: http://localhost:8000
   - **API Docs**: http://localhost:8000/docs
   - **Database**: localhost:5432 (user: financial_user, pass: financial_password)
   - **Redis**: localhost:6379
   - **pgAdmin**: http://localhost:5050 (admin@example.com / admin)
   - **Redis Commander**: http://localhost:8081

## Option 2: Local Development (10 minutes)

### Backend Setup

1. **Python Environment**
   ```bash
   cd backend
   python -m venv venv
   source venv/bin/activate  # Windows: venv\Scripts\activate
   ```

2. **Dependencies**
   ```bash
   pip install -r requirements.txt
   ```

3. **Environment Variables**
   ```bash
   cp .env.example .env
   # Edit .env with your API keys and database connection
   ```

4. **Database Setup (Railway)**
   ```bash
   # Go to https://railway.app
   # Create PostgreSQL and Redis services
   # Copy connection strings to .env
   ```

5. **Run Backend**
   ```bash
   python main.py
   ```

### Frontend Setup (New Terminal)

1. **Install Dependencies**
   ```bash
   cd frontend
   npm install
   ```

2. **Environment Variables**
   ```bash
   cp .env.local.example .env.local
   # Update API_URL if backend is not on localhost:8000
   ```

3. **Start Dev Server**
   ```bash
   npm run dev
   ```

4. **Open Browser**
   ```
   http://localhost:3000
   ```

## Quick API Test

### Test with cURL

```bash
# Get stock quote
curl http://localhost:8000/api/v1/stocks/quote/RELIANCE.NS

# Analyze stock
curl -X POST http://localhost:8000/api/v1/stocks/analyze \
  -H "Content-Type: application/json" \
  -d '{"symbol":"RELIANCE.NS","include_sentiment":true}'

# Chat with AI
curl -X POST http://localhost:8000/api/v1/chat/query \
  -H "Content-Type: application/json" \
  -d '{"message":"What stocks should I invest in?"}'
```

### Test with Python

```python
import requests

# Get quote
resp = requests.get('http://localhost:8000/api/v1/stocks/quote/RELIANCE.NS')
print(resp.json())

# Analyze
resp = requests.post('http://localhost:8000/api/v1/stocks/analyze', json={
    'symbol': 'RELIANCE.NS',
    'include_sentiment': True
})
print(resp.json())
```

## Testing Stocks

Popular Indian stocks to test:
- RELIANCE.NS - Reliance Industries
- TCS.NS - Tata Consultancy Services
- INFY.NS - Infosys
- WIPRO.NS - Wipro
- HDFC.NS - HDFC Bank

## Troubleshooting

### Backend Won't Start
```bash
# Check if port 8000 is in use
lsof -i :8000
kill -9 <PID>

# Verify Python version
python --version  # Should be 3.10+

# Check dependencies
pip list | grep -E "fastapi|sqlalchemy|redis"
```

### Frontend Won't Load
```bash
# Clear cache
rm -rf node_modules .next
npm install

# Check API connectivity
curl http://localhost:8000/health

# Check environment
cat .env.local
```

### Database Connection Error
```bash
# Verify PostgreSQL is running
psql -U financial_user -h localhost -d financial_db

# Check Redis
redis-cli ping

# Verify connection strings in .env
grep "DATABASE_URL\|REDIS_URL" .env
```

### API Returns 503 (Service Unavailable)
- Check if all services are running
- Verify API keys are correct
- Check rate limits

## Project Structure

```
.
├── backend/          → FastAPI backend
├── frontend/         → Next.js frontend
├── docs/             → Documentation
└── docker-compose.yml → Docker setup
```

## What You Can Do Now

✅ **Search stocks** - Get real-time quotes for Indian stocks  
✅ **Technical analysis** - View indicators (SMA, EMA, RSI, MACD)  
✅ **AI chat** - Ask the financial assistant questions  
✅ **Compare stocks** - Compare multiple stocks side-by-side  
✅ **Market status** - Check if market is open  

## Next Steps

1. **Get API Keys**
   - Claude: https://www.anthropic.com/
   - Alpha Vantage: https://www.alphavantage.co/

2. **Set Up Database** (if not using Docker)
   - Railway: https://railway.app (recommended)
   - Or local PostgreSQL + Redis

3. **Explore Features**
   - Try stock analysis
   - Chat with AI
   - View technical indicators

4. **Read Documentation**
   - `/docs/API.md` - API reference
   - `/docs/SETUP.md` - Detailed setup guide
   - `/README.md` - Project overview

## Key Commands

```bash
# Start everything (Docker)
docker-compose up

# Start backend only
python main.py

# Start frontend only
npm run dev

# Build for production
docker build -t financial-ai-backend ./backend
docker build -t financial-ai-frontend ./frontend

# Stop all services
docker-compose down

# View logs
docker-compose logs -f backend
docker-compose logs -f frontend
```

## Useful URLs

| Service | URL | Login |
|---------|-----|-------|
| Frontend | http://localhost:3000 | - |
| API | http://localhost:8000 | - |
| API Docs | http://localhost:8000/docs | - |
| Health Check | http://localhost:8000/health | - |
| pgAdmin | http://localhost:5050 | admin@example.com / admin |
| Redis | http://localhost:8081 | - |

## Performance Tips

- Financial data is cached for 1 hour
- Use Redis for faster responses
- Intraday data cached for 5 minutes
- Technical indicators calculated on-demand

## Debugging

### Enable Debug Mode
Edit `backend/.env`:
```
DEBUG=true
LOG_LEVEL=DEBUG
```

### Check Logs
```bash
# Backend
tail -f app.log

# Frontend (in dev terminal)
# Output goes to console
```

### Database Inspection
```bash
# List tables
psql -U financial_user -d financial_db -c "\dt"

# Query stocks
psql -U financial_user -d financial_db -c "SELECT * FROM stocks LIMIT 5;"
```

## Common Tasks

### Add a New Stock
Stocks are automatically cached when you search for them.

### Check Market Status
```bash
curl http://localhost:8000/api/v1/stocks/market-status
```

### Get Historical Data
```bash
curl "http://localhost:8000/api/v1/stocks/historical/RELIANCE.NS?limit=100"
```

### Run Tests
```bash
cd backend
pytest tests/
```

## Resources

- FastAPI Docs: https://fastapi.tiangolo.com/
- Next.js Docs: https://nextjs.org/
- Tailwind CSS: https://tailwindcss.com/
- Docker Docs: https://docs.docker.com/
- Railway Docs: https://docs.railway.app/

## Support

If you encounter issues:

1. Check `/docs/SETUP.md` for detailed troubleshooting
2. Review API documentation: `/docs/API.md`
3. Check GitHub issues (when repo is created)
4. Review logs for error messages

---

**Happy analyzing! 📈📊**

For full documentation, see `/docs/` folder or `/README.md`
