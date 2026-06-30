"""试卷相关 API 路由 —— 根据 tech-spec.md 第4节数据流设计"""
import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from database import get_db
from models import Note, KnowledgePoint, Exam, Question, User, WrongAnswer, ExamResult
from schemas import (
    ExamGenerateRequest, ExamResponse, ExamListItem, QuestionResponse,
    KnowledgePointResponse, APIResponse, QuestionUpdate, QuestionReorder,
    ExamSubmitRequest, ExamSubmitResponse, ExamResultResponse, ExamResultDetailResponse,
    WrongAnswerCreate,
)
from routers.auth import get_current_user
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
async def generate_exam(req: ExamGenerateRequest, db: AsyncSession = Depends(get_db), user: User | None = Depends(get_current_user)):
    """生成试卷 —— 核心流程：验证笔记 → 知识提取 → 试题生成 → 存库"""
    # 1. 验证笔记存在
    result = await db.execute(select(Note).where(Note.id == req.note_id))
    note = result.scalar_one_or_none()
    if not note:
        raise HTTPException(status_code=404, detail="笔记不存在")
    if user and note.user_id != "default" and note.user_id != user.id:
        raise HTTPException(status_code=403, detail="无权访问此笔记")

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
            difficulty_ratios=req.difficulty_ratios,
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
async def list_exams(db: AsyncSession = Depends(get_db), user: User | None = Depends(get_current_user)):
    """获取试卷列表"""
    # BUG-044: 按 user_id 过滤（通过关联 Note 表）
    note_filter = Note.user_id.in_([user.id, "default"]) if user else Note.user_id == "default"
    result = await db.execute(
        select(Exam).join(Note, Exam.note_id == Note.id).where(note_filter).order_by(Exam.created_at.desc())
    )
    exams = result.scalars().all()

    # BUG-040: 查询每份试卷的试题数
    question_counts = {}
    if exams:
        exam_ids = [e.id for e in exams]
        q_result = await db.execute(
            select(Question.exam_id, func.count(Question.id))
            .where(Question.exam_id.in_(exam_ids))
            .group_by(Question.exam_id)
        )
        question_counts = dict(q_result.all())

    data = []
    for e in exams:
        item = ExamListItem.model_validate(e).model_dump(mode="json")
        item["question_count"] = question_counts.get(e.id, 0)
        data.append(item)

    return APIResponse(
        success=True,
        data=data,
    )


@router.get("/{exam_id}", response_model=APIResponse)
async def get_exam(exam_id: str, db: AsyncSession = Depends(get_db), user: User | None = Depends(get_current_user)):
    """获取单份试卷详情（含试题）"""
    result = await db.execute(
        select(Exam).join(Note, Exam.note_id == Note.id).where(
            Exam.id == exam_id,
            Note.user_id.in_([user.id, "default"]) if user else Note.user_id == "default"
        )
    )
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
    exam_id: str, req: QuestionReorder, db: AsyncSession = Depends(get_db), user: User | None = Depends(get_current_user)
):
    """调整题目顺序"""
    # Verify exam access
    exam_chk = await db.execute(
        select(Exam).join(Note, Exam.note_id == Note.id).where(
            Exam.id == exam_id,
            Note.user_id.in_([user.id, "default"]) if user else Note.user_id == "default"
        )
    )
    if not exam_chk.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="试卷不存在")
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
    exam_id: str, question_id: str, req: QuestionUpdate, db: AsyncSession = Depends(get_db), user: User | None = Depends(get_current_user)
):
    """编辑单道试题"""
    # Verify exam access
    exam_chk2 = await db.execute(
        select(Exam).join(Note, Exam.note_id == Note.id).where(
            Exam.id == exam_id,
            Note.user_id.in_([user.id, "default"]) if user else Note.user_id == "default"
        )
    )
    if not exam_chk2.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="试卷不存在")
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
    exam_id: str, question_id: str, db: AsyncSession = Depends(get_db), user: User | None = Depends(get_current_user)
):
    """删除单道试题"""
    # Verify exam access
    exam_chk3 = await db.execute(
        select(Exam).join(Note, Exam.note_id == Note.id).where(
            Exam.id == exam_id,
            Note.user_id.in_([user.id, "default"]) if user else Note.user_id == "default"
        )
    )
    if not exam_chk3.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="试卷不存在")
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
    user: User | None = Depends(get_current_user),
):
    """导出试卷为 HTML 或 PDF"""
    from fastapi.responses import HTMLResponse, Response

    result = await db.execute(
        select(Exam).join(Note, Exam.note_id == Note.id).where(
            Exam.id == exam_id,
            Note.user_id.in_([user.id, "default"]) if user else Note.user_id == "default"
        )
    )
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
async def delete_exam(exam_id: str, db: AsyncSession = Depends(get_db), user: User | None = Depends(get_current_user)):
    """删除试卷"""
    result = await db.execute(select(Exam).where(Exam.id == exam_id))
    exam = result.scalar_one_or_none()
    if not exam:
        raise HTTPException(status_code=404, detail="试卷不存在")

    # BUG-048: 单独查询 Note 获取 user_id，避免 async 懒加载 MissingGreenlet 错误
    note_result = await db.execute(select(Note).where(Note.id == exam.note_id))
    note = note_result.scalar_one_or_none()
    if note and user and note.user_id != "default" and note.user_id != user.id:
        raise HTTPException(status_code=403, detail="无权删除此试卷")
    if note and note.user_id == "default":
        raise HTTPException(status_code=403, detail="无权删除公共试卷")

    await db.delete(exam)
    await db.commit()

    return APIResponse(success=True, message="试卷已删除")

