from app.services.ingestion.base import Extractor
from app.services.ingestion.csv import CsvExtractor
from app.services.ingestion.docx import DocxExtractor
from app.services.ingestion.excel import ExcelExtractor
from app.services.ingestion.image import ImageExtractor
from app.services.ingestion.pdf import PdfExtractor
from app.services.ingestion.pptx import PptxExtractor


class ExtractorRegistry:
    def __init__(self, extractors: list[Extractor]) -> None:
        self._extractors = {extractor.kind: extractor for extractor in extractors}

    def get(self, kind: str) -> Extractor:
        try:
            return self._extractors[kind]
        except KeyError as exc:
            raise ValueError("No extractor is configured for this file type") from exc

    def kinds(self) -> list[str]:
        return sorted(self._extractors)


extractor_registry = ExtractorRegistry([
    CsvExtractor(),
    ExcelExtractor(),
    PdfExtractor(),
    DocxExtractor(),
    PptxExtractor(),
    ImageExtractor(),
])
