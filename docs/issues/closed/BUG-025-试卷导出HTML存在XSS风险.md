# BUG-025: 试卷导出 HTML 存在 XSS 风险

**发现日期**: 2026-06-29
**优先级**: P1
**位置**: `app/backend/services/export.py:32-47` `_render_exam_html`
**状态**: 待修复

## 问题描述

`_render_exam_html` 将题目内容（stem、options、answer、explanation）直接拼接进 HTML，未做任何转义。如果笔记中包含 `<script>alert(1)</script>` 等标签，导出的 HTML 会直接执行。

```python
# services/export.py:41
q_html += f'<div class="q-stem">{stem}</div>'  # 未转义

# services/export.py:48
q_html += f'<div class="q-answer"><strong>Answer:</strong> {answer}</div>'  # 未转义
```

## 影响

- 导出的试卷 HTML 可被注入恶意脚本
- 教师分享试卷给学生时存在安全隐患

## 修复建议

对用户可控内容做 HTML 转义：

```python
import html

q_html += f'<div class="q-stem">{html.escape(stem)}</div>'
q_html += f'<div class="q-answer"><strong>Answer:</strong> {html.escape(str(answer))}</div>'
```
