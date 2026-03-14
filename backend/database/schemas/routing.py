from pydantic import BaseModel


class HospitalRecommendationResponse(BaseModel):
    hospital_id: int
    hospital_name: str
    latitude: float
    longitude: float
    hospital_address: str
    available_icu_beds: int
    total_icu_beds: int
    eta_minutes: float
    distance_km: float
    specialty_match: int
    score: float
