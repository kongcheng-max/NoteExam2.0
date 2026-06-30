"""数据库连接与会话管理"""
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from config import DATABASE_URL

engine = create_async_engine(DATABASE_URL, echo=False)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

# BUG-039: SQLite 默认不启用外键约束，需在每个连接上手动开启
from sqlalchemy import event

@event.listens_for(engine.sync_engine, "connect")
def _set_sqlite_pragma(dbapi_connection, connection_record):
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys = ON")
    cursor.close()


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncSession:
    async with async_session() as session:
        try:
            yield session
        finally:
            await session.close()


async def init_db():
    from sqlalchemy import text
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        # BUG-036: 确保 ocr_status 列存在（兼容已有数据库）
        try:
            await conn.execute(text("ALTER TABLE notes ADD COLUMN ocr_status VARCHAR(20) DEFAULT 'pending'"))
        except Exception:
            pass  # 列已存在，忽略
