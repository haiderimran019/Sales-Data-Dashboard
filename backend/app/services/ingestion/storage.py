from hashlib import sha256
from pathlib import Path
from typing import BinaryIO, Protocol
from uuid import UUID, uuid4


class Storage(Protocol):
    def key_for(self, organization_id: UUID, version_id: UUID, extension: str) -> str: ...

    def path_for(self, key: str) -> Path: ...

    def save(self, source: BinaryIO, key: str, max_bytes: int) -> tuple[int, str]: ...

    def delete(self, key: str) -> None: ...


class LocalStorage:
    """Development storage behind a replaceable object-storage boundary."""

    def __init__(self, root: str | Path):
        self.root = Path(root).expanduser().resolve()
        self.root.mkdir(parents=True, exist_ok=True)

    def key_for(self, organization_id: UUID, version_id: UUID, extension: str) -> str:
        return f"{organization_id}/{version_id}/{uuid4().hex}{extension}"

    def path_for(self, key: str) -> Path:
        path = (self.root / key).resolve()
        if self.root not in path.parents:
            raise ValueError("Invalid storage key")
        return path

    def save(self, source, key: str, max_bytes: int) -> tuple[int, str]:
        destination = self.path_for(key)
        destination.parent.mkdir(parents=True, exist_ok=True)
        digest = sha256()
        size = 0
        try:
            with destination.open("wb") as target:
                while chunk := source.read(1024 * 1024):
                    size += len(chunk)
                    if size > max_bytes:
                        raise ValueError("File exceeds the configured upload size limit")
                    digest.update(chunk)
                    target.write(chunk)
        except Exception:
            destination.unlink(missing_ok=True)
            raise
        return size, digest.hexdigest()

    def delete(self, key: str) -> None:
        self.path_for(key).unlink(missing_ok=True)
