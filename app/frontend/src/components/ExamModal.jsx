import React, { useState, useEffect } from 'react';
import { api } from '../api';

const typeNames = {
  single_choice: '单选', multi_choice: '多选', fill_blank: '填空',
  true_false: '判断', short_answer: '简答', essay: '论述',
};
const diffNames = { basic: '基础', advanced: '进阶', challenge: '拔高' };
const diffColors = { basic: 'var(--green)', advanced: 'var(--amber)', challenge: 'var(--coral)' };
const diffBg = { basic: 'var(--green-bg)', advanced: 'var(--amber-bg)', challenge: 'var(--coral-bg)' };
const diffText = { basic: 'var(--green)', advanced: '#B45309', challenge: 'var(--coral)' };

const overlayStyle = {
  position: 'fixed', inset: 0, zIndex: 200,
  background: 'rgba(15,23,42,.4)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
};
const modalStyle = {
  background: '#fff', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-lg)',
  maxWidth: 740, width: '100%', maxHeight: '88vh', display: 'flex', flexDirection: 'column',
  animation: 'modalIn .25s ease',
};
const headStyle = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  padding: '20px 24px', borderBottom: '1px solid var(--border)',
};
const closeBtnStyle = {
  width: 32, height: 32, border: 'none', background: 'var(--paper)', borderRadius: '50%',
  fontSize: '1.2rem', cursor: 'pointer', color: 'var(--slate)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};
const inputStyle = {
  width: '100%', padding: '6px 10px', borderRadius: 4, border: '1px solid var(--border)',
  fontSize: '.85rem', fontFamily: 'var(--font-body)',
};
const btnSm = {
  padding: '4px 12px', fontSize: '.75rem', borderRadius: 4, cursor: 'pointer',
  border: 'none', fontWeight: 500,
};

export default function ExamModal({ exam, onClose, onRefresh, showToast }) {
  const [editId, setEditId] = useState(null);
  const [editData, setEditData] = useState({});
  const [deleteId, setDeleteId] = useState(null);

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', handler); document.body.style.overflow = ''; };
  }, [onClose]);

  const questions = exam?.questions || [];
  const exportUrl = api.getExportUrl(exam?.id, 'html', true);

  const startEdit = (q) => {
    setEditId(q.id);
    setEditData({
      stem: q.content?.stem || '',
      answer: q.answer || '',
      explanation: q.explanation || '',
    });
  };

  const saveEdit = async (qId) => {
    try {
      const q = questions.find((x) => x.id === qId);
      const content = { ...(q?.content || {}), stem: editData.stem };
      await api.updateQuestion(exam.id, qId, {
        content,
        answer: editData.answer,
        explanation: editData.explanation,
      });
      showToast?.('题目已更新');
      setEditId(null);
      onRefresh?.();
    } catch (err) { showToast?.(err.message, 'error'); }
  };

  const handleDeleteQ = async (qId) => {
    try {
      await api.deleteQuestion(exam.id, qId);
      showToast?.('题目已删除');
      setDeleteId(null);
      onRefresh?.();
    } catch (err) { showToast?.(err.message, 'error'); }
  };

  return (
    <div style={overlayStyle} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={modalStyle}>
        <div style={headStyle}>
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', fontWeight: 600 }}>
            {exam.title}
          </h3>
          <div style={{ display: 'flex', gap: 8 }}>
            <a href={exportUrl} target="_blank" rel="noreferrer"
              style={{ ...btnSm, background: 'var(--ink)', color: '#fff', textDecoration: 'none',
                display: 'inline-flex', alignItems: 'center' }}>
              导出
            </a>
            <button style={closeBtnStyle} onClick={onClose}>&times;</button>
          </div>
        </div>
        <div style={{ padding: 24, overflowY: 'auto' }}>
          {questions.map((q, i) => {
            const isEditing = editId === q.id;
            return (
              <div key={q.id || i} style={{
                border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                padding: 20, marginBottom: 16,
                borderLeft: '3px solid ' + (diffColors[q.difficulty] || 'var(--border)'),
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <span style={{ fontFamily: 'var(--font-display)', fontSize: '.9rem', fontWeight: 600, color: 'var(--ink)' }}>
                    第{i + 1}题
                  </span>
                  <span style={{ fontSize: '.72rem', padding: '2px 8px', borderRadius: 100, fontWeight: 500,
                    background: 'var(--paper)', color: 'var(--slate)' }}>
                    {typeNames[q.question_type] || q.question_type}
                  </span>
                  <span style={{ fontSize: '.72rem', padding: '2px 8px', borderRadius: 100, fontWeight: 500,
                    background: diffBg[q.difficulty], color: diffText[q.difficulty] }}>
                    {diffNames[q.difficulty] || q.difficulty}
                  </span>
                  <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
                    {!isEditing ? (
                      <>
                        <button style={{ ...btnSm, background: 'var(--paper)', color: 'var(--slate)' }}
                          onClick={() => startEdit(q)}>编辑</button>
                        <button style={{ ...btnSm, background: 'var(--coral-bg)', color: 'var(--coral)' }}
                          onClick={() => setDeleteId(q.id)}>删</button>
                      </>
                    ) : (
                      <>
                        <button style={{ ...btnSm, background: 'var(--green)', color: '#fff' }}
                          onClick={() => saveEdit(q.id)}>保存</button>
                        <button style={{ ...btnSm, background: 'var(--slate-light)', color: '#fff' }}
                          onClick={() => setEditId(null)}>取消</button>
                      </>
                    )}
                  </div>
                </div>

                {isEditing ? (
                  <textarea value={editData.stem}
                    onChange={(e) => setEditData((d) => ({ ...d, stem: e.target.value }))}
                    rows={2} style={inputStyle} />
                ) : (
                  <div style={{ fontSize: '.93rem', lineHeight: 1.7, marginBottom: 12, color: 'var(--ink)' }}>
                    {q.content?.stem || ''}
                  </div>
                )}

                {q.content?.options?.length > 0 && !isEditing && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 }}>
                    {q.content.options.map((opt, j) => (
                      <div key={j} style={{ padding: '8px 14px', border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-sm)', fontSize: '.88rem',
                        background: 'var(--paper)', color: 'var(--slate)' }}>
                        {opt}
                      </div>
                    ))}
                  </div>
                )}

                <details style={{ background: 'var(--green-bg)', borderRadius: 'var(--radius-sm)',
                  padding: '12px 16px', fontSize: '.88rem', lineHeight: 1.6 }}>
                  <summary style={{ cursor: 'pointer', color: 'var(--green)', fontWeight: 500 }}>
                    答案与解析
                  </summary>
                  {isEditing ? (
                    <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div>
                        <label style={{ fontSize: '.75rem', fontWeight: 600, color: 'var(--slate)' }}>答案：</label>
                        <input value={editData.answer}
                          onChange={(e) => setEditData((d) => ({ ...d, answer: e.target.value }))}
                          style={{ ...inputStyle, marginTop: 4 }} />
                      </div>
                      <div>
                        <label style={{ fontSize: '.75rem', fontWeight: 600, color: 'var(--slate)' }}>解析：</label>
                        <textarea value={editData.explanation}
                          onChange={(e) => setEditData((d) => ({ ...d, explanation: e.target.value }))}
                          rows={2} style={{ ...inputStyle, marginTop: 4 }} />
                      </div>
                    </div>
                  ) : (
                    <>
                      <p style={{ marginTop: 8 }}>
                        <strong style={{ color: 'var(--green)' }}>答案：</strong>{q.answer}
                      </p>
                      {q.explanation && <p style={{ marginTop: 4, color: 'var(--slate)' }}>{q.explanation}</p>}
                    </>
                  )}
                </details>

                {deleteId === q.id && (
                  <div style={{ marginTop: 10, padding: '10px 14px', background: 'var(--coral-bg)',
                    borderRadius: 4, display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: '.82rem', color: 'var(--coral)' }}>删除此题？</span>
                    <button style={{ ...btnSm, background: 'var(--coral)', color: '#fff' }}
                      onClick={() => handleDeleteQ(q.id)}>是</button>
                    <button style={{ ...btnSm, background: 'var(--paper)', color: 'var(--slate)' }}
                      onClick={() => setDeleteId(null)}>否</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
