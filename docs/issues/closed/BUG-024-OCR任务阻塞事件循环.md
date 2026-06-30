# BUG-024: OCR 任务阻塞事件循环

**发现日期**: 2026-06-29
**优先级**: P1
**位置**: `app/backend/routers/files.py:63` `asyncio.create_task(_process_file_ocr(...))`
**状态**: 待修复

## 问题描述

`_process_file_ocr` 通过 `asyncio.create_task` 在事件循环中运行，但其内部调用的 `ocr_service.recognize_image()` 和 `pdf_parser.extract_text()` 都是同步阻塞函数。这会导致事件循环被阻塞，影响其他请求的响应。

```python
# routers/files.py:63
asyncio.create_task(_process_file_ocr(note.id, saved_path, note_type))
```

OCR 处理通常需要数秒到数十秒，期间整个 FastAPI 事件循环被占用。

## 影响

- 文件上传后其他 API 请求出现明显延迟
- 高并发下响应时间不可控

## 修复建议

使用 `run_in_executor` 将同步阻塞操作放到线程池：

```python
import asyncio
from concurrent.futures import ThreadPoolExecutor

executor = ThreadPoolExecutor(max_workers=2)

async def _process_file_ocr(note_id: str, file_path: str, note_type: str):
    from database import async_session
    async with async_session() as db:
        # ...
        loop = asyncio.get_running_loop()
        if note_type == "image":
            text = await loop.run_in_executor(executor, ocr_service.recognize_image, file_path)
        else:
            text = await loop.run_in_executor(executor, pdf_parser.extract_text, file_path)
```
