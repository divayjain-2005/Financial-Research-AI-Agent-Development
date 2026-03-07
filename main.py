from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
import logging
import sys
from datetime import datetime

from app.core.config import get_settings
from app.db.database import init_db_managers, get_db, get_redis
from app.utils.api_client import AlphaVantageAPI, RateLimiter

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler('app.log')
    ]
)
logger = logging.getLogger(__name__)

# Global instances
settings = get_settings()
alpha_vantage_api = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage app lifecycle - startup and shutdown."""
    # Startup
    logger.info("=" * 50)
    logger.info("Starting Financial Research AI Agent")
    logger.info(f"Environment: {settings.environment}")
    logger.info(f"Debug Mode: {settings.debug}")
    logger.info("=" * 50)
    
    # Initialize database managers
    try:
        init_db_managers(
            settings.database_url,
            settings.redis_url,
            settings.redis_max_connections
        )
        logger.info("✓ Database managers initialized")
    except Exception as e:
        logger.error(f"✗ Failed to initialize database managers: {str(e)}")
        raise
    
    # Initialize API clients
    global alpha_vantage_api
    if settings.alpha_vantage_api_key:
        rate_limiter = RateLimiter(
            max_requests=settings.rate_limit_requests,
            window_seconds=settings.rate_limit_window
        )
        alpha_vantage_api = AlphaVantageAPI(
            api_key=settings.alpha_vantage_api_key,
            rate_limiter=rate_limiter
        )
        logger.info("✓ Alpha Vantage API initialized")
    else:
        logger.warning("⚠ Alpha Vantage API key not configured")
    
    logger.info("Application ready to serve requests")
    
    yield  # Application runs here
    
    # Shutdown
    logger.info("Shutting down application...")
    logger.info("✓ Application shutdown complete")


# Create FastAPI app
app = FastAPI(
    title=settings.api_title,
    description=settings.api_description,
    version=settings.api_version,
    debug=settings.debug,
    lifespan=lifespan
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Health Check Endpoints
@app.get("/health", tags=["Health"])
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "timestamp": datetime.utcnow().isoformat(),
        "environment": settings.environment
    }


@app.get("/health/detailed", tags=["Health"])
async def detailed_health_check(db=Depends(get_db)):
    """Detailed health check with database and cache verification."""
    try:
        # Check database
        db_status = "healthy"
        try:
            # Simple query to verify DB connection
            db.execute("SELECT 1")
        except Exception as e:
            db_status = "unhealthy"
            logger.error(f"Database check failed: {str(e)}")
        
        # Check Redis
        redis_status = "healthy"
        try:
            redis_client = get_redis()
            redis_client.ping()
        except Exception as e:
            redis_status = "unhealthy"
            logger.error(f"Redis check failed: {str(e)}")
        
        # Check API client
        api_status = "not_configured" if not alpha_vantage_api else "healthy"
        
        return {
            "status": "healthy" if (db_status == "healthy" and redis_status == "healthy") else "degraded",
            "timestamp": datetime.utcnow().isoformat(),
            "database": db_status,
            "redis": redis_status,
            "api_client": api_status,
            "environment": settings.environment
        }
    
    except Exception as e:
        logger.error(f"Health check failed: {str(e)}")
        return {
            "status": "unhealthy",
            "error": str(e),
            "timestamp": datetime.utcnow().isoformat()
        }


# Root endpoint
@app.get("/", tags=["Root"])
async def root():
    """Root endpoint with API information."""
    return {
        "name": settings.api_title,
        "version": settings.api_version,
        "description": settings.api_description,
        "endpoints": {
            "health": "/health",
            "docs": "/docs",
            "redoc": "/redoc",
            "stocks": "/api/v1/stocks",
            "chat": "/api/v1/chat"
        }
    }


# Global exception handler
@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    """Handle all unhandled exceptions."""
    logger.error(f"Unhandled exception: {str(exc)}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={
            "error": "Internal Server Error",
            "detail": str(exc) if settings.debug else "An error occurred",
            "timestamp": datetime.utcnow().isoformat()
        }
    )


# Import API routes
from app.api import stocks, chat

# Include routers
app.include_router(stocks.router)
app.include_router(chat.router)


if __name__ == "__main__":
    import uvicorn
    
    uvicorn.run(
        "main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.debug,
        log_level=settings.log_level.lower()
    )
