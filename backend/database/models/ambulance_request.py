from sqlalchemy import Column, DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import relationship

from database.models.base import Base


class AmbulanceRequest(Base):
    __tablename__ = "ambulance_requests"

    id = Column(Integer, primary_key=True, index=True)
    ambulance_id = Column(Integer, ForeignKey("ambulances.id"), nullable=False, index=True)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    blood_group = Column(String(8), nullable=False)
    oxygen_level = Column(Float, nullable=False)
    patient_condition_notes = Column(Text, nullable=False)
    severity = Column(String(16), nullable=False, index=True)
    required_specialty = Column(String(100), nullable=True)
    timestamp = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    ambulance = relationship("Ambulance", back_populates="requests")
    alerts = relationship("Alert", back_populates="ambulance_request")
