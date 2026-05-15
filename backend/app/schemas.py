from datetime import datetime

from pydantic import BaseModel, Field


class CameraCreate(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    stream_url: str = Field(min_length=1, max_length=500)
    direction: str = Field(pattern="^(entry|exit)$")


class CameraUpdate(CameraCreate):
    pass


class CameraOut(BaseModel):
    id: int
    name: str
    stream_url: str
    direction: str
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}


class VehicleEventOut(BaseModel):
    id: int
    camera_id: int
    camera_name: str
    direction: str
    plate_number: str
    confidence: int
    snapshot_path: str
    created_at: datetime

    model_config = {"from_attributes": True}


class SnapshotOut(BaseModel):
    camera_id: int
    camera_name: str
    snapshot_path: str
    plate_number: str
    confidence: int
    event_id: int | None = None
    created_at: datetime
