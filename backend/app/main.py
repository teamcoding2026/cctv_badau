import csv
import io
from pathlib import Path

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import desc
from sqlalchemy.orm import Session

from .database import Base, engine, get_db
from .models import Camera, VehicleEvent, local_now
from .schemas import CameraCreate, CameraOut, SnapshotOut, VehicleEventOut
from .services.camera import SNAPSHOT_DIR, worker_registry

Base.metadata.create_all(bind=engine)
FRONTEND_DIR = Path(__file__).resolve().parents[2] / "frontend-static"

app = FastAPI(title="CCTV Vehicle Access Monitor")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/snapshots", StaticFiles(directory=SNAPSHOT_DIR), name="snapshots")


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/api/cameras", response_model=list[CameraOut])
def list_cameras(db: Session = Depends(get_db)):
    return db.query(Camera).order_by(Camera.id.desc()).all()


@app.post("/api/cameras", response_model=CameraOut)
def create_camera(payload: CameraCreate, db: Session = Depends(get_db)):
    camera = Camera(**payload.model_dump())
    db.add(camera)
    db.commit()
    db.refresh(camera)
    return camera


@app.post("/api/cameras/{camera_id}/start", response_model=CameraOut)
def start_camera(camera_id: int, db: Session = Depends(get_db)):
    camera = db.get(Camera, camera_id)
    if camera is None:
        raise HTTPException(status_code=404, detail="Camera not found")
    worker_registry.start(camera)
    db.refresh(camera)
    return camera


@app.post("/api/cameras/{camera_id}/stop", response_model=CameraOut)
def stop_camera(camera_id: int, db: Session = Depends(get_db)):
    camera = db.get(Camera, camera_id)
    if camera is None:
        raise HTTPException(status_code=404, detail="Camera not found")
    worker_registry.stop(camera_id)
    return camera


@app.post("/api/cameras/{camera_id}/snapshot", response_model=SnapshotOut)
def capture_camera_snapshot(camera_id: int, db: Session = Depends(get_db)):
    camera = db.get(Camera, camera_id)
    if camera is None:
        raise HTTPException(status_code=404, detail="Camera not found")

    snapshot_result = worker_registry.capture_snapshot(camera)
    if snapshot_result is None:
        raise HTTPException(status_code=422, detail="Camera tidak bisa dibaca. Cek index webcam atau RTSP URL.")

    snapshot_path, plate_result = snapshot_result
    event = VehicleEvent(
        camera_id=camera.id,
        camera_name=camera.name,
        direction=camera.direction,
        plate_number=plate_result.plate_number,
        confidence=plate_result.confidence,
        snapshot_path=snapshot_path,
    )
    db.add(event)
    db.commit()
    db.refresh(event)

    return SnapshotOut(
        camera_id=camera.id,
        camera_name=camera.name,
        snapshot_path=snapshot_path,
        plate_number=event.plate_number,
        confidence=event.confidence,
        event_id=event.id,
        created_at=local_now(),
    )


@app.get("/api/events", response_model=list[VehicleEventOut])
def list_events(limit: int = 50, db: Session = Depends(get_db)):
    return db.query(VehicleEvent).order_by(desc(VehicleEvent.created_at)).limit(limit).all()


@app.get("/api/events/export.csv")
def export_events(db: Session = Depends(get_db)):
    events = db.query(VehicleEvent).order_by(desc(VehicleEvent.created_at)).all()
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Waktu", "Nama CCTV", "Arah", "Nomor Polisi", "Confidence", "Foto"])

    for event in events:
        writer.writerow(
            [
                event.created_at.strftime("%Y-%m-%d %H:%M:%S"),
                event.camera_name,
                "Masuk" if event.direction == "entry" else "Keluar",
                event.plate_number,
                event.confidence,
                event.snapshot_path,
            ]
        )

    output.seek(0)
    filename = "log-kendaraan-cctv.csv"
    headers = {"Content-Disposition": f'attachment; filename="{filename}"'}
    return StreamingResponse(iter([output.getvalue()]), media_type="text/csv", headers=headers)


app.mount("/", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")
