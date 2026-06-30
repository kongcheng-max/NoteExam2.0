# BUG-040: 试卷列表question_count始终为0

**发现日期**: 2026-06-30
**优先级**: P1
**位置**: `app/backend/schemas.py:106` + `app/backend/routers/exams.py:154-162`
**状态**: 待修复

## 问题描述

`list_exams` 返回的 `question_count` 始终为 0。根因是 `ExamListItem` schema 的 `question_count: int = 0` 试图从 `Exam` model 读取此字段，但 model 中没有该字段，导致始终使用默认值 0。

```python
# schemas.py:101-107
class ExamListItem(BaseModel):
    question_count: int = 0  # ← 默认值，Exam model 无此字段

# exams.py:161 — list_exams 直接 model_validate，不查询试题数
data=[ExamListItem.model_validate(e).model_dump(mode="json") for e in exams]
```

对比 `generate_exam` 函数中正确计算了 `question_count`（line 148）。

## 影响

- 前端试卷列表每份试卷都显示"0 题"
- 用户无法从列表判断哪些试卷有题目

## 修复建议

在 `list_exams` 中查询每份试卷的试题数，或使用子查询计数：

```python
from sqlalchemy import func

# 查询试题数
q_counts = await db.execute(
    select(Question.exam_id, func.count(Question.id))
    .where(Question.exam_id.in_([e.id for e in exams]))
    .group_by(Question.exam_id)
)
counts = dict(q_counts.all())

data = []
for e in exams:
    item = ExamListItem.model_validate(e).model_dump(mode="json")
    item["question_count"] = counts.get(e.id, 0)
    data.append(item)
```
