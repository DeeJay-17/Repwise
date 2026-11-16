"""Settings read from environment variables (prefix AI_SERVICE_)."""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Every setting the service reads. Values come from the environment or a .env file."""

    model_config = SettingsConfigDict(env_prefix="AI_SERVICE_", env_file=".env", extra="ignore")

    service_name: str = "ai-service"
    log_level: str = "INFO"
    # Generation requests allowed per client IP per minute.
    rate_limit_per_minute: int = 10
    # Seconds to wait for one model call before giving up.
    model_timeout_seconds: float = 90
    # Times the model may fix a plan that failed validation before the fallback is used.
    max_repairs: int = 2


@lru_cache
def get_settings() -> Settings:
    return Settings()
