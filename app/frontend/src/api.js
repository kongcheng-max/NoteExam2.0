const BASE = '/api';

let authToken = localStorage.getItem('noteexam_token') || '';

export function setToken(token) {
  authToken = token;
  if (token) localStorage.setItem('noteexam_token', token);
  else localStorage.removeItem('noteexam_token');
}

export function getToken() { return authToken; }

async function request(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (authToken) headers['Authorization'] = 'Bearer ' + authToken;
  const res = await fetch(BASE + path, {
    headers,
    ...options,
  });
  if (!res.ok) {
    let detail = '请求失败';
    try {
      const data = await res.json();
      detail = data.detail || detail;
    } catch {}
    throw new Error(detail);
  }
  return res.json();
}

export const api = {
  // 笔记
  createNote: (content, noteType = 'text') =>
    request('/notes', { method: 'POST', body: JSON.stringify({ content, note_type: noteType }) }),
  getNotes: () => request('/notes'),
  getNote: (id) => request(`/notes/${id}`),
  deleteNote: (id) => request(`/notes/${id}`, { method: 'DELETE' }),
  updateNote: (id, content) => request(`/notes/${id}`, { method: 'PUT', body: JSON.stringify({ content }) }),
  getKnowledgePoints: (noteId) => request(`/notes/${noteId}/knowledge-points`),

  // V1.1: 文件上传
  uploadFile: (file, noteType = 'image') => {
    const form = new FormData();
    form.append('file', file);
    form.append('note_type', noteType);
    const headers = {};
    if (authToken) headers['Authorization'] = 'Bearer ' + authToken;
    return fetch(BASE + '/files/upload', { method: 'POST', body: form, headers })
      .then(async (res) => {
        if (!res.ok) {
          let detail = '上传失败';
          try { const data = await res.json(); detail = data.detail || detail; } catch {}
          throw new Error(detail);
        }
        return res.json();
      });
  },

  // V1.1: 知识点 CRUD
  addKnowledgePoint: (noteId, kp) =>
    request(`/notes/${noteId}/knowledge-points`, { method: 'POST', body: JSON.stringify(kp) }),
  updateKnowledgePoint: (noteId, kpId, kp) =>
    request(`/notes/${noteId}/knowledge-points/${kpId}`, { method: 'PUT', body: JSON.stringify(kp) }),
  deleteKnowledgePoint: (noteId, kpId) =>
    request(`/notes/${noteId}/knowledge-points/${kpId}`, { method: 'DELETE' }),

  // 试卷
  generateExam: (noteId, opts = {}) =>
    request('/exams/generate', {
      method: 'POST',
      body: JSON.stringify({
        note_id: noteId,
        question_types: opts.questionTypes || ['single_choice', 'multi_choice', 'true_false', 'fill_blank'],
        difficulties: opts.difficulties || ['basic', 'advanced', 'challenge'],
        total_questions: opts.totalQuestions || 20,
        difficulty_ratios: opts.difficultyRatios || null,
      }),
    }),
  getExams: () => request('/exams'),
  getExam: (id) => request(`/exams/${id}`),
  deleteExam: (id) => request(`/exams/${id}`, { method: 'DELETE' }),

  // V1.1: 试题编辑
  updateQuestion: (examId, questionId, updates) =>
    request(`/exams/${examId}/questions/${questionId}`, { method: 'PUT', body: JSON.stringify(updates) }),
  deleteQuestion: (examId, questionId) =>
    request(`/exams/${examId}/questions/${questionId}`, { method: 'DELETE' }),
  reorderQuestions: (examId, questionIds) =>
    request(`/exams/${examId}/questions/reorder`, { method: 'PUT', body: JSON.stringify({ question_ids: questionIds }) }),

  // V1.1: 试卷导出
  getExportUrl: (examId, format = 'html', withAnswers = true) =>
    `${BASE}/exams/${examId}/export?format=${format}&with_answers=${withAnswers}`,

  // V1.2: 错题回顾
  markWrong: (questionId, userAnswer = '', note = '') =>
    request(`/wrong-answers/questions/${questionId}`, { method: 'POST', body: JSON.stringify({ user_answer: userAnswer, note }) }),
  unmarkWrong: (questionId) =>
    request(`/wrong-answers/questions/${questionId}`, { method: 'DELETE' }),
  getWrongAnswers: () => request('/wrong-answers'),
  reviewWrong: (wrongId) =>
    request(`/wrong-answers/${wrongId}/review`, { method: 'POST' }),
  deleteWrong: (wrongId) =>
    request(`/wrong-answers/${wrongId}`, { method: 'DELETE' }),

  // V1.2: 用户认证
  register: (email, password) =>
    request('/auth/register', { method: 'POST', body: JSON.stringify({ email, password }) }),
  login: (email, password) =>
    request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  getMe: () => request('/auth/me'),
  logout: () => request('/auth/logout', { method: 'POST' }),
  changePassword: (old_password, new_password) =>
    request('/auth/password', { method: 'PUT', body: JSON.stringify({ old_password, new_password }) }),
};
