from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from core.database import get_db
from core.security import create_access_token
from database import crud
from database.schemas import (
    AuthTokenResponse,
    AmbulanceLoginRequest,
    AmbulanceSignupRequest,
    HospitalLoginRequest,
    HospitalSignupRequest,
)

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/hospital/signup", response_model=AuthTokenResponse, status_code=201)
async def hospital_signup(payload: HospitalSignupRequest, db: Session = Depends(get_db)):
    try:
        hospital = crud.create_hospital_user(db, payload)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Hospital name or email already exists")
    token = create_access_token(hospital.user.id, "hospital")
    return AuthTokenResponse(access_token=token, role="hospital")


@router.post("/hospital/login", response_model=AuthTokenResponse)
async def hospital_login(payload: HospitalLoginRequest, db: Session = Depends(get_db)):
    user = crud.login_hospital_user(db, payload)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid hospital credentials")
    token = create_access_token(user.id, "hospital")
    return AuthTokenResponse(access_token=token, role="hospital")


@router.post("/ambulance/signup", response_model=AuthTokenResponse, status_code=201)
async def ambulance_signup(payload: AmbulanceSignupRequest, db: Session = Depends(get_db)):
    try:
        ambulance = crud.create_ambulance_user(db, payload)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Ambulance, registration number, or email already exists")
    token = create_access_token(ambulance.user.id, "ambulance")
    return AuthTokenResponse(access_token=token, role="ambulance")


@router.post("/ambulance/login", response_model=AuthTokenResponse)
async def ambulance_login(payload: AmbulanceLoginRequest, db: Session = Depends(get_db)):
    user = crud.login_ambulance_user(db, payload)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid ambulance credentials")
    token = create_access_token(user.id, "ambulance")
    return AuthTokenResponse(access_token=token, role="ambulance")
