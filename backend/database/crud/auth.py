from sqlalchemy.orm import Session

from core.security import hash_password, verify_password
from database.crud.common import format_specialties
from database.models import Ambulance, Hospital, User
from database.schemas import (
    AmbulanceLoginRequest,
    AmbulanceSignupRequest,
    HospitalLoginRequest,
    HospitalSignupRequest,
)


def create_hospital_user(db: Session, payload: HospitalSignupRequest) -> Hospital:
    user = User(role="hospital", email=payload.hospital_email, password_hash=hash_password(payload.password))
    hospital = Hospital(
        user=user,
        hospital_name=payload.hospital_name,
        contact_number=payload.contact_number,
        hospital_address=payload.hospital_address,
        latitude=payload.latitude,
        longitude=payload.longitude,
        specialties=format_specialties(payload.specialties),
        total_icu_beds=payload.total_icu_beds,
        available_icu_beds=payload.total_icu_beds,
    )
    db.add(hospital)
    db.commit()
    db.refresh(hospital)
    return hospital


def login_hospital_user(db: Session, payload: HospitalLoginRequest) -> User | None:
    hospital = db.query(Hospital).filter(Hospital.hospital_name == payload.hospital_name).first()
    if not hospital or not verify_password(payload.password, hospital.user.password_hash):
        return None
    return hospital.user


def create_ambulance_user(db: Session, payload: AmbulanceSignupRequest) -> Ambulance:
    user = User(role="ambulance", email=payload.email, password_hash=hash_password(payload.password))
    ambulance = Ambulance(
        user=user,
        ambulance_id=payload.ambulance_id,
        driver_name=payload.driver_name,
        driver_phone=payload.driver_phone,
        ambulance_registration_number=payload.ambulance_registration_number,
        latitude=payload.latitude,
        longitude=payload.longitude,
    )
    db.add(ambulance)
    db.commit()
    db.refresh(ambulance)
    return ambulance


def login_ambulance_user(db: Session, payload: AmbulanceLoginRequest) -> User | None:
    user = db.query(User).filter(User.email == payload.email, User.role == "ambulance").first()
    if not user or not verify_password(payload.password, user.password_hash):
        return None
    return user
