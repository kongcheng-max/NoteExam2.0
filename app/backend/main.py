"""NoteExam 后端入口 —— FastAPI 应用"""
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from database import init_db
from routers.notes import router as notes_router
from routers.exams import router as exams_router
from routers.files import router as files_router
from routers.wrong_answers import router as wrong_answers_router
from routers.auth import router as auth_router
from routers.reports import router as reports_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # 启动时：初始化数据库
    await init_db()
    yield


app = FastAPI(
    title="NoteExam API",
    description="基于 AI 的智能出题工具后端服务",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS 中间件
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 注册路由
app.include_router(notes_router)
app.include_router(files_router)
app.include_router(exams_router)
app.include_router(wrong_answers_router)
app.include_router(auth_router)
app.include_router(reports_router)


@app.get("/api/health")
async def health_check():
    return {"status": "ok", "message": "NoteExam API is running"}
