import re
from dataclasses import dataclass

import cv2


@dataclass
class PlateReadResult:
    plate_number: str
    confidence: int


class PlateReader:
    """Integration point for a real ANPR/OCR model.

    Production options:
    - vehicle/plate detection: Ultralytics YOLO model trained for Indonesian plates
    - OCR: PaddleOCR or EasyOCR
    """

    def __init__(self):
        self._reader = None

    def read(self, frame) -> PlateReadResult:
        try:
            reader = self._get_reader()
            candidates = self._candidate_images(frame)
            best = PlateReadResult(plate_number="UNKNOWN", confidence=0)

            for candidate in candidates:
                results = reader.readtext(
                    candidate,
                    allowlist="ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 ",
                    detail=1,
                    paragraph=False,
                )
                combined_text = "".join(normalize_plate(str(result[1])) for result in results)
                combined_confidence = self._average_confidence(results)
                combined_plate = self._find_plate(combined_text)
                if combined_plate and combined_confidence > best.confidence:
                    best = PlateReadResult(
                        plate_number=format_plate(combined_plate),
                        confidence=combined_confidence,
                    )

                for _, text, confidence in results:
                    plate = normalize_plate(text)
                    score = int(confidence * 100)
                    found_plate = self._find_plate(plate)
                    if found_plate and score > best.confidence:
                        best = PlateReadResult(plate_number=format_plate(found_plate), confidence=score)

            return best
        except Exception:
            return PlateReadResult(plate_number="UNKNOWN", confidence=0)

    def _get_reader(self):
        if self._reader is None:
            import easyocr

            self._reader = easyocr.Reader(["en"], gpu=False, verbose=False)
        return self._reader

    def _candidate_images(self, frame):
        height, width = frame.shape[:2]
        crops = [
            frame,
            frame[int(height * 0.35) : int(height * 0.85), :],
            frame[int(height * 0.45) : height, int(width * 0.15) : int(width * 0.85)],
        ]

        prepared = []
        for crop in crops:
            gray = cv2.cvtColor(crop, cv2.COLOR_BGR2GRAY)
            gray = cv2.bilateralFilter(gray, 9, 75, 75)
            prepared.append(gray)
            prepared.append(cv2.resize(gray, None, fx=1.8, fy=1.8, interpolation=cv2.INTER_CUBIC))
        return prepared

    def _looks_like_plate(self, plate: str) -> bool:
        return self._find_plate(plate) is not None

    def _find_plate(self, text: str) -> str | None:
        cleaned = normalize_plate(text)
        candidates = [cleaned]
        if cleaned and cleaned[0] == "8":
            candidates.append(f"B{cleaned[1:]}")

        for candidate in candidates:
            match = re.search(r"[A-Z]{1,2}\d{1,4}[A-Z]{1,3}", candidate)
            if match:
                return match.group(0)
        return None

    def _average_confidence(self, results) -> int:
        confidences = [float(result[2]) for result in results if len(normalize_plate(str(result[1]))) > 0]
        if not confidences:
            return 0
        return int((sum(confidences) / len(confidences)) * 100)


def normalize_plate(text: str) -> str:
    cleaned = re.sub(r"[^A-Z0-9]", "", text.upper())
    return cleaned or "UNKNOWN"


def format_plate(plate: str) -> str:
    match = re.match(r"^([A-Z]{1,2})(\d{1,4})([A-Z]{0,3})$", plate)
    if not match:
        return plate

    parts = [match.group(1), match.group(2), match.group(3)]
    return " ".join(part for part in parts if part)
