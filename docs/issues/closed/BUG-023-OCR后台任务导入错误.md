# BUG-023: OCR 后台任务导入错误导致崩溃

**发现日期**: 2026-06-29
**优先级**: P0
**位置**: `app/backend/routers/files.py:29` + `app/backend/database.py`
**状态**: 待修复

## 问题描述

`_process_file_ocr` 函数中 `from database import SessionLocal` 会直接报 `ImportError`，因为 `database.py` 的实际导出是 `async_session`（小写），不存在 `SessionLocal`。

```python
# routers/files.py:29
async def _process_file_ocr(note_id: str, file_path: str, note_type: str):
    from database import SessionLocal  # ← 不存在！
    async with SessionLocal() as db:
```

`database.py` 实际导出的会话工厂是 `async_session`：
```python
# database.py
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
```

## 影响

- 图片/PDF 上传后 OCR 后台任务直接崩溃
- 用户上传文件后永远等不到 OCR 结果
- 笔记 content 保持为空字符串，后续无法生成试卷

## 修复建议

```python
# routers/files.py
async def _process_file_ocr(note_id: str, file_path: str, note_type: str):
    from database import async_session  # 改为小写
    async with async_session() as db:
```
