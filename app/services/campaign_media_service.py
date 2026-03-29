from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
import mimetypes
import re
import unicodedata
from uuid import uuid4

from fastapi import UploadFile

from app.integrations.whatsapp_client import WhatsAppClient

CAMPAIGN_UPLOAD_RELATIVE_DIR = Path("uploads") / "campaigns"
_SAFE_FILENAME_RE = re.compile(r"[^A-Za-z0-9._-]+")
_CONTENT_TYPE_SUFFIXES = {
    "image/jpeg": ".jpg",
    "image/jpg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
}
_UPLOAD_CHUNK_SIZE = 1024 * 1024


@dataclass(frozen=True, slots=True)
class StoredCampaignImage:
    relative_path: str
    absolute_path: Path
    original_filename: str
    content_type: str | None
    size_bytes: int


def ensure_campaign_upload_dir(storage_root: Path | str | None = None) -> Path:
    root = Path(storage_root) if storage_root is not None else Path.cwd()
    upload_dir = root / CAMPAIGN_UPLOAD_RELATIVE_DIR
    upload_dir.mkdir(parents=True, exist_ok=True)
    return upload_dir


def _normalize_filename_part(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode("ascii")
    cleaned = _SAFE_FILENAME_RE.sub("-", normalized).strip("._-")
    return cleaned or "campaign-image"


def _filename_suffix(original_filename: str, content_type: str | None) -> str:
    suffix = Path(original_filename).suffix.lower()
    if suffix:
        return suffix
    if content_type:
        return _CONTENT_TYPE_SUFFIXES.get(content_type.lower(), "")
    return ""


def _mime_type_from_filename(filename: str) -> str | None:
    mime_type, _ = mimetypes.guess_type(filename)
    return mime_type


def _resolve_mime_type(stored_image: StoredCampaignImage) -> str:
    if stored_image.content_type:
        return stored_image.content_type
    resolved = _mime_type_from_filename(stored_image.original_filename) or _mime_type_from_filename(
        stored_image.absolute_path.name
    )
    if resolved:
        return resolved
    raise ValueError(
        f"Unable to determine MIME type for campaign image '{stored_image.absolute_path.name}'"
    )


def _unique_campaign_filename(original_filename: str, content_type: str | None) -> str:
    stem = _normalize_filename_part(Path(original_filename).stem or "campaign-image")
    suffix = _filename_suffix(original_filename, content_type)
    return f"{stem}-{uuid4().hex}{suffix}"


async def store_campaign_image(
    file: UploadFile,
    *,
    storage_root: Path | str | None = None,
) -> StoredCampaignImage:
    upload_dir = ensure_campaign_upload_dir(storage_root)
    original_filename = Path(file.filename or "campaign-image").name
    content_type = file.content_type
    safe_filename = _unique_campaign_filename(original_filename, content_type)
    absolute_path = upload_dir / safe_filename
    size_bytes = 0
    with absolute_path.open("wb") as destination:
        while True:
            chunk = await file.read(_UPLOAD_CHUNK_SIZE)
            if not chunk:
                break
            destination.write(chunk)
            size_bytes += len(chunk)
    return StoredCampaignImage(
        relative_path=str(CAMPAIGN_UPLOAD_RELATIVE_DIR / safe_filename),
        absolute_path=absolute_path,
        original_filename=original_filename,
        content_type=content_type,
        size_bytes=size_bytes,
    )


async def ensure_campaign_image_media_id(
    client: WhatsAppClient,
    stored_image: StoredCampaignImage,
    *,
    image_media_id: str | None = None,
) -> str:
    if image_media_id:
        return image_media_id

    return await client.upload_media(
        file_path=stored_image.absolute_path,
        mime_type=_resolve_mime_type(stored_image),
        filename=stored_image.absolute_path.name,
    )
