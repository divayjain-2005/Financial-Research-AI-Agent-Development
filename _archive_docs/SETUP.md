# Setup & Deployment Guide

## Table of Contents
1. [Local Development Setup](#local-development-setup)
2. [Database Configuration](#database-configuration)
3. [Environment Variables](#environment-variables)
4. [Running the Application](#running-the-application)
5. [Deployment Guide](#deployment-guide)
6. [Troubleshooting](#troubleshooting)

## Local Development Setup

### Prerequisites
- Python 3.10+
- Node.js 18+
- Git
- PostgreSQL (via Railway)
- Redis (via Railway)

### Backend Setup

#### 1. Clone Repository
```bash
git clone https://github.com/your-username/Financial-Research-AI-Agent-Development.git
cd Financial-Research-AI-Agent-Development/backend
```

#### 2. Create Virtual Environment
```bash
python -m venv venv

# Activate virtual environment
# On Windows:
venv\Scripts\activate
# On macOS/Linux:
source venv/bin/activate
```

#### 3. Install Dependencies
```bash
pip install -r requirements.txt
```

#### 4. Configure Environment Variables
```bash
cp .env.example .env
# Edit .env with your credentials
nano .env
```

#### 5. Run Backend
```bash
python main.py
```

Backend will be available at: `http://localhost:8000`
API documentation: `http://localhost:8000/docs`

### Frontend Setup

#### 1. Navigate to Frontend Directory
```bash
cd ../frontend
```

#### 2. Install Dependencies
```bash
npm install
```

#### 3. Configure Environment Variables
```bash
cp .env.local.example .env.local
# Edit .env.local if needed
nano .env.local
```

#### 4. Run Development Server
```bash
npm run dev
```

Frontend will be available at: `http://localhost:3000`

## Database Configuration

### Using Railway (Recommended)

#### 1. Create Railway Account
- Go to [railway.app](https://railway.app)
- Sign up with GitHub

#### 2. Create PostgreSQL Database
- Click "New" → Select "PostgreSQL"
- Get connection string from "Connect" tab
- Format: `postgresql://user:password@host:port/database`

#### 3. Create Redis Cache
- Click "New" → Select "Redis"
- Get connection URL
- Format: `redis://host:port`

#### 4. Update .env
```bash
DATABASE_URL=postgresql://user:password@host:port/dbname
REDIS_URL=redis://host:port/0
```

### Local PostgreSQL (Development Only)

#### 1. Install PostgreSQL
```bash
# macOS
brew install postgresql

# Ubuntu
sudo apt-get install postgresql

# Windows
# Download from https://www.postgresql.org/download/windows/
```

#### 2. Create Database
```bash
createdb financial_db
```

#### 3. Set Connection String
```bash
DATABASE_URL=postgresql://localhost/financial_db
REDIS_URL=redis://localhost:6379/0
```

## Environment Variables

### Backend (.env)

```bash
# FastAPI Configuration
ENVIRONMENT=development
DEBUG=true

# Database
DATABASE_URL=postgresql://user:password@host:port/database

# Redis
REDIS_URL=redis://host:port/0

# APIs
CLAUDE_API_KEY=your_claude_key_here
ALPHA_VANTAGE_API_KEY=your_alpha_vantage_key_here

# CORS Origins
CORS_ORIGINS=["http://localhost:3000"]
```

### Frontend (.env.local)

```bash
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_API_TIMEOUT=30000
```

## Running the Application

### Development Mode

#### Terminal 1 - Backend
```bash
cd backend
source venv/bin/activate
python main.py
```

#### Terminal 2 - Frontend
```bash
cd frontend
npm run dev
```

#### Terminal 3 - (Optional) Database monitoring
```bash
# Monitor PostgreSQL
psql -U postgres -d financial_db -c "SELECT * FROM stocks;"
```

### Production Mode

#### Backend
```bash
gunicorn -w 4 -b 0.0.0.0:8000 main:app
```

#### Frontend
```bash
npm run build
npm run start
```

## Deployment Guide

### Deploy to Railway (Recommended)

#### 1. Backend Deployment

**Create Railway Project:**
- Go to [railway.app](https://railway.app)
- Click "New Project"
- Select "GitHub Repo"
- Select your repository

**Configure:**
- Select `backend` directory
- Set start command: `python main.py`
- Add environment variables from `.env`
- Click "Deploy"

#### 2. Frontend Deployment

**Using Vercel (Recommended):**
```bash
npm i -g vercel
vercel
```

Follow prompts:
- Select framework: Next.js
- Project directory: `frontend`
- Build command: `npm run build`
- Output directory: `.next`

**Or using Railway:**
- Similar steps as backend
- Set start command: `npm run start`

#### 3. Database

```bash
# PostgreSQL on Railway
- Create PostgreSQL service
- Copy connection string
- Set DATABASE_URL in backend environment

# Redis on Railway
- Create Redis service
- Copy connection URL
- Set REDIS_URL in backend environment
```

### Using Docker

#### 1. Build Images
```bash
# Backend
docker build -t financial-ai-backend ./backend

# Frontend
docker build -t financial-ai-frontend ./frontend
```

#### 2. Run Containers
```bash
docker run -p 8000:8000 financial-ai-backend
docker run -p 3000:3000 financial-ai-frontend
```

#### 3. Docker Compose
```bash
docker-compose up
```

### Environment Setup

#### Production Variables

**Backend (.env.production)**
```bash
ENVIRONMENT=production
DEBUG=false
CORS_ORIGINS=["https://yourdomain.com"]
DATABASE_URL=postgresql://prod_user:prod_password@prod_host:5432/prod_db
REDIS_URL=redis://prod_host:6379
```

**Frontend (Vercel)**
- Set in Vercel dashboard → Settings → Environment Variables
- `NEXT_PUBLIC_API_URL=https://api.yourdomain.com`

## Troubleshooting

### Backend Issues

#### Port Already in Use
```bash
# Find process using port 8000
lsof -i :8000
kill -9 <PID>

# Or use different port
python main.py --port 8001
```

#### Database Connection Error
```bash
# Check connection string
echo $DATABASE_URL

# Test PostgreSQL connection
psql $DATABASE_URL -c "SELECT 1"

# Recreate tables
python -c "from app.models.stock import Base; from app.db.database import DatabaseManager; db = DatabaseManager('$DATABASE_URL'); db.init_db()"
```

#### Redis Connection Error
```bash
# Check Redis connection
redis-cli ping

# Verify Redis URL
echo $REDIS_URL
```

#### API Key Errors
```bash
# Verify Claude API key
curl -H "Authorization: Bearer $CLAUDE_API_KEY" https://api.anthropic.com/

# Verify Alpha Vantage key
curl "https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=RELIANCE.NS&apikey=$ALPHA_VANTAGE_API_KEY"
```

### Frontend Issues

#### Port Already in Use
```bash
# Find process using port 3000
lsof -i :3000
kill -9 <PID>

# Or use different port
PORT=3001 npm run dev
```

#### API Connection Error
```bash
# Check .env.local
cat .env.local

# Verify backend is running
curl http://localhost:8000/health

# Check CORS configuration in backend
```

#### Build Error
```bash
# Clear cache
rm -rf .next node_modules
npm install
npm run build
```

### Common Solutions

#### Clear Cache and Rebuild
```bash
# Backend
rm -rf __pycache__ .pytest_cache
pip install --force-reinstall -r requirements.txt

# Frontend
rm -rf node_modules .next
npm install
npm run build
```

#### Reset Database
```bash
# Drop all tables (CAUTION - Data loss!)
python -c "from app.db.database import DatabaseManager; db = DatabaseManager('$DATABASE_URL'); db.drop_db()"

# Reinitialize
python -c "from app.db.database import DatabaseManager; db = DatabaseManager('$DATABASE_URL'); db.init_db()"
```

#### Check Logs
```bash
# Backend logs
tail -f app.log

# Frontend logs
npm run dev 2>&1 | tee frontend.log
```

## Health Checks

### Backend Health
```bash
curl http://localhost:8000/health
curl http://localhost:8000/health/detailed
```

### Frontend Health
```bash
curl http://localhost:3000
```

### Database Health
```bash
psql -U user -d financial_db -c "\dt"
```

### Redis Health
```bash
redis-cli ping
redis-cli info
```

## Performance Optimization

### Backend
- Enable caching: `CACHE_TTL=3600`
- Set connection pool: `REDIS_MAX_CONNECTIONS=50`
- Use async operations
- Enable response compression

### Frontend
- Enable code splitting
- Use lazy loading for components
- Enable image optimization
- Use service workers

## Security Checklist

- [ ] Change SECRET_KEY in production
- [ ] Enable HTTPS/SSL
- [ ] Set secure CORS origins
- [ ] Hide API keys in environment variables
- [ ] Enable database encryption
- [ ] Set rate limiting
- [ ] Enable logging and monitoring
- [ ] Regular security updates

## Support

For issues and questions:
- Create GitHub issue
- Check documentation
- Review logs
- Contact support
