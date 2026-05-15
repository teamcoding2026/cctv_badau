# CCTV Vehicle Access Monitor

A starter full-stack application for monitoring office CCTV vehicle entry and exit events, reading license plate text, saving snapshots, and recording events in a database.

## Recommended Stack

- Backend: Python + FastAPI
- Computer vision: OpenCV, Ultralytics YOLO, EasyOCR/PaddleOCR integration point
- Database: SQLite for development, PostgreSQL for production
- Frontend: React + TypeScript + Vite

Python is the best fit for the CCTV/ANPR part because most vehicle detection, image processing, and OCR libraries are strongest there. React keeps the dashboard fast and easy to maintain in Visual Studio Code.

## Project Structure

```text
backend/
  app/
    main.py
    database.py
    models.py
    schemas.py
    services/
      camera.py
      plate_reader.py
frontend/
  src/
    App.tsx
    api.ts
    main.tsx
```

## Run Backend

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

## Run Frontend

The ready-to-run dashboard is in `frontend-static/` and is served by the backend at:

```text
http://127.0.0.1:8000
```

The `frontend/` folder contains a React + TypeScript version for future development if you install Node.js/npm locally.

## CCTV Notes

Most CCTV/NVR devices expose an RTSP stream. Example:

```text
rtsp://username:password@192.168.1.50:554/stream1
```

Use the backend `POST /api/cameras` endpoint to register the stream URL. The starter worker currently creates event records from sampled frames and includes a placeholder plate reader. Replace the placeholder logic in `backend/app/services/plate_reader.py` with your preferred OCR model when you are ready to connect a real camera.

## Privacy And Operations

License plate data can be sensitive. Limit access to the dashboard, use strong CCTV credentials, keep the server on a trusted network, and set a data retention policy for snapshots and vehicle logs.
