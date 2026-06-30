"""V1.1: Exam export service - HTML to PDF via WeasyPrint"""
import html as html_mod
import io

TYPE_LABELS = {
    "single_choice": "单选题",
    "multi_choice": "多选题",
    "fill_blank": "填空题",
    "true_false": "判断题",
    "short_answer": "简答题",
    "essay": "论述题",
}
DIFF_LABELS = {"basic": "基础", "advanced": "进阶", "challenge": "拔高"}


def _render_exam_html(exam_title: str, questions: list, with_answers: bool = True) -> str:
    """Render exam as HTML string with XSS-safe escaping"""
    q_html_parts = []
    for i, q in enumerate(questions, 1):
        q_type = q.get("question_type", "")
        difficulty = q.get("difficulty", "")
        content = q.get("content", {})
        stem = content.get("stem", "")
        options = content.get("options", [])
        answer = q.get("answer", "")
        explanation = q.get("explanation", "")

        type_label = TYPE_LABELS.get(q_type, q_type)
        diff_label = DIFF_LABELS.get(difficulty, difficulty)

        # BUG-025: 对所有用户可控内容做 HTML 转义，防止 XSS
        q_html = '<div class="question">'
        q_html += '<div class="q-header"><span class="q-num">第{}题</span>'.format(i)
        q_html += '<span class="q-type">{}</span>'.format(html_mod.escape(type_label))
        q_html += '<span class="q-diff {}">{}</span></div>'.format(difficulty, html_mod.escape(diff_label))
        q_html += '<div class="q-stem">{}</div>'.format(html_mod.escape(stem))

        if options:
            q_html += '<div class="q-options">'
            for opt in options:
                q_html += '<div class="q-option">{}</div>'.format(html_mod.escape(opt))
            q_html += '</div>'

        if with_answers:
            q_html += '<div class="q-answer"><strong>答案：</strong>{}</div>'.format(html_mod.escape(str(answer)))
            if explanation:
                q_html += '<div class="q-explanation"><strong>解析：</strong>{}</div>'.format(html_mod.escape(str(explanation)))

        q_html += '</div>'
        q_html_parts.append(q_html)

    return """<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<style>
  @page {{ size: A4; margin: 2cm; }}
  body {{ font-family: "Noto Serif SC", "SimSun", serif; font-size: 12pt; color: #1E2A4F; line-height: 1.8; }}
  h1 {{ text-align: center; font-size: 18pt; margin-bottom: 24px; }}
  .question {{ border: 1px solid #ddd; border-radius: 6px; padding: 16px; margin-bottom: 16px; page-break-inside: avoid; }}
  .q-header {{ display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }}
  .q-num {{ font-weight: bold; font-size: 13pt; }}
  .q-type {{ font-size: 9pt; padding: 2px 8px; background: #F3F4F6; border-radius: 12px; }}
  .q-diff {{ font-size: 9pt; padding: 2px 8px; border-radius: 12px; color: #fff; }}
  .q-diff.basic {{ background: #22c55e; }}
  .q-diff.advanced {{ background: #f59e0b; }}
  .q-diff.challenge {{ background: #E05555; }}
  .q-stem {{ margin-bottom: 10px; }}
  .q-options {{ margin-bottom: 10px; }}
  .q-option {{ padding: 4px 0; }}
  .q-answer {{ margin-top: 12px; padding: 10px 14px; background: #ecfdf5; border-radius: 4px; font-size: 11pt; }}
  .q-explanation {{ padding: 6px 14px 10px; color: #64748b; font-size: 10pt; }}
</style>
</head>
<body>
<h1>{}</h1>
{}
</body>
</html>""".format(html_mod.escape(exam_title), "".join(q_html_parts))


def export_exam_html(exam_title: str, questions: list, with_answers: bool = True) -> str:
    """Export exam as HTML string"""
    return _render_exam_html(exam_title, questions, with_answers)


def export_exam_pdf(exam_title: str, questions: list, with_answers: bool = True) -> bytes:
    """Export exam as PDF bytes (requires WeasyPrint + GTK runtime)"""
    from weasyprint import HTML
    html = _render_exam_html(exam_title, questions, with_answers)
    return HTML(string=html).write_pdf()
