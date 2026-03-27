import uuid
from datetime import datetime, timezone
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.whatsapp_message_log import WhatsAppMessageLog, MessageLogStatus


async def create_log(
    db: AsyncSession,
    customer_phone: str,
    message_type: str,
    appointment_id: uuid.UUID | None = None,
    payload_json: str | None = None,
    template_name: str | None = None,
) -> WhatsAppMessageLog:
    log = WhatsAppMessageLog(
        appointment_id=appointment_id,
        customer_phone=customer_phone,
        message_type=message_type,
        template_name=template_name,
        payload_json=payload_json,
        status=MessageLogStatus.PENDING,
    )
    db.add(log)
    await db.flush()
    return log


async def mark_sent(db: AsyncSession, log_id: uuid.UUID) -> None:
    log = await db.get(WhatsAppMessageLog, log_id)
    if log:
        log.status = MessageLogStatus.SENT
        log.sent_at = datetime.now(timezone.utc)


async def mark_failed(db: AsyncSession, log_id: uuid.UUID, error_message: str) -> None:
    log = await db.get(WhatsAppMessageLog, log_id)
    if log:
        log.status = MessageLogStatus.FAILED
        log.error_message = error_message


async def list_logs(
    db: AsyncSession,
    page: int = 1,
    page_size: int = 20,
    appointment_id: uuid.UUID | None = None,
) -> tuple[list[WhatsAppMessageLog], int]:
    query = select(WhatsAppMessageLog)
    if appointment_id:
        query = query.where(WhatsAppMessageLog.appointment_id == appointment_id)
    count_result = await db.execute(select(func.count()).select_from(query.subquery()))
    total = count_result.scalar_one()
    query = query.order_by(WhatsAppMessageLog.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    return list(result.scalars().all()), total
