"""V1.2: 错题回顾 API 路由"""
import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from datetime import datetime
from database import get_db
from models import WrongAnswer, Question, Exam, Note, User, WrongAnswerAnalysis
from routers.auth import get_current_user
from schemas import WrongAnswerCreate, WrongAnswerResponse, APIResponse, WrongAnswerAnalysisRequest, WrongAnswerAnalysisResponse
from services.deepseek import deepseek_service

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


# ============ V2.0: 错题智能分析 ============

@router.post("/analyze", response_model=APIResponse)
async def analyze_wrong_answers(
    req: WrongAnswerAnalysisRequest,
    db: AsyncSession = Depends(get_db),
    user: User | None = Depends(get_current_user),
):
    """V2.0: AI 智能分析错题，识别薄弱知识点和错误规律"""
    uid = user.id if user else "default"
    note_filter = Note.user_id.in_([uid, "default"]) if uid else Note.user_id == "default"

    # 获取错题数据
    if req.wrong_ids:
        wa_query = select(WrongAnswer).where(
            WrongAnswer.id.in_(req.wrong_ids),
        ).options(selectinload(WrongAnswer.question))
    else:
        wa_query = (
            select(WrongAnswer)
            .join(Question, WrongAnswer.question_id == Question.id)
            .join(Exam, Question.exam_id == Exam.id)
            .join(Note, Exam.note_id == Note.id)
            .where(note_filter)
            .options(selectinload(WrongAnswer.question))
            .order_by(WrongAnswer.created_at.desc())
        )
    result = await db.execute(wa_query)
    wrong_items = result.scalars().all()

    if not wrong_items:
        raise HTTPException(status_code=422, detail="没有找到错题记录")

    # 构建错题数据
    wrong_data = []
    for wa in wrong_items:
        q = wa.question
        wrong_data.append({
            "question_type": q.question_type if q else "",
            "difficulty": q.difficulty if q else "",
            "content": q.content if q else {},
            "answer": q.answer if q else "",
            "explanation": q.explanation if q else "",
            "user_answer": wa.user_answer,
            "error_count": wa.review_count + 1,
        })

    # 调用 AI 分析
    try:
        analysis = await deepseek_service.analyze_wrong_answers(
            wrong_answers_data=json.dumps(wrong_data, ensure_ascii=False),
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"错题分析失败: {str(e)}")

    # 保存分析结果
    weak_kps = analysis.get("weak_knowledge_points", [])
    wa_analysis = WrongAnswerAnalysis(
        user_id=uid,
        analysis_data=analysis,
        total_wrong=len(wrong_items),
        weak_kps=weak_kps,
    )
    db.add(wa_analysis)
    await db.commit()
    await db.refresh(wa_analysis)

    return APIResponse(
        success=True,
        message=f"已分析 {len(wrong_items)} 道错题，识别 {len(weak_kps)} 个薄弱知识点",
        data=WrongAnswerAnalysisResponse.model_validate(wa_analysis).model_dump(mode="json"),
    )


@router.get("/analyses", response_model=APIResponse)
async def list_analyses(
    db: AsyncSession = Depends(get_db),
    user: User | None = Depends(get_current_user),
):
    """V2.0: 获取历史分析记录列表"""
    uid = user.id if user else "default"
    result = await db.execute(
        select(WrongAnswerAnalysis)
        .where(WrongAnswerAnalysis.user_id == uid)
        .order_by(WrongAnswerAnalysis.created_at.desc())
    )
    items = result.scalars().all()
    return APIResponse(
        success=True,
        data=[WrongAnswerAnalysisResponse.model_validate(r).model_dump(mode="json") for r in items],
    )


@router.get("/analyses/{analysis_id}", response_model=APIResponse)
async def get_analysis(
    analysis_id: str,
    db: AsyncSession = Depends(get_db),
    user: User | None = Depends(get_current_user),
):
    """V2.0: 获取单次分析详情"""
    uid = user.id if user else "default"
    result = await db.execute(
        select(WrongAnswerAnalysis).where(
            WrongAnswerAnalysis.id == analysis_id,
            WrongAnswerAnalysis.user_id == uid,
        )
    )
    analysis = result.scalar_one_or_none()
    if not analysis:
        raise HTTPException(status_code=404, detail="分析记录不存在")
    return APIResponse(
        success=True,
        data=WrongAnswerAnalysisResponse.model_validate(analysis).model_dump(mode="json"),
    )


@router.get("/stats", response_model=APIResponse)
async def wrong_answer_stats(
    db: AsyncSession = Depends(get_db),
    user: User | None = Depends(get_current_user),
):
    """V2.0: 错题统计概览（不需要 AI）"""
    uid = user.id if user else "default"
    note_filter = Note.user_id.in_([uid, "default"]) if uid else Note.user_id == "default"

    result = await db.execute(
        select(WrongAnswer)
        .join(Question, WrongAnswer.question_id == Question.id)
        .join(Exam, Question.exam_id == Exam.id)
        .join(Note, Exam.note_id == Note.id)
        .where(note_filter)
        .options(selectinload(WrongAnswer.question))
    )
    items = result.scalars().all()

    if not items:
        return APIResponse(
            success=True,
            data={
                "total": 0,
                "by_type": {},
                "by_difficulty": {},
                "reviewed": 0,
                "unreviewed": 0,
            },
        )

    by_type = {}
    by_difficulty = {}
    reviewed = 0

    for wa in items:
        q = wa.question
        if q:
            t = q.question_type
            by_type[t] = by_type.get(t, 0) + 1
            d = q.difficulty
            by_difficulty[d] = by_difficulty.get(d, 0) + 1
        if wa.review_count > 0:
            reviewed += 1

    return APIResponse(
        success=True,
        data={
            "total": len(items),
            "by_type": by_type,
            "by_difficulty": by_difficulty,
            "reviewed": reviewed,
            "unreviewed": len(items) - reviewed,
        },
    )


@router.delete("/analyses/{analysis_id}", response_model=APIResponse)
async def delete_analysis(
    analysis_id: str,
    db: AsyncSession = Depends(get_db),
    user: User | None = Depends(get_current_user),
):
    """V2.0: 删除分析记录"""
    uid = user.id if user else "default"
    result = await db.execute(
        select(WrongAnswerAnalysis).where(
            WrongAnswerAnalysis.id == analysis_id,
            WrongAnswerAnalysis.user_id == uid,
        )
    )
    analysis = result.scalar_one_or_none()
    if not analysis:
        raise HTTPException(status_code=404, detail="分析记录不存在")
    await db.delete(analysis)
    await db.commit()
    return APIResponse(success=True, message="分析记录已删除")
