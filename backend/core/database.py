from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from core.config import settings

_url = settings.DATABASE_URL
_is_local = "localhost" in _url or "127.0.0.1" in _url
_connect_args = {} if _is_local else {"sslmode": "require"}

engine = create_engine(
    _url,
    pool_pre_ping=True,
    future=True,
    connect_args=_connect_args,
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
