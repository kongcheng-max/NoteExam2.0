# BUG-036: OCR使用印刷体API无法识别手写内容，且失败无声

**发现日期**: 2026-06-30
**优先级**: P1
**位置**: `app/backend/services/ocr.py:21` + `app/backend/routers/files.py:45`
**状态**: 待修复

## 问题描述

### 问题一：使用了错误的 OCR API
`ocr_service.recognize_image()` 调用的是百度 `basicAccurate` 接口，该接口专为**印刷体**设计，对手写内容识别率极低甚至完全失败。百度有专门的 `handwriting` 接口用于手写识别。

```python
# services/ocr.py:21 — 当前
result = self.client.basicAccurate(image_data)  # 印刷体 API

# 应改为
result = self.client.handwriting(image_data)    # 手写体 API
```

### 问题二：OCR 失败无用户反馈
BUG-027 修复将异常处理改为 `except Exception: pass`，导致 OCR 失败时用户完全不知情：
- 上传图片 → content 保持为空 → 用户不知道是等待中还是失败了
- 前端没有轮询/状态提示机制

## 影响

- 手写笔记图片上传后 OCR 静默失败，content 为空
- 用户尝试生成试卷时因 content 为空而无法出题（或收到错误提示）
- 用户反复上传相同的图片，浪费时间和 OCR 配额

## 修复建议

1. `ocr.py`：增加手写识别方法，或根据图片类型自动切换 `basicAccurate` / `handwriting`
2. `files.py`：OCR 失败时设置一个 `ocr_status` 字段（如 "failed"），前端据此展示友好提示
3. 前端：上传后轮询 content 状态，超时或失败时给出明确提示
