from fastapi import HTTPException
from sqlalchemy.orm import Session

from database.models import Ambulance, AmbulanceRequest, User


def get_ambulance_by_user(db: Session, user: User) -> Ambulance:
    ambulance = db.query(Ambulance).filter(Ambulance.user_id == user.id).first()
    if not ambulance:
        raise HTTPException(status_code=404, detail="Ambulance profile not found")
    return ambulance


def update_ambulance_location(db: Session, ambulance: Ambulance, latitude: float, longitude: float) -> Ambulance:
    ambulance.latitude = latitude
    ambulance.longitude = longitude
    db.commit()
    db.refresh(ambulance)
    return ambulance


def create_ambulance_request(
    db: Session,
    ambulance: Ambulance,
    latitude: float,
    longitude: float,
    blood_group: str,
    oxygen_level: float,
    patient_condition_notes: str,
    severity: str,
    required_specialty: str | None,
) -> AmbulanceRequest:
    normalized = severity.capitalize()
    if normalized not in {"Critical", "Serious", "Moderate"}:
        raise HTTPException(status_code=400, detail="severity_level must be Critical, Serious, or Moderate")

    request = AmbulanceRequest(
        ambulance_id=ambulance.id,
        latitude=latitude,
        longitude=longitude,
        blood_group=blood_group,
        oxygen_level=oxygen_level,
        patient_condition_notes=patient_condition_notes,
        severity=normalized,
        required_specialty=required_specialty.lower() if required_specialty else None,
    )
    db.add(request)
    db.commit()
    db.refresh(request)
    return request
