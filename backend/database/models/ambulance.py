from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, String, func
from sqlalchemy.orm import relationship

from database.models.base import Base


class Ambulance(Base):
    __tablename__ = "ambulances"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, unique=True, index=True)
    ambulance_id = Column(String(64), nullable=False, unique=True, index=True)
    driver_name = Column(String(255), nullable=False)
    driver_phone = Column(String(32), nullable=False)
    ambulance_registration_number = Column(String(64), nullable=False, unique=True)
    latitude = Column(Float, nullable=True, default=None)
    longitude = Column(Float, nullable=True, default=None)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    user = relationship("User", back_populates="ambulance")
    requests = relationship("AmbulanceRequest", back_populates="ambulance")
