# BUG-045-文件上传未关联用户ID

## 基本信息

| 字段 | 值 |
|------|-----|
| BUG-ID | BUG-045 |
| 优先级 | P1 |
| 发现日期 | 2026-06-30 |
| 发现阶段 | 测试验收（v1.3） |
| 所属模块 | 后端 - 文件上传 |
| 影响范围 | 用户数据隔离（BUG-044 回归） |

## 问题描述

`routers/files.py` 的 `/api/files/upload` 端点创建笔记时 `user_id` 始终为默认值，未关联当前登录用户。这是 BUG-044 修复的遗漏 —— `notes.py` 已正确注入 `get_current_user`，但 `files.py` 未同步更新。

## 复现步骤

1. 登录用户 A
2. 通过图片/PDF 上传笔记
3. 查看笔记的 user_id

## 实际结果

```json
{"user_id": "default"}
```

## 预期结果

```json
{"user_id": "<用户A的ID>"}
```

## 根因

`files.py` 的 `upload_note_file` 函数未注入 `get_current_user` 依赖，`Note()` 创建时未传入 `user_id`，数据库默认值为 `"default"`。