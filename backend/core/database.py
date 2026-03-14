from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import NullPool

from core.config import settings

_url = settings.DATABASE_URL
# SQLAlchemy 2.x dropped the 'postgres' dialect alias — must be 'postgresql'
if _url.startswith("postgres://"):
    _url = _url.replace("postgres://", "postgresql://", 1)

_is_local = "localhost" in _url or "127.0.0.1" in _url

if _is_local:
    engine = create_engine(_url, pool_pre_ping=True, future=True)
else:
    # Serverless (Vercel) — NullPool prevents connection exhaustion
    # Supabase requires sslmode=require for all non-local connections
    engine = create_engine(
        _url,
        pool_pre_ping=True,
        future=True,
        poolclass=NullPool,
        connect_args={"sslmode": "require"},
    )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
