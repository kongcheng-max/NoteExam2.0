"""Prompt 模板 —— 根据 tech-spec.md 3.3 节设计"""

KNOWLEDGE_EXTRACT_PROMPT = """你是一位专业的教育领域知识分析师。请分析以下学习笔记内容，提取出所有核心知识点。

要求：
1. 识别每个知识点的名称、所属类别、重要程度（high/normal/low）
2. 以 JSON 格式输出，格式如下：
{{
  "knowledge_points": [
    {{"name": "知识点名称", "category": "类别", "importance": "high"}}
  ]
}}
3. 确保不遗漏重要知识点
4. 知识点名称要简洁准确（不超过20字）
5. 类别要合理归类（如：概念定义、公式定理、事件历史、操作步骤等）

笔记内容：
{content}
"""

QUESTION_GENERATE_PROMPT = """你是一位资深的考试命题专家。请根据以下知识点列表，生成一套高质量的试卷。

生成要求：
1. 题型：{question_types}
2. 难度分布：{difficulties}（严格按此比例分配题目数量）
3. 各难度题目数量：{difficulty_counts}
4. 题目总数：{total_questions}
5. 每题需包含：题干、标准答案、解析（1-3句话）—— 答案和解析绝对不能为空
6. 以 JSON 格式输出：
{{
  "questions": [
    {{
      "question_type": "single_choice",
      "difficulty": "basic",
      "content": {{
        "stem": "题干",
        "options": ["A. 选项1", "B. 选项2", "C. 选项3", "D. 选项4"]
      }},
      "answer": "A",
      "explanation": "解析说明"
    }}
  ]
}}
7. 题干要清晰明确，避免歧义
8. 选择题选项要互斥、干扰项要有迷惑性
9. 答案格式规范（严格遵守）：
   - 单选题答案：单个字母，如 "A"
   - 多选题答案：多个字母用逗号分隔，如 "A,C,D"（不要用数组、空格或其他分隔符）
   - 判断题答案：小写 "true" 或 "false"
   - 填空题答案：直接填写内容，多个空用 "||" 分隔
   - 简答题答案：50-150字的关键要点，分条列出（2-4条）
   - 论述题答案：150-300字，包含分析过程、核心论点、论据支撑和结论

10. 简答题 content 格式：
   {{"stem": "请简述……"}}

11. 论述题 content 格式：
   {{"stem": "请论述……"}}

知识点列表：
{knowledge_points}
"""

# ============ V2.0: 学习报告生成 Prompt ============

STUDY_REPORT_PROMPT = """你是一位资深的学习分析专家和教育顾问。请根据以下用户的答题历史和错题记录，生成一份全面的学习分析报告。

要求：
1. 数据分析：统计答题总量、正确率趋势、各题型得分率、各难度层级得分率
2. 知识掌握评估：基于答题数据，分析用户在哪些知识点上表现好、哪些薄弱
3. 错题规律分析：从错题中提炼出常见的错误模式（如概念混淆、计算错误、理解偏差等）
4. 学习建议：根据分析结果，给出具体可操作的学习建议和复习计划
5. 目标设定：为用户设定下一阶段合理的学习目标

以 JSON 格式输出（严格遵守）：
{{
  "summary": "整体学习情况概述，100字以内",
  "statistics": {{
    "total_exams": n,
    "total_questions": n,
    "avg_score": n,
    "score_trend": "上升/下降/稳定",
    "type_accuracy": {{"single_choice": n, "multi_choice": n, "fill_blank": n, "true_false": n, "short_answer": n, "essay": n}},
    "difficulty_accuracy": {{"basic": n, "advanced": n, "challenge": n}}
  }},
  "strengths": ["优势1", "优势2"],
  "weaknesses": ["薄弱点1", "薄弱点2"],
  "error_patterns": [
    {{"pattern": "错误模式名称", "count": n, "description": "具体描述", "suggestion": "改进建议"}}
  ],
  "recommendations": [
    {{"area": "学习领域", "action": "具体行动建议", "priority": "high/normal/low"}}
  ],
  "goals": [
    {{"description": "阶段目标", "target_score": n, "timeline": "建议时间"}}
  ]
}}

答题历史数据：
{exam_history}

错题记录：
{wrong_answers}
"""

# ============ V2.0: 错题智能分析 Prompt ============

WRONG_ANSWER_ANALYSIS_PROMPT = """你是一位教育数据分析和学习诊断专家。请分析以下错题记录，识别用户的薄弱知识点和错误规律。

要求：
1. 按题型分类统计错题分布
2. 按难度分类统计错题分布
3. 识别高频错误知识点（出现3次以上相同知识点的错误需重点标注）
4. 分析错误原因模式（如：概念不清、记忆不牢、审题偏差、计算错误等）
5. 给出针对性强化练习建议

以 JSON 格式输出：
{{
  "summary": "错题整体分析概述，80字以内",
  "by_type": {{"single_choice": n, "multi_choice": n, "fill_blank": n, "true_false": n, "short_answer": n, "essay": n}},
  "by_difficulty": {{"basic": n, "advanced": n, "challenge": n}},
  "weak_knowledge_points": [
    {{"name": "薄弱知识点名称", "error_count": n, "category": "类别", "severity": "high/normal/low"}}
  ],
  "error_causes": [
    {{"cause": "错误原因", "count": n, "percentage": n}}
  ],
  "improvement_plan": [
    {{"focus": "重点提升方向", "method": "具体方法", "expected_effort": "预计投入时间"}}
  ]
}}

错题记录：
{wrong_answers_data}
"""
