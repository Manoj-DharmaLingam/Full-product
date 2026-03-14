from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class HospitalPublicResponse(BaseModel):
    id: int
    hospital_name: str
    hospital_address: str
    latitude: float
    longitude: float
    total_icu_beds: int
    available_icu_beds: int
    specialties: list[str]


class HospitalDashboardResponse(HospitalPublicResponse):
    contact_number: str
    email: str
    created_at: datetime


class ICUUpdateRequest(BaseModel):
    mode: str = Field(description="set/add/remove/occupy/release")
    count: int = Field(default=1, ge=0)


class HospitalLocationUpdate(BaseModel):
    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)


class HospitalAlertsQueryResponse(BaseModel):
    id: int
    ambulance_request_id: int
    status: str
    eta: float
    reserved_until: datetime
    severity: str
    blood_group: str
    oxygen_level: float
    patient_condition_notes: str
    ambulance_latitude: float
    ambulance_longitude: float
    created_at: datetime


class DoctorCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    specialty: str = Field(min_length=1, max_length=255)
    qualification: str = Field(default="")
    experience_years: int = Field(default=0, ge=0)
    availability: str = Field(default="", max_length=255)
    is_available: bool = Field(default=True)


class DoctorUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    specialty: Optional[str] = Field(default=None, min_length=1, max_length=255)
    qualification: Optional[str] = None
    experience_years: Optional[int] = Field(default=None, ge=0)
    availability: Optional[str] = Field(default=None, max_length=255)
    is_available: Optional[bool] = None


class DoctorResponse(BaseModel):
    id: int
    hospital_id: int
    name: str
    specialty: str
    qualification: str
    experience_years: int
    availability: str
    is_available: bool
    created_at: datetime
