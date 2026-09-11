from pathlib import Path
from zipfile import BadZipFile, ZipFile

from app.services.ingestion.types import DetectedFile

SUPPORTED_EXTENSIONS = {
    ".csv": ("csv", "text/csv"),
    ".xlsx": ("xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
    ".pdf": ("pdf", "application/pdf"),
    ".docx": ("docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
    ".pptx": ("pptx", "application/vnd.openxmlformats-officedocument.presentationml.presentation"),
    ".png": ("image", "image/png"),
    ".jpg": ("image", "image/jpeg"),
    ".jpeg": ("image", "image/jpeg"),
    ".webp": ("image", "image/webp"),
}

MIME_ALIASES = {
    "csv": {"text/csv", "text/plain", "application/csv"},
    "xlsx": {"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/zip"},
    "pdf": {"application/pdf"},
    "docx": {"application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/zip"},
    "pptx": {"application/vnd.openxmlformats-officedocument.presentationml.presentation", "application/zip"},
    "image": {"image/png", "image/jpeg", "image/webp"},
}


def _zip_kind(path: Path) -> str | None:
    try:
        with ZipFile(path) as archive:
            names = set(archive.namelist())
    except BadZipFile as exc:
        raise ValueError("The uploaded Office file is malformed") from exc
    if "xl/workbook.xml" in names:
        return "xlsx"
    if "word/document.xml" in names:
        return "docx"
    if "ppt/presentation.xml" in names:
        return "pptx"
    return None


def detect_file(path: Path, filename: str, declared_mime: str | None = None) -> DetectedFile:
    extension = Path(filename).suffix.lower()
    if extension not in SUPPORTED_EXTENSIONS:
        raise ValueError("Unsupported file type")
    kind, expected_mime = SUPPORTED_EXTENSIONS[extension]
    with path.open("rb") as source:
        header = source.read(16)
    actual_kind = kind
    if extension == ".pdf" and not header.startswith(b"%PDF-"):
        raise ValueError("The uploaded PDF signature is invalid")
    if extension in {".xlsx", ".docx", ".pptx"}:
        actual_kind = _zip_kind(path)
        if actual_kind != kind:
            raise ValueError("The uploaded Office file content does not match its extension")
    if extension == ".png" and not header.startswith(b"\x89PNG\r\n\x1a\n"):
        raise ValueError("The uploaded PNG signature is invalid")
    if extension in {".jpg", ".jpeg"} and not header.startswith(b"\xff\xd8\xff"):
        raise ValueError("The uploaded JPEG signature is invalid")
    if extension == ".webp" and not (header.startswith(b"RIFF") and header[8:12] == b"WEBP"):
        raise ValueError("The uploaded WEBP signature is invalid")
    if extension == ".csv":
        try:
            with path.open("r", encoding="utf-8-sig") as source:
                source.read(64 * 1024)
        except UnicodeDecodeError:
            try:
                with path.open("r", encoding="cp1252") as source:
                    source.read(64 * 1024)
            except UnicodeDecodeError as exc:
                raise ValueError("The uploaded CSV encoding is not supported") from exc
    if declared_mime and declared_mime not in MIME_ALIASES[kind] | {"application/octet-stream"}:
        raise ValueError("The declared MIME type does not match the uploaded file")
    return DetectedFile(kind=actual_kind, mime_type=expected_mime, extension=extension)
