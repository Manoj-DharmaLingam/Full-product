import math
from time import monotonic

from sqlalchemy.orm import Session

from core.config import settings
from database.crud.common import cleanup_expired_reservations, parse_specialties
from database.models import Hospital

_HOSPITAL_COORD_CACHE: dict[str, object] = {"timestamp": 0.0, "items": []}
_CACHE_TTL_SECONDS = 30.0


def invalidate_hospital_cache() -> None:
    _HOSPITAL_COORD_CACHE["timestamp"] = 0.0
    _HOSPITAL_COORD_CACHE["items"] = []


def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    radius = 6371.0
    d_lat = math.radians(lat2 - lat1)
    d_lon = math.radians(lon2 - lon1)
    a = (
        math.sin(d_lat / 2) ** 2
        + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(d_lon / 2) ** 2
    )
    return 2 * radius * math.asin(math.sqrt(a))


async def _eta_minutes_with_fallback(origin_lat: float, origin_lng: float, hospital: Hospital) -> tuple[float, float]:
    distance_km = _haversine_km(origin_lat, origin_lng, hospital.latitude, hospital.longitude)
    speed_kmh = max(settings.AMBULANCE_AVERAGE_SPEED_KMH, 1.0)
    eta_minutes = max((distance_km / speed_kmh) * 60.0, 1.0)
    return eta_minutes, distance_km


def _get_candidate_hospitals(db: Session) -> list[Hospital]:
    now = monotonic()
    if now - float(_HOSPITAL_COORD_CACHE["timestamp"]) < _CACHE_TTL_SECONDS:
        return _HOSPITAL_COORD_CACHE["items"]  # type: ignore[return-value]

    hospitals = db.query(Hospital).filter(Hospital.is_active.is_(True), Hospital.available_icu_beds > 0).all()
    _HOSPITAL_COORD_CACHE["timestamp"] = now
    _HOSPITAL_COORD_CACHE["items"] = hospitals
    return hospitals


async def recommend_hospitals_from_location(
    db: Session,
    latitude: float,
    longitude: float,
    severity: str,
    required_specialty: str | None = None,
) -> list[dict]:
    cleanup_expired_reservations(db)
    hospitals = _get_candidate_hospitals(db)
    normalized_specialty = required_specialty.lower() if required_specialty else None

    ranked: list[dict] = []
    for hospital in hospitals:
        eta_minutes, distance_km = await _eta_minutes_with_fallback(latitude, longitude, hospital)

        if distance_km > settings.MAX_REASONABLE_DISTANCE_KM:
            continue

        hospital_specialties = parse_specialties(hospital.specialties)
        specialty_score = 1 if normalized_specialty and normalized_specialty in hospital_specialties else 0
        bed_score = min(hospital.available_icu_beds / max(settings.OPTIMAL_ICU_BEDS, 1), 1.0)
        ranked.append(
            {
                "hospital_id": hospital.id,
                "hospital_name": hospital.hospital_name,
                "latitude": hospital.latitude,
                "longitude": hospital.longitude,
                "hospital_address": hospital.hospital_address,
                "available_icu_beds": hospital.available_icu_beds,
                "total_icu_beds": hospital.total_icu_beds,
                "eta_minutes": round(eta_minutes, 2),
                "distance_km": round(distance_km, 2),
                "specialty_match": specialty_score,
                "score": round(max(0.0, (1.0 / (1.0 + distance_km)) * (1.0 + bed_score * 0.2)), 6),
                "_distance_sort": distance_km,
            }
        )

    ranked.sort(
        key=lambda row: (
            row["_distance_sort"],
            -row["available_icu_beds"],
            -row["specialty_match"],
            row["hospital_name"].lower(),
        )
    )
    for row in ranked:
        row.pop("_distance_sort", None)
    return ranked[: settings.RECOMMEND_TOP_N]
