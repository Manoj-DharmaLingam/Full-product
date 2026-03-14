from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from core.database import get_db
from core.security import require_role
from database import crud
from database.schemas import HospitalAlertsQueryResponse, HospitalDashboardResponse, HospitalLocationUpdate, HospitalPublicResponse, ICUUpdateRequest, DoctorCreate, DoctorUpdate, DoctorResponse
from modules.routing.service import invalidate_hospital_cache

router = APIRouter(tags=["hospital"])


@router.get("/public/hospitals", response_model=list[HospitalPublicResponse])
async def get_public_hospitals(db: Session = Depends(get_db)):
    hospitals = crud.list_public_hospitals(db)
    return [HospitalPublicResponse(**crud.hospital_to_dict(h)) for h in hospitals]


@router.get("/public/hospitals/{hospital_id}/doctors", response_model=list[DoctorResponse])
async def get_public_hospital_doctors(hospital_id: int, db: Session = Depends(get_db)):
    return crud.list_public_doctors(db, hospital_id)


@router.get("/hospital/me", response_model=HospitalDashboardResponse)
async def get_hospital_me(
    db: Session = Depends(get_db),
    user=Depends(require_role("hospital")),
):
    hospital = crud.get_hospital_by_user(db, user)
    return HospitalDashboardResponse(**crud.hospital_to_dict(hospital))


@router.post("/hospital/update-icu", response_model=HospitalDashboardResponse)
async def update_hospital_icu(
    payload: ICUUpdateRequest,
    db: Session = Depends(get_db),
    user=Depends(require_role("hospital")),
):
    hospital = crud.get_hospital_by_user(db, user)
    updated = crud.update_hospital_icu(db, hospital, payload.mode.lower(), payload.count)
    invalidate_hospital_cache()
    return HospitalDashboardResponse(**crud.hospital_to_dict(updated))


@router.post("/hospital/update-location", response_model=HospitalDashboardResponse)
async def update_hospital_location(
    payload: HospitalLocationUpdate,
    db: Session = Depends(get_db),
    user=Depends(require_role("hospital")),
):
    hospital = crud.get_hospital_by_user(db, user)
    updated = crud.update_hospital_location(db, hospital, payload.latitude, payload.longitude)
    invalidate_hospital_cache()
    return HospitalDashboardResponse(**crud.hospital_to_dict(updated))


@router.get("/hospital/alerts", response_model=list[HospitalAlertsQueryResponse])
async def get_hospital_alerts(
    db: Session = Depends(get_db),
    user=Depends(require_role("hospital")),
):
    hospital = crud.get_hospital_by_user(db, user)
    return crud.list_hospital_alerts(db, hospital)


@router.get("/hospital/doctors", response_model=list[DoctorResponse])
async def get_hospital_doctors(
    db: Session = Depends(get_db),
    user=Depends(require_role("hospital")),
):
    hospital = crud.get_hospital_by_user(db, user)
    return crud.list_hospital_doctors(db, hospital)


@router.post("/hospital/doctors", response_model=DoctorResponse, status_code=201)
async def add_hospital_doctor(
    payload: DoctorCreate,
    db: Session = Depends(get_db),
    user=Depends(require_role("hospital")),
):
    hospital = crud.get_hospital_by_user(db, user)
    return crud.create_doctor(db, hospital, payload)


@router.put("/hospital/doctors/{doctor_id}", response_model=DoctorResponse)
async def edit_hospital_doctor(
    doctor_id: int,
    payload: DoctorUpdate,
    db: Session = Depends(get_db),
    user=Depends(require_role("hospital")),
):
    hospital = crud.get_hospital_by_user(db, user)
    doctor = crud.get_doctor_by_id(db, doctor_id, hospital)
    return crud.update_doctor(db, doctor, payload)


@router.delete("/hospital/doctors/{doctor_id}", status_code=204)
async def remove_hospital_doctor(
    doctor_id: int,
    db: Session = Depends(get_db),
    user=Depends(require_role("hospital")),
):
    hospital = crud.get_hospital_by_user(db, user)
    doctor = crud.get_doctor_by_id(db, doctor_id, hospital)
    crud.delete_doctor(db, doctor)
