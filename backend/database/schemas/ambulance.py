from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class AmbulanceProfileResponse(BaseModel):
    id: int
    ambulance_id: str
    driver_name: str
    driver_phone: str
    ambulance_registration_number: str
    email: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None


class AmbulanceLocationUpdate(BaseModel):
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)


class AmbulanceRequestCreate(BaseModel):
    latitude: float
    longitude: float
    blood_group: str
    oxygen_level: float = Field(ge=0, le=100)
    patient_condition_notes: str
    severity_level: str
    required_specialty: Optional[str] = None


class AmbulanceRequestResponse(BaseModel):
    id: int
    ambulance_id: int
    latitude: float
    longitude: float
    blood_group: str
    oxygen_level: float
    patient_condition_notes: str
    severity: str
    required_specialty: Optional[str]
    timestamp: datetime
