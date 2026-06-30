# BUG-038: files_router与notes_router前缀冲突导致PUT路由丢失

**发现日期**: 2026-06-30
**优先级**: P1
**位置**: `app/backend/main.py:31-32` + `app/backend/routers/notes.py:25` + `app/backend/routers/files.py:13`
**状态**: 待修复

## 问题描述

`notes_router` 和 `files_router` 都注册了相同的前缀 `prefix="/api/notes"`，且 `files_router` 在 `main.py` 中后注册。FastAPI 处理后缀时，`notes_router` 的 `PUT /{note_id}` 路由被 `files_router` 覆盖/丢弃。

```python
# main.py:30-32
app.include_router(notes_router)  # prefix="/api/notes"
app.include_router(files_router)  # prefix="/api/notes" ← 冲突
```

OpenAPI 中实际注册的 `/api/notes/{note_id}` 路由仅剩 GET 和 DELETE，PUT 丢失：

```
/api/notes          → get, post       (来自 notes_router)
/api/notes/upload   → post            (来自 files_router)
/api/notes/{note_id} → get, delete    (PUT 丢失！)
```

## 影响

- 前端 OCR 文本编辑保存功能报 405 Method Not Allowed
- 用户无法修正 OCR 识别结果

## 修复建议

方案一：将 `files_router` 前缀改为 `/api/files`（推荐，职责分离）
```python
# routers/files.py
router = APIRouter(prefix="/api/files", tags=["file-upload"])
```

方案二：将 `/upload` 路由合并到 `notes_router`
