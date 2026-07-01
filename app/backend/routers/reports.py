"""V2.0: 学习报告 API 路由"""
import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from database import get_db
from models import StudyReport, ExamResult, WrongAnswer, Question, Exam, Note, User
from routers.auth import get_current_user
from schemas import (
    ReportGenerateRequest, StudyReportResponse, APIResponse,
)
from services.deepseek import deepseek_service

router = APIRouter(prefix="/api/reports", tags=["学习报告"])


@router.post("/generate", response_model=APIResponse)
async def generate_report(
    req: ReportGenerateRequest,
    db: AsyncSession = Depends(get_db),
    user: User | None = Depends(get_current_user),
):
    """V2.0: 生成学习报告 —— AI 分析答题历史"""
    uid = user.id if user else "default"
    note_filter = Note.user_id.in_([uid, "default"]) if uid else Note.user_id == "default"

    # 获取答题记录
    if req.exam_ids:
        results_query = select(ExamResult).where(
            ExamResult.exam_id.in_(req.exam_ids),
            ExamResult.user_id == uid,
        )
    else:
        results_query = select(ExamResult).where(ExamResult.user_id == uid)
    result = await db.execute(results_query.order_by(ExamResult.created_at.desc()))
    exam_results = result.scalars().all()

    if not exam_results:
        raise HTTPException(status_code=422, detail="没有找到答题记录，请先完成一些试卷后再生成报告")

    exam_ids = list(set(r.exam_id for r in exam_results))

    # 获取错题记录
    wa_query = select(WrongAnswer).join(Question, WrongAnswer.question_id == Question.id).join(
        Exam, Question.exam_id == Exam.id
    ).join(Note, Exam.note_id == Note.id).where(
        note_filter,
        WrongAnswer.question_id.in_(
            select(Question.id).join(Exam, Question.exam_id == Exam.id).where(Exam.id.in_(exam_ids))
        )
    )
    wa_result = await db.execute(wa_query)
    wrong_answers = wa_result.scalars().all()

    # 统计数据
    total_exams = len(exam_results)
    total_questions = sum(r.total_questions for r in exam_results)
    avg_score = round(sum(r.score for r in exam_results) / total_exams) if total_exams > 0 else 0

    # 构建答题历史数据给 AI
    exam_history_data = []
    for r in exam_results:
        exam_history_data.append({
            "score": r.score,
            "total": r.total_questions,
            "correct": r.correct_count,
            "date": r.created_at.isoformat() if r.created_at else "",
        })

    # 构建错题数据给 AI
    wrong_data = []
    wrong_ids = []
    for wa in wrong_answers:
        wrong_data.append({
            "question_type": wa.question.question_type if wa.question else "",
            "difficulty": wa.question.difficulty if wa.question else "",
            "answer": wa.question.answer if wa.question else "",
            "explanation": wa.question.explanation if wa.question else "",
            "user_answer": wa.user_answer,
        })
        wrong_ids.append(wa.id)

    # 调用 AI 生成报告
    try:
        report_content = await deepseek_service.generate_study_report(
            exam_history=json.dumps(exam_history_data, ensure_ascii=False),
            wrong_answers=json.dumps(wrong_data, ensure_ascii=False),
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"报告生成失败: {str(e)}")

    # 保存报告
    title = req.title or f"学习报告-{total_exams}份试卷"
    report = StudyReport(
        user_id=uid,
        title=title,
        content=report_content,
        exam_ids=exam_ids,
        wrong_answer_ids=wrong_ids,
        total_exams=total_exams,
        total_questions=total_questions,
        avg_score=avg_score,
    )
    db.add(report)
    await db.commit()
    await db.refresh(report)

    return APIResponse(
        success=True,
        message="学习报告已生成",
        data=StudyReportResponse.model_validate(report).model_dump(mode="json"),
    )


@router.get("", response_model=APIResponse)
async def list_reports(
    db: AsyncSession = Depends(get_db),
    user: User | None = Depends(get_current_user),
):
    """V2.0: 获取学习报告列表"""
    uid = user.id if user else "default"
    result = await db.execute(
        select(StudyReport)
        .where(StudyReport.user_id == uid)
        .order_by(StudyReport.created_at.desc())
    )
    items = result.scalars().all()
    return APIResponse(
        success=True,
        data=[StudyReportResponse.model_validate(r).model_dump(mode="json") for r in items],
    )


@router.get("/{report_id}", response_model=APIResponse)
async def get_report(
    report_id: str,
    db: AsyncSession = Depends(get_db),
    user: User | None = Depends(get_current_user),
):
    """V2.0: 获取单份学习报告详情"""
    uid = user.id if user else "default"
    result = await db.execute(
        select(StudyReport).where(StudyReport.id == report_id, StudyReport.user_id == uid)
    )
    report = result.scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=404, detail="报告不存在")
    return APIResponse(
        success=True,
        data=StudyReportResponse.model_validate(report).model_dump(mode="json"),
    )


@router.delete("/{report_id}", response_model=APIResponse)
async def delete_report(
    report_id: str,
    db: AsyncSession = Depends(get_db),
    user: User | None = Depends(get_current_user),
):
    """V2.0: 删除学习报告"""
    uid = user.id if user else "default"
    result = await db.execute(
        select(StudyReport).where(StudyReport.id == report_id, StudyReport.user_id == uid)
    )
    report = result.scalar_one_or_none()
    if not report:
        raise HTTPException(status_code=404, detail="报告不存在")
    await db.delete(report)
    await db.commit()
    return APIResponse(success=True, message="报告已删除")
