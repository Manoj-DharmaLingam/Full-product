from fastapi import HTTPException
from sqlalchemy.orm import Session

from core.config import settings
from database.crud.common import cleanup_expired_reservations, parse_specialties
from database.models import Alert, Hospital, User
from database.models.doctor import Doctor
from database.schemas.hospital import DoctorCreate, DoctorUpdate, HospitalAlertsQueryResponse


def get_hospital_by_user(db: Session, user: User) -> Hospital:
    hospital = db.query(Hospital).filter(Hospital.user_id == user.id).first()
    if not hospital:
        raise HTTPException(status_code=404, detail="Hospital profile not found")
    return hospital


def update_hospital_icu(db: Session, hospital: Hospital, mode: str, count: int) -> Hospital:
    if mode == "set":
        if count > hospital.total_icu_beds:
            raise HTTPException(status_code=400, detail="Count cannot exceed total ICU beds")
        hospital.available_icu_beds = count
    elif mode == "add":
        hospital.total_icu_beds += count
        hospital.available_icu_beds += count
    elif mode == "remove":
        occupied = hospital.total_icu_beds - hospital.available_icu_beds
        if count > hospital.available_icu_beds or (hospital.total_icu_beds - count) < occupied:
            raise HTTPException(status_code=400, detail="Cannot remove beds below occupied or available counts")
        hospital.total_icu_beds -= count
        hospital.available_icu_beds -= count
    elif mode == "occupy":
        if count > hospital.available_icu_beds:
            raise HTTPException(status_code=400, detail="Not enough available ICU beds")
        hospital.available_icu_beds -= count
    elif mode == "release":
        hospital.available_icu_beds = min(hospital.total_icu_beds, hospital.available_icu_beds + count)
    else:
        raise HTTPException(status_code=400, detail="Invalid mode. Use set/add/remove/occupy/release")

    db.commit()
    db.refresh(hospital)
    return hospital


def update_hospital_location(db: Session, hospital: Hospital, latitude: float, longitude: float) -> Hospital:
    hospital.latitude = latitude
    hospital.longitude = longitude
    db.commit()
    db.refresh(hospital)
    return hospital


def list_public_hospitals(db: Session) -> list[Hospital]:
    cleanup_expired_reservations(db)
    return db.query(Hospital).filter(Hospital.is_active.is_(True)).order_by(Hospital.hospital_name.asc()).all()


def list_hospital_alerts(db: Session, hospital: Hospital) -> list[HospitalAlertsQueryResponse]:
    cleanup_expired_reservations(db)
    alerts = (
        db.query(Alert)
        .filter(Alert.hospital_id == hospital.id)
        .order_by(Alert.created_at.desc())
        .limit(settings.ALERTS_QUERY_LIMIT)
        .all()
    )
    rows: list[HospitalAlertsQueryResponse] = []
    for alert in alerts:
        request = alert.ambulance_request
        rows.append(
            HospitalAlertsQueryResponse(
                id=alert.id,
                ambulance_request_id=alert.ambulance_request_id,
                status=alert.status,
                eta=alert.eta,
                reserved_until=alert.reserved_until,
                severity=request.severity,
                blood_group=request.blood_group,
                oxygen_level=request.oxygen_level,
                patient_condition_notes=request.patient_condition_notes,
                ambulance_latitude=request.latitude,
                ambulance_longitude=request.longitude,
                created_at=alert.created_at,
            )
        )
    return rows


def hospital_to_dict(hospital: Hospital) -> dict:
    return {
        "id": hospital.id,
        "hospital_name": hospital.hospital_name,
        "hospital_address": hospital.hospital_address,
        "latitude": hospital.latitude,
        "longitude": hospital.longitude,
        "total_icu_beds": hospital.total_icu_beds,
        "available_icu_beds": hospital.available_icu_beds,
        "specialties": parse_specialties(hospital.specialties),
        "contact_number": hospital.contact_number,
        "email": hospital.user.email,
        "created_at": hospital.created_at,
    }


# ─── Doctor CRUD ──────────────────────────────────────────────────────────────


def list_hospital_doctors(db: Session, hospital: Hospital) -> list[Doctor]:
    return db.query(Doctor).filter(Doctor.hospital_id == hospital.id).order_by(Doctor.created_at.asc()).all()


def list_public_doctors(db: Session, hospital_id: int) -> list[Doctor]:
    return db.query(Doctor).filter(Doctor.hospital_id == hospital_id).order_by(Doctor.created_at.asc()).all()


def get_doctor_by_id(db: Session, doctor_id: int, hospital: Hospital) -> Doctor:
    doctor = db.query(Doctor).filter(Doctor.id == doctor_id, Doctor.hospital_id == hospital.id).first()
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor not found")
    return doctor


def create_doctor(db: Session, hospital: Hospital, data: DoctorCreate) -> Doctor:
    doctor = Doctor(
        hospital_id=hospital.id,
        name=data.name,
        specialty=data.specialty,
        qualification=data.qualification,
        experience_years=data.experience_years,
        availability=data.availability,
        is_available=data.is_available,
    )
    db.add(doctor)
    db.commit()
    db.refresh(doctor)
    return doctor


def update_doctor(db: Session, doctor: Doctor, data: DoctorUpdate) -> Doctor:
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(doctor, field, value)
    db.commit()
    db.refresh(doctor)
    return doctor


def delete_doctor(db: Session, doctor: Doctor) -> None:
    db.delete(doctor)
    db.commit()
