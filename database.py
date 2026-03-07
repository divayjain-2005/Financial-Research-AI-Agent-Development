from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import NullPool
import redis
from contextlib import contextmanager
from typing import Generator
import logging

logger = logging.getLogger(__name__)


class DatabaseManager:
    """Manages PostgreSQL database connections."""
    
    def __init__(self, database_url: str):
        """Initialize database connection."""
        # Use NullPool for better async compatibility
        self.engine = create_engine(
            database_url,
            echo=False,
            poolclass=NullPool,
            connect_args={
                "timeout": 30,
                "check_same_thread": False
            }
        )
        self.SessionLocal = sessionmaker(
            autocommit=False,
            autoflush=False,
            bind=self.engine
        )
    
    def get_db(self) -> Generator[Session, None, None]:
        """Get database session as dependency."""
        db = self.SessionLocal()
        try:
            yield db
        except Exception as e:
            logger.error(f"Database error: {str(e)}")
            db.rollback()
            raise
        finally:
            db.close()
    
    @contextmanager
    def get_db_context(self) -> Generator[Session, None, None]:
        """Context manager for database session."""
        db = self.SessionLocal()
        try:
            yield db
            db.commit()
        except Exception as e:
            logger.error(f"Database context error: {str(e)}")
            db.rollback()
            raise
        finally:
            db.close()
    
    def init_db(self):
        """Initialize database tables."""
        from app.models.stock import Base
        Base.metadata.create_all(bind=self.engine)
        logger.info("Database tables initialized")
    
    def drop_db(self):
        """Drop all database tables (development only)."""
        from app.models.stock import Base
        Base.metadata.drop_all(bind=self.engine)
        logger.warning("All database tables dropped")


class RedisManager:
    """Manages Redis cache connections."""
    
    def __init__(self, redis_url: str, max_connections: int = 50):
        """Initialize Redis connection pool."""
        try:
            self.redis_client = redis.from_url(
                redis_url,
                max_connections=max_connections,
                decode_responses=True,
                socket_connect_timeout=5,
                socket_keepalive=True
            )
            # Test connection
            self.redis_client.ping()
            logger.info("Redis connection established")
        except Exception as e:
            logger.error(f"Redis connection failed: {str(e)}")
            self.redis_client = None
    
    def get_client(self) -> redis.Redis:
        """Get Redis client."""
        if self.redis_client is None:
            raise RuntimeError("Redis connection not established")
        return self.redis_client
    
    def set_cache(self, key: str, value: str, ttl: int = 3600) -> bool:
        """Set value in cache with TTL."""
        if self.redis_client is None:
            return False
        try:
            self.redis_client.setex(key, ttl, value)
            return True
        except Exception as e:
            logger.error(f"Cache set error: {str(e)}")
            return False
    
    def get_cache(self, key: str) -> str | None:
        """Get value from cache."""
        if self.redis_client is None:
            return None
        try:
            return self.redis_client.get(key)
        except Exception as e:
            logger.error(f"Cache get error: {str(e)}")
            return None
    
    def delete_cache(self, key: str) -> bool:
        """Delete key from cache."""
        if self.redis_client is None:
            return False
        try:
            self.redis_client.delete(key)
            return True
        except Exception as e:
            logger.error(f"Cache delete error: {str(e)}")
            return False
    
    def flush_all(self) -> bool:
        """Flush all cache (development only)."""
        if self.redis_client is None:
            return False
        try:
            self.redis_client.flushall()
            logger.warning("All cache flushed")
            return True
        except Exception as e:
            logger.error(f"Cache flush error: {str(e)}")
            return False
    
    def close(self):
        """Close Redis connection."""
        if self.redis_client:
            self.redis_client.close()
            logger.info("Redis connection closed")


# Global instances (initialized in main.py)
db_manager: DatabaseManager | None = None
redis_manager: RedisManager | None = None


def init_db_managers(database_url: str, redis_url: str, max_redis_connections: int = 50):
    """Initialize database and Redis managers."""
    global db_manager, redis_manager
    
    db_manager = DatabaseManager(database_url)
    db_manager.init_db()
    
    redis_manager = RedisManager(redis_url, max_redis_connections)


def get_db() -> Generator[Session, None, None]:
    """Dependency for getting database session."""
    if db_manager is None:
        raise RuntimeError("Database manager not initialized")
    yield from db_manager.get_db()


def get_redis() -> redis.Redis:
    """Dependency for getting Redis client."""
    if redis_manager is None:
        raise RuntimeError("Redis manager not initialized")
    return redis_manager.get_client()
