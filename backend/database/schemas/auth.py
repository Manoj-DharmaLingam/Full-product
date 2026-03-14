from pydantic import BaseModel, EmailStr, Field
from typing import Optional


class HospitalSignupRequest(BaseModel):
    hospital_name: str
    hospital_email: EmailStr
    password: str = Field(min_length=6)
    contact_number: str
    latitude: float
    longitude: float
    hospital_address: str
    specialties: list[str]
    total_icu_beds: int = Field(ge=0)


class HospitalLoginRequest(BaseModel):
    hospital_name: str
    password: str


class AmbulanceSignupRequest(BaseModel):
    ambulance_id: str
    driver_name: str
    driver_phone: str
    ambulance_registration_number: str
    email: EmailStr
    password: str = Field(min_length=6)
    latitude: Optional[float] = None
    longitude: Optional[float] = None


class AmbulanceLoginRequest(BaseModel):
    email: EmailStr
    password: str


class AuthTokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