# ============ V1.4: 答题提交与历史结果 ============

def _grade_question(q: Question, user_answer: str) -> bool:
    """V1.4: 后端判分逻辑（与前端 checkAnswer 一致）"""
    ua = (user_answer or "").strip()
    if not ua:
        return False
    qtype = q.question_type
    correct = (q.answer or "").strip()

    if qtype in ("single_choice", "true_false"):
        return ua.upper() == correct.upper()
    if qtype == "multi_choice":
        user_set = set(s.strip().upper() for s in ua.split(",") if s.strip())
        correct_set = set(s.strip().upper() for s in correct.split(",") if s.strip())
        return user_set == correct_set
    if qtype == "fill_blank":
        # BUG-051: 支持 || 分隔多空位逐空比对
        user_parts = [p.strip() for p in ua.split("||")]
        correct_parts = [p.strip() for p in correct.split("||")]
        if len(correct_parts) > 1 or len(user_parts) > 1:
            if len(user_parts) != len(correct_parts):
                return False
            return all(
                up.replace(" ", "") == cp.replace(" ", "") or up.replace(" ", "") in cp.replace(" ", "")
                for up, cp in zip(user_parts, correct_parts)
            )
        ua_clean = ua.replace(" ", "")
        ca_clean = correct.replace(" ", "")
        return ua_clean == ca_clean or ua_clean in ca_clean
    # short_answer / essay: 有输入即有效
    return len(ua) > 0


@router.post("/{exam_id}/submit", response_model=APIResponse)
async def submit_exam(
    exam_id: str,
    req: ExamSubmitRequest,
    db: AsyncSession = Depends(get_db),
    user: User | None = Depends(get_current_user),
):
    """V1.4: 提交答题，返回判分结果，错题自动入库"""
    result = await db.execute(
        select(Exam).join(Note, Exam.note_id == Note.id).where(
            Exam.id == exam_id,
            Note.user_id.in_([user.id, "default"]) if user else Note.user_id == "default"
        )
    )
    exam = result.scalar_one_or_none()
    if not exam:
        raise HTTPException(status_code=404, detail="试卷不存在")

    q_result = await db.execute(
        select(Question).where(Question.exam_id == exam_id).order_by(Question.order_num)
    )
    questions = q_result.scalars().all()
    if not questions:
        raise HTTPException(status_code=422, detail="试卷无试题")

    results = {}
    correct_count = 0
    wrong_ids = []

    for q in questions:
        user_answer = req.answers.get(q.id, "")
        is_correct = _grade_question(q, user_answer)
        results[q.id] = "correct" if is_correct else "wrong"
        if is_correct:
            correct_count += 1
        else:
            wrong_ids.append(q.id)

    total = len(questions)
    score = round(correct_count / total * 100) if total > 0 else 0

    # 保存答题记录
    uid = user.id if user else "default"
    exam_result = ExamResult(
        exam_id=exam_id,
        user_id=uid,
        answers=req.answers,
        results=results,
        total_questions=total,
        correct_count=correct_count,
        score=score,
    )
    db.add(exam_result)

    # 错题自动入库
    for qid in wrong_ids:
        existing = await db.execute(
            select(WrongAnswer).where(WrongAnswer.question_id == qid)
        )
        if not existing.scalar_one_or_none():
            wa = WrongAnswer(
                question_id=qid,
                exam_id=exam_id,
                user_answer=req.answers.get(qid, ""),
            )
            db.add(wa)

    await db.commit()

    return APIResponse(
        success=True,
        message=f"得分 {score} 分（{correct_count}/{total}）",
        data=ExamSubmitResponse(
            score=score,
            total=total,
            correct=correct_count,
            results=results,
            wrong_question_ids=wrong_ids,
        ).model_dump(mode="json"),
    )


@router.get("/{exam_id}/result", response_model=APIResponse)
async def get_exam_result(
    exam_id: str,
    db: AsyncSession = Depends(get_db),
    user: User | None = Depends(get_current_user),
):
    """V1.4: 获取历史答题结果"""
    uid = user.id if user else "default"
    result = await db.execute(
        select(ExamResult)
        .where(ExamResult.exam_id == exam_id, ExamResult.user_id == uid)
        .order_by(ExamResult.created_at.desc())
    )
    items = result.scalars().all()

    return APIResponse(
        success=True,
        data=[
            ExamResultDetailResponse.model_validate(r).model_dump(mode="json")
            for r in items
        ],
    )

