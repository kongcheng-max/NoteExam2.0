"""V1.1: File upload router - image/PDF upload with OCR"""
import os
import uuid
import asyncio
from concurrent.futures import ThreadPoolExecutor
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from database import get_db
from models import Note
from schemas import APIResponse
from config import UPLOAD_DIR

router = APIRouter(prefix="/api/files", tags=["file-upload"])

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/jpg"}
ALLOWED_PDF_TYPE = {"application/pdf"}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB

# BUG-024: 专用线程池，避免 OCR/PDF 解析阻塞事件循环
_ocr_executor = ThreadPoolExecutor(max_workers=2)


async def _process_file_ocr(note_id: str, file_path: str, note_type: str):
    """Background task: OCR / text extraction after upload (non-blocking)"""
    from database import async_session
    async with async_session() as db:
        result = await db.execute(select(Note).where(Note.id == note_id))
        note = result.scalar_one_or_none()
        if not note:
            return

        try:
            loop = asyncio.get_running_loop()
            if note_type == "image":
                from services.ocr import ocr_service
                text = await loop.run_in_executor(_ocr_executor, ocr_service.recognize_image, file_path)
            else:
                from services.pdf_parser import pdf_parser
                text = await loop.run_in_executor(_ocr_executor, pdf_parser.extract_text, file_path)

            if text and text.strip():
                note.content = text.strip()
                await db.commit()
        except Exception:
            # BUG-027: OCR 失败时不写入错误文本到 content，避免后续生成废题
            # content 保持空字符串，前端轮询后可通过 content 是否为空判断 OCR 是否成功
            pass


@router.post("/upload", response_model=APIResponse)
async def upload_note_file(
    file: UploadFile = File(...),
    note_type: str = Form("image"),
    db: AsyncSession = Depends(get_db),
):
    """Upload image or PDF, save locally, create note record"""
    if note_type not in ("image", "pdf"):
        raise HTTPException(status_code=422, detail="仅支持图片或 PDF 格式")

    if note_type == "image" and file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(status_code=422, detail="仅支持 JPG/PNG 格式图片")
    if note_type == "pdf" and file.content_type not in ALLOWED_PDF_TYPE:
        raise HTTPException(status_code=422, detail="仅支持 PDF 格式文件")

    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="文件大小超过 10MB 限制")

    ext = os.path.splitext(file.filename or "file")[1] or (".png" if note_type == "image" else ".pdf")
    saved_name = f"{uuid.uuid4().hex}{ext}"
    saved_path = os.path.join(UPLOAD_DIR, saved_name)
    with open(saved_path, "wb") as f:
        f.write(contents)

    note = Note(
        content="",
        note_type=note_type,
        file_path=saved_name,
        original_filename=file.filename,
    )
    db.add(note)
    await db.commit()
    await db.refresh(note)

    asyncio.create_task(_process_file_ocr(note.id, saved_path, note_type))

    return APIResponse(
        success=True,
        message=f"{'图片' if note_type == 'image' else 'PDF'}上传成功，正在 OCR 识别……",
        data={
            "id": note.id,
            "note_type": note.note_type,
            "original_filename": note.original_filename,
        },
    )
