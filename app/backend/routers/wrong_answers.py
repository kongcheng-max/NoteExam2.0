"""V1.2: 错题回顾 API 路由"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from datetime import datetime
from database import get_db
from models import WrongAnswer, Question, Exam, Note, User
from routers.auth import get_current_user
from schemas import WrongAnswerCreate, WrongAnswerResponse, APIResponse

router = APIRouter(prefix="/api/wrong-answers", tags=["错题回顾"])


@router.post("/questions/{question_id}", response_model=APIResponse)
async def mark_wrong(
    question_id: str,
    req: WrongAnswerCreate,
    db: AsyncSession = Depends(get_db),
    user: User | None = Depends(get_current_user),
):
    """标记错题"""
    # 验证试题存在且有权限
    result = await db.execute(
        select(Question).join(Exam, Question.exam_id == Exam.id).join(Note, Exam.note_id == Note.id).where(
            Question.id == question_id,
            Note.user_id.in_([user.id, "default"]) if user else Note.user_id == "default"
        )
    )
    question = result.scalar_one_or_none()
    if not question:
        raise HTTPException(status_code=404, detail="试题不存在")

    # 检查是否已标记
    result = await db.execute(
        select(WrongAnswer).where(WrongAnswer.question_id == question_id)
    )
    existing = result.scalar_one_or_none()
    if existing:
        return APIResponse(success=True, message="该试题已在错题本中", data={"id": existing.id})

    wa = WrongAnswer(
        question_id=question_id,
        exam_id=question.exam_id,
        user_answer=req.user_answer,
        note=req.note,
    )
    db.add(wa)
    await db.commit()
    await db.refresh(wa)

    return APIResponse(success=True, message="已加入错题本", data={"id": wa.id})


@router.delete("/questions/{question_id}", response_model=APIResponse)
async def unmark_wrong(question_id: str, db: AsyncSession = Depends(get_db), user: User | None = Depends(get_current_user)):
    """取消错题标记"""
    result = await db.execute(
        select(WrongAnswer).join(Question, WrongAnswer.question_id == Question.id).join(Exam, Question.exam_id == Exam.id).join(Note, Exam.note_id == Note.id).where(
            WrongAnswer.question_id == question_id,
            Note.user_id.in_([user.id, "default"]) if user else Note.user_id == "default"
        )
    )
    wa = result.scalar_one_or_none()
    if not wa:
        raise HTTPException(status_code=404, detail="错题记录不存在")

    await db.delete(wa)
    await db.commit()

    return APIResponse(success=True, message="已从错题本移除")


@router.get("", response_model=APIResponse)
async def list_wrong_answers(db: AsyncSession = Depends(get_db), user: User | None = Depends(get_current_user)):
    """获取所有错题"""
    note_filter = Note.user_id.in_([user.id, "default"]) if user else Note.user_id == "default"
    result = await db.execute(
        select(WrongAnswer)
        .join(Question, WrongAnswer.question_id == Question.id)
        .join(Exam, Question.exam_id == Exam.id)
        .join(Note, Exam.note_id == Note.id)
        .where(note_filter)
        .options(selectinload(WrongAnswer.question))
        .order_by(WrongAnswer.created_at.desc())
    )
    items = result.scalars().all()
    return APIResponse(
        success=True,
        message="获取成功",
        data=[
            {
                "id": wa.id,
                "question_id": wa.question_id,
                "exam_id": wa.exam_id,
                "user_answer": wa.user_answer,
                "note": wa.note,
                "review_count": wa.review_count,
                "created_at": wa.created_at.isoformat(),
                "last_reviewed_at": wa.last_reviewed_at.isoformat() if wa.last_reviewed_at else None,
                "question": {
                    "id": wa.question.id,
                    "exam_id": wa.question.exam_id,
                    "question_type": wa.question.question_type,
                    "difficulty": wa.question.difficulty,
                    "content": wa.question.content,
                    "answer": wa.question.answer,
                    "explanation": wa.question.explanation,
                    "order_num": wa.question.order_num,
                } if wa.question else None,
            }
            for wa in items
        ],
    )


@router.post("/{wrong_id}/review", response_model=APIResponse)
async def review_wrong(wrong_id: str, db: AsyncSession = Depends(get_db), user: User | None = Depends(get_current_user)):
    """记录复习（增加复习计数）"""
    result = await db.execute(
        select(WrongAnswer).join(Question, WrongAnswer.question_id == Question.id).join(Exam, Question.exam_id == Exam.id).join(Note, Exam.note_id == Note.id).where(
            WrongAnswer.id == wrong_id,
            Note.user_id.in_([user.id, "default"]) if user else Note.user_id == "default"
        )
    )
    wa = result.scalar_one_or_none()
    if not wa:
        raise HTTPException(status_code=404, detail="错题记录不存在")

    wa.review_count += 1
    wa.last_reviewed_at = datetime.utcnow()
    await db.commit()

    return APIResponse(
        success=True,
        message=f"已复习 {wa.review_count} 次",
        data={"id": wa.id, "review_count": wa.review_count},
    )


@router.delete("/{wrong_id}", response_model=APIResponse)
async def delete_wrong(wrong_id: str, db: AsyncSession = Depends(get_db), user: User | None = Depends(get_current_user)):
    """删除错题记录"""
    result = await db.execute(
        select(WrongAnswer).join(Question, WrongAnswer.question_id == Question.id).join(Exam, Question.exam_id == Exam.id).join(Note, Exam.note_id == Note.id).where(
            WrongAnswer.id == wrong_id,
            Note.user_id.in_([user.id, "default"]) if user else Note.user_id == "default"
        )
    )
    wa = result.scalar_one_or_none()
    if not wa:
        raise HTTPException(status_code=404, detail="错题记录不存在")

    await db.delete(wa)
    await db.commit()

    return APIResponse(success=True, message="错题记录已删除")
