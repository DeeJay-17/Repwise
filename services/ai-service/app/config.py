"""Settings read from environment variables (prefix AI_SERVICE_)."""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Every setting the service reads. Values come from the environment or a .env file."""

    model_config = SettingsConfigDict(env_prefix="AI_SERVICE_", env_file=".env", extra="ignore")

    service_name: str = "ai-service"
    log_level: str = "INFO"


def get_settings() -> Settings:
    return Settings()
