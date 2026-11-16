"""Settings read from environment variables (prefix CORE_API_)."""

from functools import lru_cache
from typing import Annotated

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict


class Settings(BaseSettings):
    """Every setting the service reads. Values come from the environment or a .env file."""

    model_config = SettingsConfigDict(env_prefix="CORE_API_", env_file=".env", extra="ignore")

    service_name: str = "core-api"
    log_level: str = "INFO"
    # SQLAlchemy URL. Postgres in Docker and Azure; a local SQLite file by default.
    database_url: str = "sqlite:///./core-api.db"
    # Secret for signing access tokens. Must be set to a long random value outside dev.
    jwt_secret: str = Field("dev-only-insecure-secret-change-me-please", min_length=32)
    access_token_minutes: int = 60
    refresh_token_days: int = 60
    # OAuth client IDs whose Google ID tokens are accepted (comma-separated).
    google_client_ids: Annotated[list[str], NoDecode] = []
    # Most changes accepted, and returned, in one sync request.
    sync_page_size: int = 500

    @field_validator("google_client_ids", mode="before")
    @classmethod
    def split_ids(cls, value: object) -> object:
        if isinstance(value, str):
            return [v.strip() for v in value.split(",") if v.strip()]
        return value


@lru_cache
def get_settings() -> Settings:
    return Settings()
