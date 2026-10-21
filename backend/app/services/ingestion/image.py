from pathlib import Path

from PIL import Image, UnidentifiedImageError

from app.services.ingestion.base import Extractor
from app.services.ingestion.types import DetectedFile, NormalizedExtraction


class ImageExtractor(Extractor):
    kind = "image"

    def extract(self, path: Path, detected: DetectedFile, *, row_limit: int, text_limit: int) -> NormalizedExtraction:
        try:
            with Image.open(path) as image:
                metadata = {"format": image.format, "width": image.width, "height": image.height, "mode": image.mode, "ocr_status": "not_configured"}
        except (UnidentifiedImageError, OSError) as exc:
            raise ValueError("The uploaded image could not be decoded") from exc
        return NormalizedExtraction(detected_type="image", metadata=metadata, warnings=["OCR is not configured; image text and chart content were not extracted."], confidence=0.2)
