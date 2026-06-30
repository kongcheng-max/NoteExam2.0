# BUG-027: OCR 失败后将错误文本写入笔记内容

**发现日期**: 2026-06-29
**优先级**: P1
**位置**: `app/backend/routers/files.py:44` `_process_file_ocr`
**状态**: 待修复

## 问题描述

OCR 失败时，`_process_file_ocr` 直接将错误信息写入 `note.content`：

```python
except Exception as e:
    note.content = f"[OCR failed: {str(e)}]"
    await db.commit()
```

后续用户点击"生成试卷"时，AI 会对 `"[OCR failed: ...]"` 这段错误文本进行知识点提取和出题，而不是给出"OCR 识别失败"的友好提示。

## 影响

- 用户看到 OCR 失败后点生成试卷，会生成基于错误信息的废题
- 浪费 API 调用费用

## 修复建议

OCR 失败时设置一个标识字段而非覆盖 content，或在生成试卷前检查 content 是否为错误文本并给出明确提示。
