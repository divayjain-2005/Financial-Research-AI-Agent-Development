from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    database_url: str = ""
    redis_url: str = ""
    claude_api_key: str = ""
    alpha_vantage_api_key: str = ""
    
    class Config:
        env_file = ".env"

def get_settings():
    return Settings()