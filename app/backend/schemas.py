"""Pydantic 请求/响应模型"""
from datetime import datetime
from typing import Optional, Any, Literal
from pydantic import BaseModel, Field


# ============ 笔记 ============

class NoteCreate(BaseModel):
    content: str = Field(..., min_length=1, max_length=50000, description="笔记文本内容, 最长50000字符")
    note_type: Literal["text", "image", "pdf"] = "text"


class NoteResponse(BaseModel):
    id: str
    content: str
    note_type: str
    user_id: str
    created_at: datetime

    model_config = {"from_attributes": True}


# ============ 知识点 ============

class KnowledgePointResponse(BaseModel):
    id: str
    note_id: str
    name: str
    category: str
    importance: str
    created_at: datetime

    model_config = {"from_attributes": True}


class KnowledgePointExtract(BaseModel):
    name: str
    category: str = ""
    importance: str = "normal"


class KnowledgeExtractResult(BaseModel):
    knowledge_points: list[KnowledgePointExtract]


# ============ 试卷 & 试题 ============

class ExamGenerateRequest(BaseModel):
    note_id: str = Field(..., description="笔记ID")
    title: str = Field(default="", description="试卷标题")
    question_types: list[str] = Field(
        default=["single_choice", "multi_choice", "true_false", "fill_blank", "short_answer"],
        description="题型列表"
    )
    difficulties: list[str] = Field(
        default=["basic", "advanced", "challenge"],
        description="难度列表"
    )
    total_questions: int = Field(default=20, ge=5, le=50, description="题目总数")


class QuestionContent(BaseModel):
    stem: str
    options: Optional[list[str]] = None


class QuestionResponse(BaseModel):
    id: str
    exam_id: str
    question_type: str
    difficulty: str
    content: Any
    answer: str
    explanation: str
    order_num: int

    model_config = {"from_attributes": True}


class ExamResponse(BaseModel):
    id: str
    note_id: str
    title: str
    config: Any
    created_at: datetime
    questions: list[QuestionResponse] = []

    model_config = {"from_attributes": True}


class ExamListItem(BaseModel):
    id: str
    note_id: str
    title: str
    created_at: datetime
    question_count: int = 0

    model_config = {"from_attributes": True}


# ============ 通用 ============

class APIResponse(BaseModel):
    success: bool
    message: str = ""
    data: Any = None
