from datetime import datetime, timezone

from sqlalchemy.orm import Session

from database.models import Alert, Hospital


def parse_specialties(raw_specialties: str) -> list[str]:
    return [value.strip() for value in (raw_specialties or "").split(",") if value.strip()]


def format_specialties(values: list[str]) -> str:
    return ",".join(sorted({value.strip().lower() for value in values if value.strip()}))


def cleanup_expired_reservations(db: Session) -> None:
    now = datetime.now(timezone.utc)
    expired = (
        db.query(Alert)
        .filter(Alert.status == "reserved", Alert.reserved_until < now)
        .all()
    )
    if not expired:
        return

    hospital_map: dict[int, int] = {}
    for alert in expired:
        alert.status = "expired"
        hospital_map[alert.hospital_id] = hospital_map.get(alert.hospital_id, 0) + 1

    hospitals = db.query(Hospital).filter(Hospital.id.in_(hospital_map.keys())).all()
    for hospital in hospitals:
        restore_count = hospital_map[hospital.id]
        hospital.available_icu_beds = min(hospital.total_icu_beds, hospital.available_icu_beds + restore_count)

    db.commit()
