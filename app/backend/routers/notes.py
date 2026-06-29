"""笔记相关 API 路由"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from database import get_db
from models import Note, KnowledgePoint
from schemas import NoteCreate, NoteResponse, KnowledgePointResponse, APIResponse

router = APIRouter(prefix="/api/notes", tags=["笔记管理"])


@router.post("", response_model=APIResponse)
async def create_note(req: NoteCreate, db: AsyncSession = Depends(get_db)):
    """上传笔记"""
    note = Note(content=req.content, note_type=req.note_type)
    db.add(note)
    await db.commit()
    await db.refresh(note)

    return APIResponse(success=True, message="笔记上传成功", data={"id": note.id})


@router.get("", response_model=APIResponse)
async def list_notes(db: AsyncSession = Depends(get_db)):
    """获取笔记列表"""
    result = await db.execute(select(Note).order_by(Note.created_at.desc()))
    notes = result.scalars().all()

    return APIResponse(
        success=True,
        data=[
            NoteResponse.model_validate(n).model_dump(mode="json")
            for n in notes
        ],
    )


@router.get("/{note_id}", response_model=APIResponse)
async def get_note(note_id: str, db: AsyncSession = Depends(get_db)):
    """获取单篇笔记详情"""
    result = await db.execute(select(Note).where(Note.id == note_id))
    note = result.scalar_one_or_none()
    if not note:
        raise HTTPException(status_code=404, detail="笔记不存在")

    return APIResponse(
        success=True,
        data=NoteResponse.model_validate(note).model_dump(mode="json"),
    )


@router.get("/{note_id}/knowledge-points", response_model=APIResponse)
async def get_note_knowledge_points(note_id: str, db: AsyncSession = Depends(get_db)):
    """获取笔记关联的知识点"""
    note_result = await db.execute(select(Note).where(Note.id == note_id))
    if not note_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="笔记不存在")

    result = await db.execute(
        select(KnowledgePoint).where(KnowledgePoint.note_id == note_id)
    )
    kps = result.scalars().all()

    return APIResponse(
        success=True,
        data=[
            KnowledgePointResponse.model_validate(k).model_dump(mode="json")
            for k in kps
        ],
    )


@router.delete("/{note_id}", response_model=APIResponse)
async def delete_note(note_id: str, db: AsyncSession = Depends(get_db)):
    """删除笔记（级联删除关联的知识点和试卷）"""
    result = await db.execute(select(Note).where(Note.id == note_id))
    note = result.scalar_one_or_none()
    if not note:
        raise HTTPException(status_code=404, detail="笔记不存在")

    await db.delete(note)
    await db.commit()

    return APIResponse(success=True, message="笔记已删除")
