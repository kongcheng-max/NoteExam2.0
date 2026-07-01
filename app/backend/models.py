"""数据库模型定义"""
import uuid
from datetime import datetime
from sqlalchemy import Column, String, Text, Integer, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from database import Base


def gen_id():
    return uuid.uuid4().hex[:12]


class Note(Base):
    __tablename__ = "notes"

    id = Column(String(20), primary_key=True, default=gen_id)
    content = Column(Text, nullable=False, default="")
    note_type = Column(String(10), nullable=False, default="text")  # text / image / pdf
    file_path = Column(String(500), nullable=True)  # V1.1: 文件路径
    original_filename = Column(String(300), nullable=True)  # V1.1: 原始文件名
    ocr_status = Column(String(20), default="pending")  # pending / processing / done / failed
    user_id = Column(String(20), default="default")
    created_at = Column(DateTime, default=datetime.utcnow)

    knowledge_points = relationship("KnowledgePoint", back_populates="note", cascade="all, delete-orphan")
    exams = relationship("Exam", back_populates="note", cascade="all, delete-orphan")


class KnowledgePoint(Base):
    __tablename__ = "knowledge_points"

    id = Column(String(20), primary_key=True, default=gen_id)
    note_id = Column(String(20), ForeignKey("notes.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(200), nullable=False)
    category = Column(String(100), default="")
    importance = Column(String(20), default="normal")  # high / normal / low
    created_at = Column(DateTime, default=datetime.utcnow)

    note = relationship("Note", back_populates="knowledge_points")


class Exam(Base):
    __tablename__ = "exams"

    id = Column(String(20), primary_key=True, default=gen_id)
    note_id = Column(String(20), ForeignKey("notes.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(200), nullable=False)
    config = Column(JSON, default=dict)  # 试卷配置：题型、难度、数量等
    created_at = Column(DateTime, default=datetime.utcnow)

    note = relationship("Note", back_populates="exams")
    questions = relationship("Question", back_populates="exam", cascade="all, delete-orphan")


class Question(Base):
    __tablename__ = "questions"

    id = Column(String(20), primary_key=True, default=gen_id)
    exam_id = Column(String(20), ForeignKey("exams.id", ondelete="CASCADE"), nullable=False)
    question_type = Column(String(20), nullable=False)  # single_choice / multi_choice / fill_blank / true_false / short_answer / essay
    difficulty = Column(String(10), nullable=False)  # basic / advanced / challenge
    content = Column(JSON, nullable=False)  # {"stem": "...", "options": [...]}
    answer = Column(Text, nullable=False)
    explanation = Column(Text, default="")
    order_num = Column(Integer, default=0)

    exam = relationship("Exam", back_populates="questions")

class WrongAnswer(Base):
    """V1.2: 错题记录"""
    __tablename__ = "wrong_answers"

    id = Column(String(20), primary_key=True, default=gen_id)
    question_id = Column(String(20), ForeignKey("questions.id", ondelete="CASCADE"), nullable=False)
    exam_id = Column(String(20), ForeignKey("exams.id", ondelete="CASCADE"), nullable=False)
    user_answer = Column(Text, default="")  # 用户错误作答
    note = Column(Text, default="")  # 用户备注
    review_count = Column(Integer, default=0)  # 复习次数
    created_at = Column(DateTime, default=datetime.utcnow)
    last_reviewed_at = Column(DateTime, nullable=True)

    question = relationship("Question")
    exam = relationship("Exam")


class ExamResult(Base):
    """V1.4: 答题提交记录"""
    __tablename__ = "exam_results"

    id = Column(String(20), primary_key=True, default=gen_id)
    exam_id = Column(String(20), ForeignKey("exams.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(String(20), default="default")
    answers = Column(JSON, default=dict)  # {question_id: user_answer}
    results = Column(JSON, default=dict)  # {question_id: "correct"|"wrong"}
    total_questions = Column(Integer, default=0)
    correct_count = Column(Integer, default=0)
    score = Column(Integer, default=0)  # 0-100
    created_at = Column(DateTime, default=datetime.utcnow)

    exam = relationship("Exam")
class User(Base):
    """V1.2: 用户账号"""
    __tablename__ = "users"

    id = Column(String(20), primary_key=True, default=gen_id)
    email = Column(String(200), unique=True, nullable=False)
    password_hash = Column(String(200), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class StudyReport(Base):
    """V2.0: 学习报告"""
    __tablename__ = "study_reports"

    id = Column(String(20), primary_key=True, default=gen_id)
    user_id = Column(String(20), default="default")
    title = Column(String(200), nullable=False)
    content = Column(JSON, nullable=False, default=dict)  # AI 生成的报告内容
    exam_ids = Column(JSON, default=list)  # 关联的试卷ID列表
    wrong_answer_ids = Column(JSON, default=list)  # 关联的错题ID列表
    total_exams = Column(Integer, default=0)
    total_questions = Column(Integer, default=0)
    avg_score = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)


class WrongAnswerAnalysis(Base):
    """V2.0: 错题智能分析结果"""
    __tablename__ = "wrong_answer_analyses"

    id = Column(String(20), primary_key=True, default=gen_id)
    user_id = Column(String(20), default="default")
    analysis_data = Column(JSON, nullable=False, default=dict)  # AI 分析结果
    total_wrong = Column(Integer, default=0)
    weak_kps = Column(JSON, default=list)  # 薄弱知识点列表
    created_at = Column(DateTime, default=datetime.utcnow)
