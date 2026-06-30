# BUG-049: `api.submitExam` 方法缺失导致答题无法持久化

**优先级**: P0 (阻塞主流程)  
**阶段**: V1.4  
**发现日期**: 2026-06-30  
**模块**: 前端 API 层  
**文件**: `app/frontend/src/api.js`、`app/frontend/src/components/ExamModal.jsx`

## 问题描述

`ExamModal.jsx` 第 99 行在全部题目答完后调用 `api.submitExam(exam.id, newAnswers)` 将答题结果提交到后端持久化，但 `api.js` 中**未定义 `submitExam` 方法**。

后端 `POST /api/exams/{id}/submit` 已实现且功能正常，但前端缺少对应的 API 调用封装，导致：
1. 用户全部答完后提交静默失败（`catch {}` 吞掉了错误）
2. 答题结果不会保存到数据库（`exam_results` 表无记录）
3. 错题无法通过此路径自动入库

## 复现步骤

1. 生成一份试卷
2. 进入答题模式，逐题作答
3. 全部答完后，查看网络请求 —— 无 POST `/api/exams/{id}/submit` 请求发出
4. 刷新页面，答题记录丢失

## 期望行为

在 `api.js` 中添加 `submitExam` 方法：

```js
submitExam: (examId, answers) =>
  request(`/exams/${examId}/submit`, { method: 'POST', body: JSON.stringify({ answers }) }),
```

## 影响范围

- 在线答题功能的答题持久化（核心 V1.4 功能）
- 答题结果历史记录
