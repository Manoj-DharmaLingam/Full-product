from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import inspect, text

from core.config import settings
from core.database import engine
from database.models import Base
from modules.alerts.router import router as alerts_router
from modules.ambulance.router import router as ambulance_router
from modules.auth.router import router as auth_router
from modules.hospital.router import router as hospital_router


def ensure_legacy_schema_columns() -> None:
    inspector = inspect(engine)

    schema_updates: dict[str, list[str]] = {
        "ambulances": [
            "ALTER TABLE ambulances ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION",
            "ALTER TABLE ambulances ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION",
        ],
        "hospitals": [
            "ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS available_icu_beds INTEGER NOT NULL DEFAULT 0",
            "ALTER TABLE hospitals ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE",
        ],
    }

    with engine.begin() as connection:
        existing_tables = set(inspector.get_table_names())
        for table_name, statements in schema_updates.items():
            if table_name not in existing_tables:
                continue
            existing_columns = {column["name"] for column in inspector.get_columns(table_name)}
            for statement in statements:
                column_name = statement.split("ADD COLUMN IF NOT EXISTS ", 1)[1].split(" ", 1)[0]
                if column_name not in existing_columns:
                    connection.execute(text(statement))


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    ensure_legacy_schema_columns()
    yield


app = FastAPI(
    title="Emergency ICU Routing Platform API",
    version="1.0.0",
    description="Unified backend for hospital and ambulance operations with ICU routing.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_origin_regex=r"(http://localhost:\d+|https://[\w-]+\.vercel\.app)",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(hospital_router)
app.include_router(ambulance_router)
app.include_router(alerts_router)


@app.get("/")
async def root():
    return {"status": "ok", "service": "Emergency ICU Routing Platform API"}


@app.get("/health")
async def health():
    return {"status": "healthy"}
