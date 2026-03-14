from pydantic import BaseModel


class AlertCreateRequest(BaseModel):
    hospital_id: int
    ambulance_request_id: int
    eta: float


class AlertStatusUpdateRequest(BaseModel):
    status: str


class AlertCreateResponse(BaseModel):
    id: int
    hospital_id: int
    ambulance_request_id: int
    status: str
    eta: float


class IcuBookingRequest(BaseModel):
    hospital_id: int
    ambulance_request_id: int
