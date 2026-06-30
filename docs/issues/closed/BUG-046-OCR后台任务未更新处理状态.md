# BUG-046-OCR后台任务未更新处理状态

## 基本信息

| 字段 | 值 |
|------|-----|
| BUG-ID | BUG-046 |
| 优先级 | P2 |
| 发现日期 | 2026-06-30 |
| 发现阶段 | 测试验收（v1.3） |
| 所属模块 | 后端 - OCR 后台任务 |
| 影响范围 | 前端 OCR 状态轮询、用户体验 |

## 问题描述

PDF 上传后，`_process_file_ocr` 后台任务成功提取了文本内容（`content` 已填充），但 `ocr_status` 始终停留在 `"pending"`，未更新为 `"done"`。

## 复现步骤

1. 上传一个文本型 PDF 文件
2. 等待 5 秒后查询笔记详情
3. 观察到 `content` 有内容但 `ocr_status` 为 `"pending"`

## 实际结果

```json
{"ocr_status": "pending", "content": "Newton Laws of Motion: First Law..."}
```

## 预期结果

```json
{"ocr_status": "done", "content": "Newton Laws of Motion: First Law..."}
```

## 影响

前端 `pollOcrResult` 依赖 `ocr_status` 判断 OCR 是否完成。状态不更新会导致前端持续轮询直到超时，用户看到"处理中"但实际上已完成。