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
    file_path = Column(String(500), nullable=True)  # V1.1: ????????
    original_filename = Column(String(300), nullable=True)  # V1.1: ?????
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
