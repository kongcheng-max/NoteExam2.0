import React, { useEffect } from 'react';

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
  maxWidth: 700, width: '100%', maxHeight: '85vh', display: 'flex', flexDirection: 'column',
  animation: 'modalIn .25s ease',
};
const headStyle = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  padding: '20px 24px', borderBottom: '1px solid var(--border)',
};
const titleStyle = { fontFamily: 'var(--font-display)', fontSize: '1.1rem', fontWeight: 600 };
const closeBtnStyle = {
  width: 32, height: 32, border: 'none', background: 'var(--paper)', borderRadius: '50%',
  fontSize: '1.2rem', cursor: 'pointer', color: 'var(--slate)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};
const bodyStyle = { padding: 24, overflowY: 'auto' };

const qCardStyle = (diff) => ({
  border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
  padding: 20, marginBottom: 16,
  animation: 'questionReveal .4s ease both',
  borderLeft: `3px solid ${diffColors[diff]}`,
});
const qHeaderStyle = { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 };
const qNumStyle = { fontFamily: 'var(--font-display)', fontSize: '.9rem', fontWeight: 600, color: 'var(--ink)' };
const tagStyle = { fontSize: '.72rem', padding: '2px 8px', borderRadius: 100, fontWeight: 500 };
const stemStyle = { fontSize: '.93rem', lineHeight: 1.7, marginBottom: 12, color: 'var(--ink)' };
const optionsStyle = { display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 };
const optionStyle = {
  padding: '8px 14px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
  fontSize: '.88rem', background: 'var(--paper)', color: 'var(--slate)',
};
const answerStyle = {
  background: 'var(--green-bg)', borderRadius: 'var(--radius-sm)',
  padding: '12px 16px', fontSize: '.88rem', lineHeight: 1.6,
};

export default function ExamModal({ exam, onClose }) {
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', handler); document.body.style.overflow = ''; };
  }, [onClose]);

  const questions = exam?.questions || [];

  return (
    <div style={overlayStyle} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={modalStyle}>
        <div style={headStyle}>
          <h3 style={titleStyle}>{exam.title}</h3>
          <button style={closeBtnStyle} onClick={onClose}>&times;</button>
        </div>
        <div style={bodyStyle}>
          {questions.map((q, i) => {
            const hasOptions = q.content?.options?.length > 0;
            return (
              <div key={q.id || i} style={{ ...qCardStyle(q.difficulty), animationDelay: `${i * .06}s` }}>
                <div style={qHeaderStyle}>
                  <span style={qNumStyle}>第 {i + 1} 题</span>
                  <span style={{ ...tagStyle, background: 'var(--paper)', color: 'var(--ink-light)' }}>
                    {typeNames[q.question_type] || q.question_type}
                  </span>
                  <span style={{ ...tagStyle, background: diffBg[q.difficulty], color: diffText[q.difficulty] }}>
                    {diffNames[q.difficulty] || q.difficulty}
                  </span>
                </div>
                <div style={stemStyle}>{q.content?.stem || ''}</div>
                {hasOptions && (
                  <div style={optionsStyle}>
                    {q.content.options.map((opt, j) => (
                      <div key={j} style={optionStyle}>{opt}</div>
                    ))}
                  </div>
                )}
                <details style={answerStyle}>
                  <summary style={{ cursor: 'pointer', color: 'var(--green)', fontWeight: 500 }}>
                    查看答案与解析
                  </summary>
                  <p style={{ marginTop: 8 }}>
                    <strong style={{ color: 'var(--green)' }}>答案：</strong>{q.answer}
                  </p>
                  {q.explanation && <p style={{ marginTop: 4, color: 'var(--slate)' }}>{q.explanation}</p>}
                </details>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
