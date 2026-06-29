const BASE = '/api';

async function request(path, options = {}) {
  const res = await fetch(BASE + path, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  if (!res.ok) {
    let detail = '????';
    try {
      const data = await res.json();
      detail = data.detail || detail;
    } catch {}
    throw new Error(detail);
  }
  return res.json();
}

export const api = {
  // ??
  createNote: (content, noteType = 'text') =>
    request('/notes', { method: 'POST', body: JSON.stringify({ content, note_type: noteType }) }),
  getNotes: () => request('/notes'),
  getNote: (id) => request(`/notes/${id}`),
  deleteNote: (id) => request(`/notes/${id}`, { method: 'DELETE' }),
  getKnowledgePoints: (noteId) => request(`/notes/${noteId}/knowledge-points`),

  // ??
  generateExam: (noteId, opts = {}) =>
    request('/exams/generate', {
      method: 'POST',
      body: JSON.stringify({
        note_id: noteId,
        question_types: opts.questionTypes || ['single_choice', 'multi_choice', 'true_false', 'fill_blank', 'short_answer'],
        difficulties: opts.difficulties || ['basic', 'advanced', 'challenge'],
        total_questions: opts.totalQuestions || 20,
      }),
    }),
  getExams: () => request('/exams'),
  getExam: (id) => request(`/exams/${id}`),
  deleteExam: (id) => request(`/exams/${id}`, { method: 'DELETE' }),
};
