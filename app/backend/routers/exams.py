"""试卷相关 API 路由 —— 根据 tech-spec.md 第4节数据流设计"""
import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from database import get_db
from models import Note, KnowledgePoint, Exam, Question
from schemas import (
    ExamGenerateRequest, ExamResponse, ExamListItem, QuestionResponse,
    KnowledgePointResponse, APIResponse, QuestionUpdate, QuestionReorder,
)
from services.deepseek import deepseek_service

router = APIRouter(prefix="/api/exams", tags=["试卷管理"])

# 合法题型与难度
VALID_QUESTION_TYPES = {"single_choice", "multi_choice", "fill_blank", "true_false", "short_answer", "essay"}
VALID_DIFFICULTIES = {"basic", "advanced", "challenge"}
CHOICE_TYPES = {"single_choice", "multi_choice"}


def normalize_answer(raw_answer) -> str:
    """BUG-011: 规范化答案格式，处理列表/布尔等类型"""
    if isinstance(raw_answer, list):
        return ",".join(str(x).strip() for x in raw_answer)
    if isinstance(raw_answer, bool):
        return str(raw_answer).lower()
    return str(raw_answer).strip()


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
        min_opts = 3 if q_type == "multi_choice" else 2
        if not isinstance(options, list) or len(options) < min_opts:
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
            content=q["content"],
            answer=normalize_answer(q.get("answer", "")),
            explanation=q.get("explanation", ""),
            order_num=i + 1,
        )
        db.add(question)
        saved_questions.append(question)

    await db.commit()
    await db.refresh(exam)

    return APIResponse(
        success=True,
        message=f"试卷生成成功（过滤 {skipped} 道不合规题目）" if skipped else "试卷生成成功",
        data={
            "id": exam.id,
            "title": exam.title,
            "config": exam.config,
            "question_count": len(saved_questions),
        },
    )


@router.get("", response_model=APIResponse)
async def list_exams(db: AsyncSession = Depends(get_db)):
    """获取试卷列表"""
    result = await db.execute(select(Exam).order_by(Exam.created_at.desc()))
    exams = result.scalars().all()

    return APIResponse(
        success=True,
        data=[ExamListItem.model_validate(e).model_dump(mode="json") for e in exams],
    )


@router.get("/{exam_id}", response_model=APIResponse)
async def get_exam(exam_id: str, db: AsyncSession = Depends(get_db)):
    """获取单份试卷详情（含试题）"""
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
            "title": exam.title,
            "config": exam.config,
            "created_at": exam.created_at.isoformat() if exam.created_at else None,
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


# ============ V1.1: 试卷编辑 ============
# BUG-029: reorder 路由必须在 {question_id} 之前注册，否则 "reorder" 被当作 question_id 匹配

@router.put("/{exam_id}/questions/reorder", response_model=APIResponse)
async def reorder_questions(
    exam_id: str, req: QuestionReorder, db: AsyncSession = Depends(get_db)
):
    """调整题目顺序"""
    for i, qid in enumerate(req.question_ids):
        result = await db.execute(
            select(Question).where(Question.id == qid, Question.exam_id == exam_id)
        )
        q = result.scalar_one_or_none()
        if q:
            q.order_num = i + 1

    await db.commit()

    return APIResponse(success=True, message="题目顺序已更新")


@router.put("/{exam_id}/questions/{question_id}", response_model=APIResponse)
async def update_question(
    exam_id: str, question_id: str, req: QuestionUpdate, db: AsyncSession = Depends(get_db)
):
    """编辑单道试题"""
    result = await db.execute(
        select(Question).where(Question.id == question_id, Question.exam_id == exam_id)
    )
    q = result.scalar_one_or_none()
    if not q:
        raise HTTPException(status_code=404, detail="试题不存在")

    if req.question_type is not None:
        q.question_type = req.question_type
    if req.difficulty is not None:
        q.difficulty = req.difficulty
    if req.content is not None:
        q.content = req.content
    if req.answer is not None:
        q.answer = req.answer
    if req.explanation is not None:
        q.explanation = req.explanation
    if req.order_num is not None:
        q.order_num = req.order_num

    await db.commit()
    await db.refresh(q)

    return APIResponse(
        success=True,
        message="试题修改成功",
        data={
            "id": q.id,
            "question_type": q.question_type,
            "difficulty": q.difficulty,
            "content": q.content,
            "answer": q.answer,
            "explanation": q.explanation,
            "order_num": q.order_num,
        },
    )


@router.delete("/{exam_id}/questions/{question_id}", response_model=APIResponse)
async def delete_question(
    exam_id: str, question_id: str, db: AsyncSession = Depends(get_db)
):
    """删除单道试题"""
    result = await db.execute(
        select(Question).where(Question.id == question_id, Question.exam_id == exam_id)
    )
    q = result.scalar_one_or_none()
    if not q:
        raise HTTPException(status_code=404, detail="试题不存在")

    await db.delete(q)
    await db.commit()

    return APIResponse(success=True, message="试题已删除")


# ============ V1.1: 试卷导出 ============

@router.get("/{exam_id}/export", response_model=APIResponse)
async def export_exam(
    exam_id: str,
    format: str = "html",
    with_answers: bool = True,
    db: AsyncSession = Depends(get_db),
):
    """导出试卷为 HTML 或 PDF"""
    from fastapi.responses import HTMLResponse, Response

    result = await db.execute(select(Exam).where(Exam.id == exam_id))
    exam = result.scalar_one_or_none()
    if not exam:
        raise HTTPException(status_code=404, detail="试卷不存在")

    q_result = await db.execute(
        select(Question).where(Question.exam_id == exam_id).order_by(Question.order_num)
    )
    questions = q_result.scalars().all()
    q_list = [
        {
            "question_type": q.question_type,
            "difficulty": q.difficulty,
            "content": q.content,
            "answer": q.answer,
            "explanation": q.explanation,
        }
        for q in questions
    ]

    from services.export import export_exam_html

    if format == "pdf":
        try:
            from services.export import export_exam_pdf
            pdf_bytes = export_exam_pdf(exam.title, q_list, with_answers)
            return Response(
                content=pdf_bytes,
                media_type="application/pdf",
                headers={"Content-Disposition": f"attachment; filename={exam.title}.pdf"},
            )
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"PDF 导出失败（需安装 GTK 运行时）: {str(e)}")

    html = export_exam_html(exam.title, q_list, with_answers)
    return HTMLResponse(content=html)


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
