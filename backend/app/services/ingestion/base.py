from abc import ABC, abstractmethod
from pathlib import Path

from app.services.ingestion.types import DetectedFile, NormalizedExtraction


class Extractor(ABC):
    kind: str

    @abstractmethod
    def extract(self, path: Path, detected: DetectedFile, *, row_limit: int, text_limit: int) -> NormalizedExtraction:
        raise NotImplementedError
