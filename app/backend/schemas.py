"""Pydantic 请求/响应模型"""
from datetime import datetime
from typing import Optional, Any, Literal
from pydantic import BaseModel, Field


# ============ 笔记 ============

class NoteCreate(BaseModel):
    content: str = Field(..., min_length=1, max_length=50000, description="笔记文本内容, 最长50000字符")
    note_type: Literal["text", "image", "pdf"] = "text"




class NoteUpdate(BaseModel):
    content: Optional[str] = Field(None, min_length=1, max_length=50000, description="更新后的笔记内容")

class NoteResponse(BaseModel):
    id: str
    content: str
    note_type: str
    file_path: Optional[str] = None
    original_filename: Optional[str] = None
    ocr_status: str = "pending"
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
        default=["single_choice", "multi_choice", "true_false", "fill_blank"],
        description="题型列表"
    )
    difficulties: list[str] = Field(
        default=["basic", "advanced", "challenge"],
        description="难度列表"
    )
    total_questions: int = Field(default=20, ge=5, le=50, description="题目总数")
    difficulty_ratios: Optional[dict] = Field(default=None, description="难度占比，如 {'basic': 0.3, 'advanced': 0.4, 'challenge': 0.3}")


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


# ============ V1.1: ???? ============

class NoteUploadResponse(BaseModel):
    id: str
    note_type: str
    original_filename: Optional[str] = None


# ============ V1.1: ??????? ============

class KnowledgePointCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200, description="?????")
    category: str = Field(default="", max_length=100)
    importance: str = Field(default="normal", pattern="^(high|normal|low)$")


class KnowledgePointUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    category: Optional[str] = Field(None, max_length=100)
    importance: Optional[str] = Field(None, pattern="^(high|normal|low)$")


# ============ V1.1: ???? ============

class QuestionUpdate(BaseModel):
    question_type: Optional[str] = None
    difficulty: Optional[str] = None
    content: Optional[dict] = None
    answer: Optional[str] = None
    explanation: Optional[str] = None
    order_num: Optional[int] = None


class QuestionReorder(BaseModel):
    question_ids: list[str] = Field(..., description="?????????ID??")

# ============ V1.2: 错题回顾 ============

class WrongAnswerCreate(BaseModel):
    user_answer: str = Field(default="", description="用户错误作答")
    note: str = Field(default="", max_length=500, description="用户备注")

class WrongAnswerResponse(BaseModel):
    id: str
    question_id: str
    exam_id: str
    user_answer: str
    note: str
    review_count: int
    created_at: datetime
    last_reviewed_at: Optional[datetime] = None
    question: Optional[QuestionResponse] = None

    model_config = {"from_attributes": True}

# ============ V1.2: 用户账号 ============

class UserRegister(BaseModel):
    email: str = Field(..., min_length=5, max_length=200, description="邮箱")
    password: str = Field(..., min_length=6, max_length=100, description="密码")

class UserLogin(BaseModel):
    email: str = Field(..., min_length=5, max_length=200)
    password: str = Field(..., min_length=6, max_length=100)


class PasswordChange(BaseModel):
    old_password: str = Field(..., min_length=1, max_length=100, description="原密码")
    new_password: str = Field(..., min_length=6, max_length=100, description="新密码,至少6位")

class UserResponse(BaseModel):
    id: str
    email: str
    created_at: datetime

    model_config = {"from_attributes": True}
