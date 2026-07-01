"""笔记相关 API 路由"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from database import get_db
from models import Note, KnowledgePoint, User
from routers.auth import get_current_user
from schemas import NoteCreate, NoteUpdate, NoteResponse, KnowledgePointResponse, APIResponse, KnowledgePointCreate, KnowledgePointUpdate

router = APIRouter(prefix="/api/notes", tags=["笔记管理"])


def _user_filter(user: User | None):
    """Build user_id filter: logged-in users see own + default; guests see only default"""
    if user:
        return Note.user_id.in_([user.id, "default"])
    return Note.user_id == "default"


async def _check_note_access(note_id: str, user: User | None, db: AsyncSession, require_owner: bool = False):
    """Verify note exists and user has access. Returns note or raises HTTPException."""
    result = await db.execute(select(Note).where(Note.id == note_id))
    note = result.scalar_one_or_none()
    if not note:
        raise HTTPException(status_code=404, detail="笔记不存在")
    if require_owner and not user:
        raise HTTPException(status_code=401, detail="请先登录")
    if user and note.user_id != "default" and note.user_id != user.id:
        raise HTTPException(status_code=403, detail="无权访问此笔记")
    if require_owner and note.user_id == "default" and not user:
        raise HTTPException(status_code=403, detail="无权修改公共笔记")
    if require_owner and user and note.user_id != "default" and note.user_id != user.id:
        raise HTTPException(status_code=403, detail="无权修改此笔记")
    return note


@router.post("", response_model=APIResponse)
async def create_note(req: NoteCreate, db: AsyncSession = Depends(get_db), user: User | None = Depends(get_current_user)):
    """上传笔记"""
    note = Note(content=req.content, note_type=req.note_type, user_id=user.id if user else "default")
    db.add(note)
    await db.commit()
    await db.refresh(note)

    return APIResponse(success=True, message="笔记上传成功", data={"id": note.id})


@router.put("/{note_id}", response_model=APIResponse)
async def update_note(note_id: str, req: NoteUpdate, db: AsyncSession = Depends(get_db), user: User | None = Depends(get_current_user)):
    """Update note content for OCR review"""
    note = await _check_note_access(note_id, user, db, require_owner=True)

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
async def list_notes(db: AsyncSession = Depends(get_db), user: User | None = Depends(get_current_user)):
    """获取笔记列表"""
    result = await db.execute(select(Note).where(_user_filter(user)).order_by(Note.created_at.desc()))
    notes = result.scalars().all()

    return APIResponse(
        success=True,
        data=[
            NoteResponse.model_validate(n).model_dump(mode="json")
            for n in notes
        ],
    )


@router.get("/{note_id}", response_model=APIResponse)
async def get_note(note_id: str, db: AsyncSession = Depends(get_db), user: User | None = Depends(get_current_user)):
    """获取单篇笔记详情"""
    note = await _check_note_access(note_id, user, db)

    return APIResponse(
        success=True,
        data=NoteResponse.model_validate(note).model_dump(mode="json"),
    )


@router.get("/{note_id}/knowledge-points", response_model=APIResponse)
async def get_note_knowledge_points(note_id: str, db: AsyncSession = Depends(get_db), user: User | None = Depends(get_current_user)):
    """获取笔记关联的知识点"""
    await _check_note_access(note_id, user, db)

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
async def add_knowledge_point(note_id: str, req: KnowledgePointCreate, db: AsyncSession = Depends(get_db), user: User | None = Depends(get_current_user)):
    """手动添加知识点"""
    note = await _check_note_access(note_id, user, db, require_owner=True)

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
    note_id: str, kp_id: str, req: KnowledgePointUpdate, db: AsyncSession = Depends(get_db), user: User | None = Depends(get_current_user)
):
    """手动修改知识点"""
    await _check_note_access(note_id, user, db, require_owner=True)

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
async def delete_knowledge_point(note_id: str, kp_id: str, db: AsyncSession = Depends(get_db), user: User | None = Depends(get_current_user)):
    """手动删除知识点"""
    await _check_note_access(note_id, user, db, require_owner=True)

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
async def delete_note(note_id: str, db: AsyncSession = Depends(get_db), user: User | None = Depends(get_current_user)):
    """删除笔记（级联删除关联的知识点和试卷）"""
    note = await _check_note_access(note_id, user, db, require_owner=True)

    await db.delete(note)
    await db.commit()

    return APIResponse(success=True, message="笔记已删除")
