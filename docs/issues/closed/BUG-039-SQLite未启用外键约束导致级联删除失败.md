# BUG-039: SQLite未启用外键约束导致级联删除失败

**发现日期**: 2026-06-30
**优先级**: P1
**位置**: `app/backend/database.py:6`
**状态**: 待修复

## 问题描述

SQLite 默认不启用外键约束。`models.py` 中 `WrongAnswer` 的 `ForeignKey(ondelete="CASCADE")` 在 SQLite 上不会自动触发：

```python
# WrongAnswer 依赖级联删除
question_id = Column(ForeignKey("questions.id", ondelete="CASCADE"))
exam_id = Column(ForeignKey("exams.id", ondelete="CASCADE"))
```

但 `database.py` 从未执行 `PRAGMA foreign_keys = ON`。

## 影响

- 删除试卷后，关联的错题记录仍然残留在数据库中（孤立数据）
- 删除试题后，错题记录也不会级联清除
- `wrong_answers` 表会积累垃圾数据

## 验证

```
标记一道错题 → 删除对应试卷 → GET /api/wrong-answers → 错题记录仍存在（应为0）
```

## 修复建议

在引擎创建后启用外键：

```python
# database.py init_db()
async def init_db():
    from sqlalchemy import text, event
    async with engine.begin() as conn:
        await conn.execute(text("PRAGMA foreign_keys = ON"))
        await conn.run_sync(Base.metadata.create_all)
```
