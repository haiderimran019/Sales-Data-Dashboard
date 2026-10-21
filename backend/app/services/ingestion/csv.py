import csv
from datetime import datetime
from pathlib import Path

from app.services.ingestion.base import Extractor
from app.services.ingestion.types import DetectedFile, NormalizedExtraction, TablePreview


def _unique_headers(headers: list[str]) -> list[str]:
    counts: dict[str, int] = {}
    result: list[str] = []
    for index, header in enumerate(headers):
        base = header.strip() or f"column_{index + 1}"
        counts[base] = counts.get(base, 0) + 1
        result.append(base if counts[base] == 1 else f"{base}_{counts[base]}")
    return result


def _value_type(value: str) -> str:
    value = value.strip()
    if not value:
        return "empty"
    try:
        float(value.replace(",", ""))
        return "number"
    except ValueError:
        pass
    try:
        datetime.fromisoformat(value.replace("Z", "+00:00"))
        return "date"
    except ValueError:
        return "text"


class CsvExtractor(Extractor):
    kind = "csv"

    def extract(self, path: Path, detected: DetectedFile, *, row_limit: int, text_limit: int) -> NormalizedExtraction:
        warnings: list[str] = []
        encoding = "utf-8-sig"
        try:
            with path.open("r", encoding=encoding, newline="") as sample_file:
                sample = sample_file.read(64 * 1024)
        except UnicodeDecodeError:
            encoding = "cp1252"
            with path.open("r", encoding=encoding, newline="") as sample_file:
                sample = sample_file.read(64 * 1024)
            warnings.append("The file was decoded using Windows-1252 rather than UTF-8.")
        try:
            dialect = csv.Sniffer().sniff(sample, delimiters=",;\t|")
        except csv.Error:
            dialect = csv.excel
            warnings.append("The delimiter could not be inferred confidently; comma was used.")
        try:
            has_header = csv.Sniffer().has_header(sample)
        except csv.Error:
            has_header = True
        rows: list[dict[str, str]] = []
        missing: dict[str, int] = {}
        types: dict[str, set[str]] = {}
        row_count = 0
        with path.open("r", encoding=encoding, newline="") as source:
            reader = csv.reader(source, dialect)
            first = next(reader, [])
            if not first:
                return NormalizedExtraction(detected_type="csv", warnings=["The CSV contains no rows."], metadata={"encoding": encoding})
            headers = _unique_headers(first if has_header else [f"column_{i + 1}" for i in range(len(first))])
            data_rows = reader if has_header else iter([first, *reader])
            for raw_row in data_rows:
                if not any(cell.strip() for cell in raw_row):
                    continue
                row_count += 1
                values = list(raw_row) + [""] * max(0, len(headers) - len(raw_row))
                record = {header: values[index].strip() for index, header in enumerate(headers)}
                for header, value in record.items():
                    if not value:
                        missing[header] = missing.get(header, 0) + 1
                    types.setdefault(header, set()).add(_value_type(value))
                if len(rows) < row_limit:
                    rows.append(record)
                if len(raw_row) > len(headers):
                    warnings.append("Some rows contain more fields than the header and were truncated.")
        data_types = {header: (next(iter(values)) if len(values) == 1 else "mixed") for header, values in types.items()}
        table = TablePreview(name="CSV", columns=headers, rows=rows, row_count=row_count, missing_values=missing, data_types=data_types, warnings=warnings)
        return NormalizedExtraction(detected_type="csv", tables=[table], metadata={"encoding": encoding, "has_header": has_header, "delimiter": dialect.delimiter}, warnings=warnings, confidence=0.95 if has_header else 0.65)
