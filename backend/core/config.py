from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql://postgres:postgres@localhost:5432/emergency_icu"
    JWT_SECRET: str = "change-me"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 1440
    GOOGLE_MAPS_API_KEY: str = ""
    ALLOWED_ORIGINS: str = "http://localhost:5173,http://localhost:5174,http://localhost:3000"
    RESERVATION_TTL_MINUTES: int = 15
    AMBULANCE_AVERAGE_SPEED_KMH: float = 45.0
    MAX_REASONABLE_DISTANCE_KM: float = 30.0
    OPTIMAL_ICU_BEDS: int = 3
    RECOMMEND_TOP_N: int = 20
    ALERTS_QUERY_LIMIT: int = 100

    class Config:
        env_file = ".env"

    @property
    def cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.ALLOWED_ORIGINS.split(",") if origin.strip()]


settings = Settings()
