from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from core.database import get_db
from core.security import require_role
from database import crud
from database.models import Alert, AmbulanceRequest
from database.schemas import (
    AmbulanceProfileResponse,
    AmbulanceRequestCreate,
    AmbulanceRequestResponse,
    AmbulanceLocationUpdate,
    AlertCreateResponse,
    HospitalRecommendationResponse,
    IcuBookingRequest,
)
from modules.routing.service import recommend_hospitals_from_location

router = APIRouter(prefix="/ambulance", tags=["ambulance"])


@router.get("/me", response_model=AmbulanceProfileResponse)
async def get_ambulance_me(
    db: Session = Depends(get_db),
    user=Depends(require_role("ambulance")),
):
    ambulance = crud.get_ambulance_by_user(db, user)
    return AmbulanceProfileResponse(
        id=ambulance.id,
        ambulance_id=ambulance.ambulance_id,
        driver_name=ambulance.driver_name,
        driver_phone=ambulance.driver_phone,
        ambulance_registration_number=ambulance.ambulance_registration_number,
        email=user.email,
        latitude=ambulance.latitude,
        longitude=ambulance.longitude,
    )


@router.post("/update-location", response_model=AmbulanceProfileResponse)
async def update_ambulance_location(
    payload: AmbulanceLocationUpdate,
    db: Session = Depends(get_db),
    user=Depends(require_role("ambulance")),
):
    ambulance = crud.get_ambulance_by_user(db, user)
    updated = crud.update_ambulance_location(db, ambulance, payload.latitude, payload.longitude)
    return AmbulanceProfileResponse(
        id=updated.id,
        ambulance_id=updated.ambulance_id,
        driver_name=updated.driver_name,
        driver_phone=updated.driver_phone,
        ambulance_registration_number=updated.ambulance_registration_number,
        email=user.email,
        latitude=updated.latitude,
        longitude=updated.longitude,
    )


@router.post("/request", response_model=AmbulanceRequestResponse, status_code=201)
async def create_request(
    payload: AmbulanceRequestCreate,
    db: Session = Depends(get_db),
    user=Depends(require_role("ambulance")),
):
    ambulance = crud.get_ambulance_by_user(db, user)
    request = crud.create_ambulance_request(
        db,
        ambulance=ambulance,
        latitude=payload.latitude,
        longitude=payload.longitude,
        blood_group=payload.blood_group,
        oxygen_level=payload.oxygen_level,
        patient_condition_notes=payload.patient_condition_notes,
        severity=payload.severity_level,
        required_specialty=payload.required_specialty,
    )
    return AmbulanceRequestResponse(
        id=request.id,
        ambulance_id=request.ambulance_id,
        latitude=request.latitude,
        longitude=request.longitude,
        blood_group=request.blood_group,
        oxygen_level=request.oxygen_level,
        patient_condition_notes=request.patient_condition_notes,
        severity=request.severity,
        required_specialty=request.required_specialty,
        timestamp=request.timestamp,
    )


@router.get("/recommend-hospital", response_model=list[HospitalRecommendationResponse])
async def recommend(
    latitude: float = Query(),
    longitude: float = Query(),
    severity: str = Query(),
    required_specialty: str | None = Query(default=None),
    db: Session = Depends(get_db),
):
    normalized = severity.capitalize()
    if normalized not in {"Critical", "Serious", "Moderate"}:
        raise HTTPException(status_code=400, detail="severity must be Critical, Serious, or Moderate")
    ranked = await recommend_hospitals_from_location(db, latitude, longitude, normalized, required_specialty)
    return [HospitalRecommendationResponse(**row) for row in ranked]


@router.post("/book-icu", response_model=AlertCreateResponse)
async def book_icu_for_critical(
    payload: IcuBookingRequest,
    db: Session = Depends(get_db),
    user=Depends(require_role("ambulance")),
):
    request = db.query(AmbulanceRequest).filter(AmbulanceRequest.id == payload.ambulance_request_id).first()
    if not request:
        raise HTTPException(status_code=404, detail="Ambulance request not found")
    if request.severity != "Critical":
        raise HTTPException(status_code=400, detail="ICU auto-booking only applies to Critical patients")

    alert = (
        db.query(Alert)
        .filter(
            Alert.hospital_id == payload.hospital_id,
            Alert.ambulance_request_id == payload.ambulance_request_id,
            Alert.status == "reserved",
        )
        .first()
    )
    if not alert:
        raise HTTPException(status_code=404, detail="No active ICU reservation found for this request")

    alert.status = "acknowledged"
    db.commit()
    db.refresh(alert)
    return AlertCreateResponse(
        id=alert.id,
        hospital_id=alert.hospital_id,
        ambulance_request_id=alert.ambulance_request_id,
        status=alert.status,
        eta=alert.eta,
    )
