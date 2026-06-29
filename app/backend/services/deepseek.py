"""DeepSeek API 集成服务 —— 根据 tech-spec.md 第3节设计"""
import json
import asyncio
import httpx
from config import DEEPSEEK_API_KEY, DEEPSEEK_BASE_URL, DEEPSEEK_MODEL, MAX_RETRIES, API_TIMEOUT
from services.prompts import KNOWLEDGE_EXTRACT_PROMPT, QUESTION_GENERATE_PROMPT


class DeepSeekService:
    """DeepSeek API 调用封装，支持自动重试和格式校验"""

    def __init__(self):
        self.api_key = DEEPSEEK_API_KEY
        self.base_url = DEEPSEEK_BASE_URL
        self.model = DEEPSEEK_MODEL

    async def _call_api(self, messages: list[dict], max_tokens: int = 4096) -> str:
        """调用 DeepSeek Chat API，带自动重试"""
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        }
        payload = {
            "model": self.model,
            "messages": messages,
            "max_tokens": max_tokens,
            "temperature": 0.7,
        }

        last_error = None
        for attempt in range(MAX_RETRIES + 1):
            try:
                async with httpx.AsyncClient(timeout=API_TIMEOUT) as client:
                    resp = await client.post(
                        f"{self.base_url}/chat/completions",
                        headers=headers,
                        json=payload,
                    )
                    resp.raise_for_status()
                    data = resp.json()
                    return data["choices"][0]["message"]["content"]
            except httpx.TimeoutException:
                last_error = "API 请求超时，请稍后重试"
                if attempt < MAX_RETRIES:
                    await asyncio.sleep(2 ** attempt)
            except httpx.HTTPStatusError as e:
                if e.response.status_code == 429:
                    last_error = "API 请求过于频繁，请稍后重试"
                else:
                    last_error = f"API 请求失败: {e.response.status_code}"
                if attempt < MAX_RETRIES:
                    await asyncio.sleep(3 * (attempt + 1))
            except Exception as e:
                last_error = f"API 调用异常: {str(e)}"
                if attempt < MAX_RETRIES:
                    await asyncio.sleep(2)

        raise Exception(last_error or "API 调用失败，已达最大重试次数")

    @staticmethod
    def _extract_json(text: str) -> dict:
        """从 AI 响应中提取 JSON，支持 Markdown 代码块包裹"""
        text = text.strip()
        if text.startswith("```"):
            lines = text.split("\n")
            json_start = 1
            if lines[0].startswith("```json"):
                json_start = 1
            elif lines[0].startswith("```"):
                json_start = 1
            if lines[-1].strip() == "```":
                text = "\n".join(lines[json_start:-1])
            else:
                text = "\n".join(lines[json_start:])
        return json.loads(text)

    async def extract_knowledge_points(self, note_content: str) -> list[dict]:
        """知识提取 —— Step 1：从笔记中提取知识点"""
        prompt = KNOWLEDGE_EXTRACT_PROMPT.format(content=note_content)
        messages = [
            {"role": "system", "content": "你是一位专业的教育领域知识分析师。请始终以 JSON 格式输出结果。"},
            {"role": "user", "content": prompt},
        ]
        resp_text = await self._call_api(messages, max_tokens=2048)
        result = self._extract_json(resp_text)
        kps = result.get("knowledge_points", [])
        if not isinstance(kps, list):
            raise ValueError("AI 返回的知识点格式错误，预期为数组")
        return kps

    async def generate_questions(
        self,
        knowledge_points: list[dict],
        question_types: list[str],
        difficulties: list[str],
        total_questions: int,
    ) -> list[dict]:
        """试题生成 —— Step 2：根据知识点生成试卷"""
        kp_text = json.dumps(knowledge_points, ensure_ascii=False)
        prompt = QUESTION_GENERATE_PROMPT.format(
            question_types="、".join(question_types),
            difficulties="、".join(difficulties),
            total_questions=total_questions,
            knowledge_points=kp_text,
        )
        messages = [
            {"role": "system", "content": "你是一位资深的考试命题专家。请始终以 JSON 格式输出结果。"},
            {"role": "user", "content": prompt},
        ]
        resp_text = await self._call_api(messages, max_tokens=8192)
        result = self._extract_json(resp_text)
        qs = result.get("questions", [])
        if not isinstance(qs, list):
            raise ValueError("AI 返回的试题格式错误，预期为数组")
        return qs


# 单例
deepseek_service = DeepSeekService()
