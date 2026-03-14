from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import relationship

from database.models.base import Base


class Doctor(Base):
    __tablename__ = "doctors"

    id = Column(Integer, primary_key=True, index=True)
    hospital_id = Column(Integer, ForeignKey("hospitals.id"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    specialty = Column(String(255), nullable=False)
    qualification = Column(Text, nullable=False, default="")
    experience_years = Column(Integer, nullable=False, default=0)
    availability = Column(String(255), nullable=False, default="")
    is_available = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    hospital = relationship("Hospital", back_populates="doctors")
