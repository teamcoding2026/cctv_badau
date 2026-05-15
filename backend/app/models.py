from datetime import datetime

from sqlalchemy import DateTime, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from .database import Base


def local_now() -> datetime:
    return datetime.now()


class Camera(Base):
    __tablename__ = "cameras"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    stream_url: Mapped[str] = mapped_column(String(500), nullable=False)
    direction: Mapped[str] = mapped_column(String(20), nullable=False, default="entry")
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="inactive")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=local_now)


class VehicleEvent(Base):
    __tablename__ = "vehicle_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    camera_id: Mapped[int] = mapped_column(Integer, nullable=False)
    camera_name: Mapped[str] = mapped_column(String(120), nullable=False)
    direction: Mapped[str] = mapped_column(String(20), nullable=False)
    plate_number: Mapped[str] = mapped_column(String(30), nullable=False, default="UNKNOWN")
    confidence: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    snapshot_path: Mapped[str] = mapped_column(String(500), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=local_now, index=True)
