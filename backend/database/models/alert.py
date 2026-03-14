from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, String, func
from sqlalchemy.orm import relationship

from database.models.base import Base


class Alert(Base):
    __tablename__ = "alerts"

    id = Column(Integer, primary_key=True, index=True)
    hospital_id = Column(Integer, ForeignKey("hospitals.id"), nullable=False, index=True)
    ambulance_request_id = Column(Integer, ForeignKey("ambulance_requests.id"), nullable=False, index=True)
    status = Column(String(32), nullable=False, default="reserved", index=True)
    eta = Column(Float, nullable=False)
    reserved_until = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    hospital = relationship("Hospital", back_populates="alerts")
    ambulance_request = relationship("AmbulanceRequest", back_populates="alerts")
