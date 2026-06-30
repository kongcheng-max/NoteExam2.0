"""笔记相关 API 路由"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from database import get_db
from models import Note, KnowledgePoint
from schemas import NoteCreate, NoteUpdate, NoteResponse, KnowledgePointResponse, APIResponse, KnowledgePointCreate, KnowledgePointUpdate

router = APIRouter(prefix="/api/notes", tags=["笔记管理"])


@router.post("", response_model=APIResponse)
async def create_note(req: NoteCreate, db: AsyncSession = Depends(get_db)):
    """上传笔记"""
    note = Note(content=req.content, note_type=req.note_type)
    db.add(note)
    await db.commit()
    await db.refresh(note)

    return APIResponse(success=True, message="笔记上传成功", data={"id": note.id})


@router.put("/{note_id}", response_model=APIResponse)
async def update_note(note_id: str, req: NoteUpdate, db: AsyncSession = Depends(get_db)):
    """Update note content for OCR review"""
    result = await db.execute(select(Note).where(Note.id == note_id))
    note = result.scalar_one_or_none()
    if not note:
        raise HTTPException(status_code=404, detail="笔记不存在")

    if req.content is not None:
        note.content = req.content

    await db.commit()
    await db.refresh(note)

    return APIResponse(
        success=True,
        message="笔记内容已更新",
        data=NoteResponse.model_validate(note).model_dump(mode="json"),
    )


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



# ============ V1.1: 知识点手动调整 ============

@router.post("/{note_id}/knowledge-points", response_model=APIResponse)
async def add_knowledge_point(note_id: str, req: KnowledgePointCreate, db: AsyncSession = Depends(get_db)):
    """手动添加知识点"""
    note_result = await db.execute(select(Note).where(Note.id == note_id))
    if not note_result.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="笔记不存在")

    kp = KnowledgePoint(
        note_id=note_id,
        name=req.name,
        category=req.category,
        importance=req.importance,
    )
    db.add(kp)
    await db.commit()
    await db.refresh(kp)

    return APIResponse(
        success=True,
        message="知识点添加成功",
        data=KnowledgePointResponse.model_validate(kp).model_dump(mode="json"),
    )


@router.put("/{note_id}/knowledge-points/{kp_id}", response_model=APIResponse)
async def update_knowledge_point(
    note_id: str, kp_id: str, req: KnowledgePointUpdate, db: AsyncSession = Depends(get_db)
):
    """手动修改知识点"""
    result = await db.execute(
        select(KnowledgePoint).where(
            KnowledgePoint.id == kp_id,
            KnowledgePoint.note_id == note_id,
        )
    )
    kp = result.scalar_one_or_none()
    if not kp:
        raise HTTPException(status_code=404, detail="知识点不存在")

    if req.name is not None:
        kp.name = req.name
    if req.category is not None:
        kp.category = req.category
    if req.importance is not None:
        kp.importance = req.importance

    await db.commit()
    await db.refresh(kp)

    return APIResponse(
        success=True,
        message="知识点修改成功",
        data=KnowledgePointResponse.model_validate(kp).model_dump(mode="json"),
    )


@router.delete("/{note_id}/knowledge-points/{kp_id}", response_model=APIResponse)
async def delete_knowledge_point(note_id: str, kp_id: str, db: AsyncSession = Depends(get_db)):
    """手动删除知识点"""
    result = await db.execute(
        select(KnowledgePoint).where(
            KnowledgePoint.id == kp_id,
            KnowledgePoint.note_id == note_id,
        )
    )
    kp = result.scalar_one_or_none()
    if not kp:
        raise HTTPException(status_code=404, detail="知识点不存在")

    await db.delete(kp)
    await db.commit()

    return APIResponse(success=True, message="知识点已删除")


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
