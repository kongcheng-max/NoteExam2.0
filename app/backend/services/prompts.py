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
2. 难度分布：{difficulties}（均匀分布在各难度上）
3. 题目总数：{total_questions}
4. 每题需包含：题干、选项（选择题）、标准答案、解析（1-3句话）—— 答案和解析绝对不能为空
5. 以 JSON 格式输出：
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
6. 题干要清晰明确，避免歧义
7. 选择题选项要互斥、干扰项要有迷惑性
8. 答案格式规范（严格遵守）：
   - 单选题答案：单个字母，如 "A"
   - 多选题答案：多个字母用逗号分隔，如 "A,C,D"（不要用数组、空格或其他分隔符）
   - 判断题答案：小写 "true" 或 "false"
   - 填空题答案：直接填写内容，多个空用 "||" 分隔
   - 简答题答案：50-150字的关键要点

知识点列表：
{knowledge_points}
"""
