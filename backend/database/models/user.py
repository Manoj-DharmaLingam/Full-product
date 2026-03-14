from sqlalchemy import Column, Integer, String
from sqlalchemy.orm import relationship

from database.models.base import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    role = Column(String(20), nullable=False, index=True)
    email = Column(String(255), nullable=False, unique=True, index=True)
    password_hash = Column(String(255), nullable=False)

    hospital = relationship("Hospital", back_populates="user", uselist=False, cascade="all, delete-orphan")
    ambulance = relationship("Ambulance", back_populates="user", uselist=False, cascade="all, delete-orphan")
