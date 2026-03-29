from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
import mimetypes

import pytest

from app.api.v1 import campaigns as campaigns_api
from app.integrations.whatsapp_client import WhatsAppClient
from app.services import campaign_media_service as svc


@dataclass
class FakeUploadFile:
    filename: str
    content_type: str
    data: bytes
    chunk_size: int = 4
    read_calls: list[int] | None = None

    def __post_init__(self) -> None:
        if self.read_calls is None:
            self.read_calls = []

    async def read(self, size: int = -1) -> bytes:
        self.read_calls.append(size)
        if size is None or size < 0:
            size = len(self.data)
        if not self.data:
            return b""
        chunk_size = min(size, self.chunk_size)
        chunk, self.data = self.data[:chunk_size], self.data[chunk_size:]
        return chunk


@pytest.mark.asyncio
async def test_store_campaign_image_writes_bytes_to_uploads_campaigns(tmp_path: Path) -> None:
    upload = FakeUploadFile(filename="../campaign hero.png", content_type="image/png", data=b"image-bytes")

    stored = await svc.store_campaign_image(upload, storage_root=tmp_path)

    assert stored.relative_path.startswith("uploads/campaigns/")
    assert stored.absolute_path.parent == tmp_path / "uploads" / "campaigns"
    assert stored.absolute_path.read_bytes() == b"image-bytes"
    assert stored.absolute_path.name.endswith(".png")
    assert " " not in stored.absolute_path.name
    assert ".." not in stored.absolute_path.name


@pytest.mark.asyncio
async def test_store_campaign_image_reads_upload_in_chunks(tmp_path: Path) -> None:
    upload = FakeUploadFile(filename="campaign.png", content_type="image/png", data=b"abcdefgh", chunk_size=3)

    stored = await svc.store_campaign_image(upload, storage_root=tmp_path)

    assert stored.absolute_path.read_bytes() == b"abcdefgh"
    assert upload.read_calls == [1024 * 1024, 1024 * 1024, 1024 * 1024, 1024 * 1024]


@pytest.mark.asyncio
async def test_ensure_campaign_image_media_id_returns_existing_media_id_without_uploading(tmp_path: Path) -> None:
    upload = FakeUploadFile(filename="campaign.png", content_type="image/png", data=b"image-bytes")
    stored = await svc.store_campaign_image(upload, storage_root=tmp_path)

    class GuardClient:
        async def upload_media(self, **kwargs):  # pragma: no cover - should not run
            raise AssertionError(f"upload_media should not be called: {kwargs}")

    media_id = await svc.ensure_campaign_image_media_id(
        GuardClient(),
        stored,
        image_media_id="media-123",
    )

    assert media_id == "media-123"


@pytest.mark.asyncio
async def test_ensure_campaign_image_media_id_uploads_when_missing(tmp_path: Path) -> None:
    upload = FakeUploadFile(filename="campaign.png", content_type="image/png", data=b"image-bytes")
    stored = await svc.store_campaign_image(upload, storage_root=tmp_path)
    calls: list[dict[str, object]] = []

    class FakeClient:
        async def upload_media(self, **kwargs):
            calls.append(kwargs)
            return "media-456"

    media_id = await svc.ensure_campaign_image_media_id(FakeClient(), stored)

    assert media_id == "media-456"
    assert calls == [
        {
            "file_path": stored.absolute_path,
            "mime_type": "image/png",
            "filename": stored.absolute_path.name,
        }
    ]


@pytest.mark.asyncio
async def test_ensure_campaign_image_media_id_derives_mime_from_filename_suffix_when_content_type_missing(
    tmp_path: Path,
) -> None:
    upload = FakeUploadFile(filename="campaign-hero.png", content_type="", data=b"image-bytes")
    stored = await svc.store_campaign_image(upload, storage_root=tmp_path)
    calls: list[dict[str, object]] = []

    class FakeClient:
        async def upload_media(self, **kwargs):
            calls.append(kwargs)
            return "media-789"

    media_id = await svc.ensure_campaign_image_media_id(FakeClient(), stored)

    assert media_id == "media-789"
    assert calls[0]["mime_type"] == "image/png"


@pytest.mark.asyncio
async def test_whatsapp_client_upload_media_posts_binary_payload(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    file_path = tmp_path / "campaign.png"
    file_path.write_bytes(b"image-bytes")
    client = WhatsAppClient("token-123", "phone-number-id-456")
    calls: list[dict[str, object]] = []

    class FakeResponse:
        def raise_for_status(self) -> None:
            return None

        def json(self) -> dict[str, str]:
            return {"id": "media-789"}

    async def fake_post(url, **kwargs):
        calls.append({"url": url, **kwargs})
        return FakeResponse()

    monkeypatch.setattr(client._client, "post", fake_post)

    media_id = await client.upload_media(file_path=file_path, mime_type="image/png")

    assert media_id == "media-789"
    assert calls and calls[0]["url"].endswith("/phone-number-id-456/media")
    assert calls[0]["headers"]["Authorization"] == "Bearer token-123"
    assert calls[0]["data"] == {"messaging_product": "whatsapp", "type": "image/png"}
    file_tuple = calls[0]["files"]["file"]
    assert file_tuple[0] == "campaign.png"
    assert file_tuple[2] == "image/png"


@pytest.mark.asyncio
async def test_whatsapp_client_send_image_button_message_uses_image_header_payload(monkeypatch: pytest.MonkeyPatch) -> None:
    client = WhatsAppClient("token-123", "phone-number-id-456")
    captured: list[dict[str, object]] = []

    async def fake_post(payload: dict) -> dict:
        captured.append(payload)
        return {"ok": True}

    monkeypatch.setattr(client, "_post", fake_post)

    await client.send_image_button_message(
        to="919999999999",
        body="Book now",
        footer="ORA Clinic",
        media_id="media-789",
        buttons=[{"id": "campaign_book:diwali-hydra-50-sun", "title": "Book Now"}],
    )

    payload = captured[0]
    assert payload["messaging_product"] == "whatsapp"
    assert payload["to"] == "919999999999"
    assert payload["type"] == "interactive"
    assert payload["interactive"]["type"] == "button"
    assert payload["interactive"]["header"] == {
        "type": "image",
        "image": {"id": "media-789"},
    }
    assert payload["interactive"]["footer"] == {"text": "ORA Clinic"}
    assert payload["interactive"]["action"]["buttons"] == [
        {
            "type": "reply",
            "reply": {"id": "campaign_book:diwali-hydra-50-sun", "title": "Book Now"},
        }
    ]


@pytest.mark.asyncio
async def test_campaign_image_upload_endpoint_returns_storage_metadata(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    upload = FakeUploadFile(filename="campaign.png", content_type="image/png", data=b"image-bytes")
    original_size = len(upload.data)

    async def fake_store_campaign_image(file, *, storage_root=None):
        return svc.StoredCampaignImage(
            relative_path="uploads/campaigns/campaign.png",
            absolute_path=tmp_path / "uploads" / "campaigns" / "campaign.png",
            original_filename=file.filename,
            content_type=file.content_type,
            size_bytes=len(file.data),
        )

    monkeypatch.setattr(svc, "store_campaign_image", fake_store_campaign_image)

    result = await campaigns_api.upload_campaign_image(file=upload)

    assert result["relative_path"] == "uploads/campaigns/campaign.png"
    assert result["filename"] == "campaign.png"
    assert result["content_type"] == "image/png"
    assert result["size_bytes"] == original_size
    assert "absolute_path" not in result
