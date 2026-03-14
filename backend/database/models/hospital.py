from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import relationship

from database.models.base import Base


class Hospital(Base):
    __tablename__ = "hospitals"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, unique=True, index=True)
    hospital_name = Column(String(255), nullable=False, unique=True, index=True)
    contact_number = Column(String(32), nullable=False)
    hospital_address = Column(Text, nullable=False)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    specialties = Column(Text, nullable=False, default="")
    total_icu_beds = Column(Integer, nullable=False, default=0)
    available_icu_beds = Column(Integer, nullable=False, default=0)
    is_active = Column(Boolean, nullable=False, default=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    user = relationship("User", back_populates="hospital")
    alerts = relationship("Alert", back_populates="hospital")
    doctors = relationship("Doctor", back_populates="hospital", cascade="all, delete-orphan")
