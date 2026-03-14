from datetime import datetime, timedelta, timezone

from fastapi import HTTPException
from sqlalchemy.orm import Session

from core.config import settings
from database.crud.common import cleanup_expired_reservations
from database.models import Alert, AmbulanceRequest, Hospital


def create_alert_with_reservation(db: Session, hospital_id: int, ambulance_request_id: int, eta: float) -> Alert:
    cleanup_expired_reservations(db)
    hospital = db.query(Hospital).filter(Hospital.id == hospital_id, Hospital.is_active.is_(True)).first()
    if not hospital:
        raise HTTPException(status_code=404, detail="Hospital not found")
    if hospital.available_icu_beds <= 0:
        raise HTTPException(status_code=409, detail="No ICU beds available for reservation")

    request = db.query(AmbulanceRequest).filter(AmbulanceRequest.id == ambulance_request_id).first()
    if not request:
        raise HTTPException(status_code=404, detail="Ambulance request not found")

    reserved_until = datetime.now(timezone.utc) + timedelta(minutes=settings.RESERVATION_TTL_MINUTES)
    hospital.available_icu_beds -= 1
    alert = Alert(
        hospital_id=hospital_id,
        ambulance_request_id=ambulance_request_id,
        status="reserved",
        eta=eta,
        reserved_until=reserved_until,
    )
    db.add(alert)
    db.commit()
    db.refresh(alert)
    return alert


def update_alert_status(db: Session, alert: Alert, status: str) -> Alert:
    normalized = status.lower()
    allowed = {"reserved", "acknowledged", "completed", "cancelled"}
    if normalized not in allowed:
        raise HTTPException(status_code=400, detail=f"Invalid status. Use one of: {', '.join(sorted(allowed))}")

    if normalized == "cancelled" and alert.status in {"reserved", "acknowledged"}:
        hospital = alert.hospital
        hospital.available_icu_beds = min(hospital.total_icu_beds, hospital.available_icu_beds + 1)

    alert.status = normalized
    db.commit()
    db.refresh(alert)
    return alert
