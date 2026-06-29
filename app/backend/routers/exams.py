"""试卷相关 API 路由 —— 根据 tech-spec.md 第4节数据流设计"""
import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from database import get_db
from models import Note, KnowledgePoint, Exam, Question
from schemas import (
    ExamGenerateRequest, ExamResponse, ExamListItem, QuestionResponse,
    KnowledgePointResponse, APIResponse,
)
from services.deepseek import deepseek_service

router = APIRouter(prefix="/api/exams", tags=["试卷管理"])

# 合法题型与难度
VALID_QUESTION_TYPES = {"single_choice", "multi_choice", "fill_blank", "true_false", "short_answer", "essay"}
VALID_DIFFICULTIES = {"basic", "advanced", "challenge"}
CHOICE_TYPES = {"single_choice", "multi_choice"}


def validate_question(q: dict) -> bool:
    """校验 AI 生成的单道试题格式是否合法"""
    q_type = q.get("question_type", "")
    if q_type not in VALID_QUESTION_TYPES:
        return False
    if q.get("difficulty", "") not in VALID_DIFFICULTIES:
        return False
    content = q.get("content")
    if not isinstance(content, dict) or "stem" not in content:
        return False
    if q_type in CHOICE_TYPES:
        options = content.get("options")
        if not isinstance(options, list) or len(options) < 2:
            return False
    # BUG-022: 校验答案和解析不能为空
    answer = q.get("answer")
    if not answer or (isinstance(answer, str) and not answer.strip()):
        return False
    explanation = q.get("explanation", "")
    if not explanation or len(str(explanation).strip()) < 10:
        return False
    return True


@router.post("/generate", response_model=APIResponse)
async def generate_exam(req: ExamGenerateRequest, db: AsyncSession = Depends(get_db)):
    """生成试卷 —— 核心流程：验证笔记 → 知识提取 → 试题生成 → 存库"""
    # 1. 验证笔记存在
    result = await db.execute(select(Note).where(Note.id == req.note_id))
    note = result.scalar_one_or_none()
    if not note:
        raise HTTPException(status_code=404, detail="笔记不存在")

    # 2. 知识提取（Step 1）
    try:
        kp_list = await deepseek_service.extract_knowledge_points(note.content)
    except ValueError as e:
        raise HTTPException(status_code=502, detail=f"知识提取格式异常: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"知识提取失败: {str(e)}")

    if not kp_list:
        raise HTTPException(status_code=422, detail="未能从笔记中提取到知识点，请检查笔记内容是否有效")

    # 3. 保存知识点到数据库
    saved_kps = []
    for kp in kp_list:
        db_kp = KnowledgePoint(
            note_id=note.id,
            name=kp.get("name", ""),
            category=kp.get("category", ""),
            importance=kp.get("importance", "normal"),
        )
        db.add(db_kp)
        saved_kps.append(kp)
    await db.flush()

    # 4. 试题生成（Step 2）
    try:
        questions_data = await deepseek_service.generate_questions(
            knowledge_points=saved_kps,
            question_types=req.question_types,
            difficulties=req.difficulties,
            total_questions=req.total_questions,
        )
    except ValueError as e:
        raise HTTPException(status_code=502, detail=f"试题生成格式异常: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"试题生成失败: {str(e)}")

    # 4.1 试题内容校验，过滤非法题目
    valid_questions = [q for q in questions_data if validate_question(q)]
    if not valid_questions:
        raise HTTPException(status_code=500, detail="AI 生成的试题格式校验全部未通过，请稍后重试")
    skipped = len(questions_data) - len(valid_questions)

    # 5. 创建试卷
    title = req.title or f"试卷-{note.id}"
    exam = Exam(
        note_id=note.id,
        title=title,
        config={
            "question_types": req.question_types,
            "difficulties": req.difficulties,
            "total_questions": req.total_questions,
        },
    )
    db.add(exam)
    await db.flush()

    # 6. 保存试题
    saved_questions = []
    for i, q in enumerate(valid_questions):
        question = Question(
            exam_id=exam.id,
            question_type=q["question_type"],
            difficulty=q["difficulty"],
            content=q.get("content", {}),
            answer=str(q.get("answer", "")),
            explanation=q.get("explanation", ""),
            order_num=i + 1,
        )
        db.add(question)
        saved_questions.append(question)

    await db.commit()
    await db.refresh(exam)

    msg = f"试卷生成成功，共 {len(saved_questions)} 题"
    if skipped > 0:
        msg += f"（已过滤 {skipped} 道格式不合规试题）"

    return APIResponse(
        success=True,
        message=msg,
        data={
            "exam_id": exam.id,
            "question_count": len(saved_questions),
            "skipped": skipped,
        },
    )


@router.get("", response_model=APIResponse)
async def list_exams(db: AsyncSession = Depends(get_db)):
    """获取试卷列表"""
    result = await db.execute(select(Exam).order_by(Exam.created_at.desc()))
    exams = result.scalars().all()

    items = []
    for exam in exams:
        q_result = await db.execute(select(Question).where(Question.exam_id == exam.id))
        q_count = len(q_result.scalars().all())
        items.append({
            "id": exam.id,
            "note_id": exam.note_id,
            "title": exam.title,
            "created_at": exam.created_at.isoformat(),
            "question_count": q_count,
        })

    return APIResponse(success=True, data=items)


@router.get("/{exam_id}", response_model=APIResponse)
async def get_exam(exam_id: str, db: AsyncSession = Depends(get_db)):
    """获取试卷详情（含全部试题）"""
    result = await db.execute(select(Exam).where(Exam.id == exam_id))
    exam = result.scalar_one_or_none()
    if not exam:
        raise HTTPException(status_code=404, detail="试卷不存在")

    q_result = await db.execute(
        select(Question).where(Question.exam_id == exam_id).order_by(Question.order_num)
    )
    questions = q_result.scalars().all()

    return APIResponse(
        success=True,
        data={
            "id": exam.id,
            "note_id": exam.note_id,
            "title": exam.title,
            "config": exam.config,
            "created_at": exam.created_at.isoformat(),
            "questions": [
                {
                    "id": q.id,
                    "question_type": q.question_type,
                    "difficulty": q.difficulty,
                    "content": q.content,
                    "answer": q.answer,
                    "explanation": q.explanation,
                    "order_num": q.order_num,
                }
                for q in questions
            ],
        },
    )


@router.delete("/{exam_id}", response_model=APIResponse)
async def delete_exam(exam_id: str, db: AsyncSession = Depends(get_db)):
    """删除试卷"""
    result = await db.execute(select(Exam).where(Exam.id == exam_id))
    exam = result.scalar_one_or_none()
    if not exam:
        raise HTTPException(status_code=404, detail="试卷不存在")

    await db.delete(exam)
    await db.commit()

    return APIResponse(success=True, message="试卷已删除")
