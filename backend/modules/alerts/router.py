from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from core.database import get_db
from core.security import require_role
from database import crud
from database.models import Alert
from database.schemas import AlertCreateRequest, AlertCreateResponse, AlertStatusUpdateRequest
from modules.routing.service import invalidate_hospital_cache

router = APIRouter(prefix="/alerts", tags=["alerts"])


@router.post("", response_model=AlertCreateResponse, status_code=201)
async def create_alert(
    payload: AlertCreateRequest,
    db: Session = Depends(get_db),
    user=Depends(require_role("ambulance")),
):
    crud.get_ambulance_by_user(db, user)
    alert = crud.create_alert_with_reservation(db, payload.hospital_id, payload.ambulance_request_id, payload.eta)
    invalidate_hospital_cache()
    return AlertCreateResponse(
        id=alert.id,
        hospital_id=alert.hospital_id,
        ambulance_request_id=alert.ambulance_request_id,
        status=alert.status,
        eta=alert.eta,
    )


@router.put("/{alert_id}/status", response_model=AlertCreateResponse)
async def update_status(
    alert_id: int,
    payload: AlertStatusUpdateRequest,
    db: Session = Depends(get_db),
    user=Depends(require_role("hospital")),
):
    hospital = crud.get_hospital_by_user(db, user)
    alert = db.query(Alert).filter(Alert.id == alert_id, Alert.hospital_id == hospital.id).first()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found for this hospital")
    updated = crud.update_alert_status(db, alert, payload.status)
    invalidate_hospital_cache()
    return AlertCreateResponse(
        id=updated.id,
        hospital_id=updated.hospital_id,
        ambulance_request_id=updated.ambulance_request_id,
        status=updated.status,
        eta=updated.eta,
    )
