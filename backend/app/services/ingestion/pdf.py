from pathlib import Path

import fitz

from app.services.ingestion.base import Extractor
from app.services.ingestion.types import DetectedFile, NormalizedExtraction, TextBlock


class PdfExtractor(Extractor):
    kind = "pdf"

    def extract(self, path: Path, detected: DetectedFile, *, row_limit: int, text_limit: int) -> NormalizedExtraction:
        blocks: list[TextBlock] = []
        warnings: list[str] = []
        with fitz.open(path) as document:
            for page_number, page in enumerate(document, start=1):
                text = page.get_text("text").strip()
                if text:
                    blocks.append(TextBlock(location=f"page {page_number}", text=text[:text_limit]))
                else:
                    warnings.append(f"Page {page_number} contains no extractable text; OCR may be required.")
            metadata = {key: value for key, value in (document.metadata or {}).items() if value}
            page_count = len(document)
        return NormalizedExtraction(detected_type="pdf", text_blocks=blocks, metadata={"page_count": page_count, "document": metadata, "table_count": 0}, warnings=warnings + ["PDF table extraction is not enabled; text extraction only."] if page_count else warnings, confidence=0.8 if blocks else 0.2)
