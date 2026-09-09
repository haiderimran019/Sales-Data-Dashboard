from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    database_url: str = "postgresql+psycopg://localhost/analytics_platform"
    secret_key: str = ""
    google_client_id: str = ""
    google_client_secret: str = ""
    session_max_age_seconds: int = 28_800
    cookie_secure: bool = False
    frontend_url: str = "http://localhost:5173"
    backend_url: str = "http://localhost:8000"
    cors_origins: str = "http://localhost:5173"
    ai_api_key: str | None = None
    ai_provider: str = "gemini"
    gemini_api_key: str | None = None
    gemini_model: str = "gemini-2.0-flash"
    ai_timeout_seconds: float = 30.0
    ai_max_datasets: int = 10
    ai_max_columns: int = 100
    ai_max_results: int = 50
    ai_max_text_chars: int = 4000
    ai_max_context_chars: int = 30000
    storage_endpoint: str | None = None
    storage_bucket: str | None = None
    storage_access_key: str | None = None
    storage_secret_key: str | None = None
    local_storage_path: str = "./.storage"
    max_upload_size_mb: int = 50
    preview_row_limit: int = 100
    preview_text_limit: int = 4000

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
