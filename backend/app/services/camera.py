import os
import threading
import time
from datetime import datetime
from pathlib import Path

import cv2
from sqlalchemy.orm import Session

from ..database import SessionLocal
from ..models import Camera, VehicleEvent
from ..models import local_now
from .plate_reader import PlateReader

SNAPSHOT_DIR = Path("snapshots")
SNAPSHOT_DIR.mkdir(exist_ok=True)


class CameraWorkerRegistry:
    def __init__(self):
        self._threads: dict[int, threading.Thread] = {}
        self._stop_flags: dict[int, threading.Event] = {}
        self._plate_reader = PlateReader()

    def start(self, camera: Camera) -> None:
        if camera.id in self._threads and self._threads[camera.id].is_alive():
            return

        stop_flag = threading.Event()
        thread = threading.Thread(target=self._run_camera, args=(camera.id, stop_flag), daemon=True)
        self._stop_flags[camera.id] = stop_flag
        self._threads[camera.id] = thread
        thread.start()

    def stop(self, camera_id: int) -> None:
        if camera_id in self._stop_flags:
            self._stop_flags[camera_id].set()

    def capture_snapshot(self, camera: Camera) -> tuple[str, object] | None:
        source = self._camera_source(camera.stream_url)
        capture = cv2.VideoCapture(source)

        try:
            # Give webcams a short warm-up so the returned frame is not blank.
            frame = None
            for _ in range(10):
                ok, candidate = capture.read()
                if ok:
                    frame = candidate
                    break
                time.sleep(0.2)

            if frame is None:
                return None

            snapshot_path = self._save_snapshot(camera.id, frame)
            result = self._plate_reader.read(frame)
            return snapshot_path, result
        finally:
            capture.release()

    def _run_camera(self, camera_id: int, stop_flag: threading.Event) -> None:
        db = SessionLocal()
        try:
            camera = db.get(Camera, camera_id)
            if camera is None:
                return

            camera.status = "active"
            db.commit()
            self._capture_loop(db, camera, stop_flag)
        finally:
            camera = db.get(Camera, camera_id)
            if camera is not None:
                camera.status = "inactive"
                db.commit()
            db.close()

    def _capture_loop(self, db: Session, camera: Camera, stop_flag: threading.Event) -> None:
        source = self._camera_source(camera.stream_url)
        capture = cv2.VideoCapture(source)
        last_event_at = 0.0

        try:
            while not stop_flag.is_set():
                ok, frame = capture.read()
                if not ok:
                    time.sleep(2)
                    capture.release()
                    capture = cv2.VideoCapture(source)
                    continue

                now = time.time()
                if now - last_event_at < 8:
                    continue

                result = self._plate_reader.read(frame)
                snapshot_path = self._save_snapshot(camera.id, frame)

                event = VehicleEvent(
                    camera_id=camera.id,
                    camera_name=camera.name,
                    direction=camera.direction,
                    plate_number=result.plate_number,
                    confidence=result.confidence,
                    snapshot_path=snapshot_path,
                )
                db.add(event)
                db.commit()
                last_event_at = now
        finally:
            capture.release()

    def _save_snapshot(self, camera_id: int, frame) -> str:
        filename = f"camera-{camera_id}-{local_now().strftime('%Y%m%d%H%M%S')}.jpg"
        path = SNAPSHOT_DIR / filename
        cv2.imwrite(os.fspath(path), frame)
        return os.fspath(path)

    def _camera_source(self, stream_url: str) -> str | int:
        cleaned = stream_url.strip()
        if cleaned.isdigit():
            return int(cleaned)
        return cleaned


worker_registry = CameraWorkerRegistry()
