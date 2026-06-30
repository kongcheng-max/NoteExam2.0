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
  maxWidth: 760, width: '100%', maxHeight: '88vh', display: 'flex', flexDirection: 'column',
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
  const [mode, setMode] = useState('preview');
  const [answers, setAnswers] = useState({});
  const [results, setResults] = useState({});

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', handler); document.body.style.overflow = ''; };
  }, [onClose]);

  const questions = exam?.questions || [];
  const exportUrl = api.getExportUrl(exam?.id, 'html', true);

  const score = Object.keys(results).length > 0
    ? { correct: Object.values(results).filter(r => r === 'correct').length, total: Object.keys(results).length }
    : null;

  const normalizeAnswer = (s) => (s || '').trim().toUpperCase().replace(/\s+/g, '');

  const checkAnswer = (q, userAnswer) => {
    const qType = q.question_type;
    const correct = q.answer || '';
    const uaTrimmed = (userAnswer || '').trim();
    // BUG-041: 空答案始终判定为错误
    if (!uaTrimmed) return false;
    if (qType === 'single_choice' || qType === 'true_false') {
      return normalizeAnswer(uaTrimmed) === normalizeAnswer(correct);
    }
    if (qType === 'multi_choice') {
      const userSet = new Set(userAnswer.toUpperCase().split(',').map(s => s.trim()).filter(Boolean));
      const correctSet = new Set(correct.toUpperCase().split(',').map(s => s.trim()).filter(Boolean));
      return userSet.size === correctSet.size && [...userSet].every(v => correctSet.has(v));
    }
    if (qType === 'fill_blank') {
      // BUG-051: 支持 || 分隔多空位逐空比对
      const userParts = uaTrimmed.split('||').map(s => s.trim());
      const correctParts = correct.trim().split('||').map(s => s.trim());
      if (correctParts.length > 1 || userParts.length > 1) {
        if (userParts.length !== correctParts.length) return false;
        return userParts.every((up, i) => {
          const uc = up.replace(/\s+/g, '');
          const cc = correctParts[i].replace(/\s+/g, '');
          return uc === cc || uc.includes(cc);
        });
      }
      const uaClean = uaTrimmed.replace(/\s+/g, '');
      const caClean = correct.trim().replace(/\s+/g, '');
      return uaClean === caClean || uaClean.includes(caClean);
    }
    // short_answer / essay: 有输入即视为有效作答（主观题需自行对照参考答案）
    return uaTrimmed.length > 0;
  };

  const submitAnswer = async (q, userAnswer) => {
    const newAnswers = { ...answers, [q.id]: userAnswer };
    setAnswers(newAnswers);
    const isCorrect = checkAnswer(q, userAnswer);
    setResults(prev => ({ ...prev, [q.id]: isCorrect ? 'correct' : 'wrong' }));
    if (!isCorrect) {
      try { await api.markWrong(q.id, userAnswer); } catch {}
    }
    // V1.4: 全部答完后提交到后端持久化
    const answeredCount = Object.keys(newAnswers).length;
    if (answeredCount === questions.length) {
      try { await api.submitExam(exam.id, newAnswers); } catch {}
    }
  };

  const startAnswerMode = () => {
    setMode('answer');
    setAnswers({});
    setResults({});
  };

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
        content, answer: editData.answer, explanation: editData.explanation,
      });
      showToast?.('题目已更新');
      setEditId(null);
      onRefresh?.();
    } catch (err) { showToast?.(err.message, 'error'); }
  };

  const handleMarkWrong = async (qId) => {
    try {
      await api.markWrong(qId);
      showToast?.('已加入错题本');
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
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <a href={exportUrl} target="_blank" rel="noreferrer"
              style={{ ...btnSm, background: 'var(--ink)', color: '#fff', textDecoration: 'none',
                display: 'inline-flex', alignItems: 'center' }}>
              导出
            </a>
            <button
              onClick={() => mode === 'answer' ? setMode('preview') : startAnswerMode()}
              style={{ ...btnSm, background: mode === 'answer' ? 'var(--green)' : 'var(--amber)',
                color: '#fff' }}
            >
              {mode === 'answer' ? '退出答题' : '答题模式'}
            </button>
            <button style={closeBtnStyle} onClick={onClose}>&times;</button>
          </div>
        </div>
        <div style={{ padding: 24, overflowY: 'auto' }}>
          {mode === 'answer' && score && (
            <div style={{
              marginBottom: 20, padding: '16px 20px', borderRadius: 'var(--radius)',
              background: score.correct === score.total ? 'var(--green-bg)' : 'var(--amber-bg)',
              border: '1px solid ' + (score.correct === score.total ? 'var(--green)' : 'var(--amber)'),
              textAlign: 'center',
            }}>
              <div style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--ink)' }}>
                {score.correct} / {score.total}
              </div>
              <div style={{ fontSize: '.82rem', color: 'var(--slate)', marginTop: 4 }}>
                {score.total > 0 ? '正确率 ' + Math.round(score.correct / score.total * 100) + '%' : ''}
              </div>
            </div>
          )}
          {questions.map((q, i) => {
            const isEditing = editId === q.id;
            const userAnswer = answers[q.id];
            const result = results[q.id];
            const isAnswered = result !== undefined;
            const borderColor = result === 'correct' ? 'var(--green)'
              : result === 'wrong' ? 'var(--coral)'
              : diffColors[q.difficulty] || 'var(--border)';
            return (
              <div key={q.id || i} style={{
                border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                padding: 20, marginBottom: 16,
                borderLeft: '3px solid ' + borderColor,
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
                    {mode === 'answer' ? (
                      isAnswered && (
                        <span style={{ fontSize: '.78rem', fontWeight: 600, color: result === 'correct' ? 'var(--green)' : 'var(--coral)' }}>
                          {result === 'correct' ? '✔ 正确' : '✘ 错误'}
                        </span>
                      )
                    ) : !isEditing ? (
                      <>
                        <button style={{ ...btnSm, background: 'var(--paper)', color: 'var(--slate)' }}
                          onClick={() => startEdit(q)}>编辑</button>
                        <button style={{ ...btnSm, background: 'var(--amber-bg)', color: '#B45309' }}
                          onClick={() => handleMarkWrong(q.id)}>错题</button>
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
                    {q.content.options.map((opt, j) => {
                      const optLetter = String.fromCharCode(65 + j);
                      const isSelected = mode === 'answer'
                        ? (q.question_type === 'single_choice'
                          ? userAnswer === optLetter
                          : (userAnswer || '').toUpperCase().split(',').map(s => s.trim()).includes(optLetter))
                        : false;
                      const isCorrectOpt = isAnswered && (q.answer || '').toUpperCase().split(',').map(s => s.trim()).includes(optLetter);
                      let optBg = 'var(--paper)';
                      let optBorder = '1px solid var(--border)';
                      let optColor = 'var(--slate)';
                      if (isAnswered) {
                        if (isCorrectOpt) { optBg = 'var(--green-bg)'; optBorder = '1px solid var(--green)'; }
                        else if (isSelected) { optBg = 'var(--coral-bg)'; optBorder = '1px solid var(--coral)'; }
                      } else if (isSelected) {
                        optBg = 'var(--ink)'; optBorder = '1px solid var(--ink)'; optColor = '#fff';
                      }
                      return (
                        <div key={j}
                          onClick={() => {
                            if (!isAnswered && mode === 'answer') {
                              if (q.question_type === 'single_choice') {
                                submitAnswer(q, optLetter);
                              } else if (q.question_type === 'multi_choice') {
                                const cur = (userAnswer || '').toUpperCase().split(',').map(s => s.trim()).filter(Boolean);
                                if (cur.includes(optLetter)) cur.splice(cur.indexOf(optLetter), 1);
                                else cur.push(optLetter);
                                setAnswers(prev => ({ ...prev, [q.id]: cur.join(',') }));
                              }
                            }
                          }}
                          style={{
                            padding: '8px 14px', border: optBorder,
                            borderRadius: 'var(--radius-sm)', fontSize: '.88rem',
                            background: optBg, color: optColor,
                            cursor: isAnswered ? 'default' : (mode === 'answer' ? 'pointer' : 'default'),
                            transition: 'all .15s', display: 'flex', alignItems: 'center',
                          }}>
                          {mode === 'answer' && q.question_type === 'multi_choice' && (
                            <span style={{ marginRight: 8, fontWeight: 600, fontSize: '.85rem' }}>
                              {(userAnswer || '').toUpperCase().split(',').map(s => s.trim()).includes(optLetter) ? '☑' : '☐'}
                            </span>
                          )}
                          <span style={{ flex: 1 }}>{opt}</span>
                          {isAnswered && isCorrectOpt && <span style={{ marginLeft: 8, color: 'var(--green)' }}>{'✔'}</span>}
                        </div>
                      );
                    })}
                    {mode === 'answer' && q.question_type === 'multi_choice' && userAnswer && !isAnswered && (
                      <button className="btn btn-sm btn-primary" style={{ marginTop: 8 }}
                        onClick={() => submitAnswer(q, userAnswer)}>
                        确认多选答案
                      </button>
                    )}
                  </div>
                )}

                {mode === 'answer' && !isEditing && !isAnswered && (
                  <div style={{ marginBottom: 14 }}>
                    {q.question_type === 'true_false' ? (
                      <div style={{ display: 'flex', gap: 10 }}>
                        <button className="btn btn-sm" style={{ background: 'var(--green)', color: '#fff', border: 'none' }}
                          onClick={() => submitAnswer(q, 'true')}>正确</button>
                        <button className="btn btn-sm" style={{ background: 'var(--coral)', color: '#fff', border: 'none' }}
                          onClick={() => submitAnswer(q, 'false')}>错误</button>
                      </div>
                    ) : q.question_type === 'fill_blank' ? (
                      <div style={{ display: 'flex', gap: 8 }}>
                        <input type="text" value={userAnswer || ''}
                          onChange={(e) => setAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
                          placeholder="在此输入答案……"
                          style={{ ...inputStyle, flex: 1 }}
                          onKeyDown={(e) => { if (e.key === 'Enter') submitAnswer(q, userAnswer || ''); }} />
                        <button className="btn btn-sm btn-primary" style={{ flexShrink: 0 }}
                          onClick={() => submitAnswer(q, userAnswer || '')}>提交</button>
                      </div>
                    ) : (q.question_type === 'short_answer' || q.question_type === 'essay') ? (
                      <div>
                        <textarea value={userAnswer || ''}
                          onChange={(e) => setAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
                          rows={q.question_type === 'essay' ? 5 : 3}
                          placeholder="在此作答……"
                          style={{ ...inputStyle, marginBottom: 8 }} />
                        <button className="btn btn-sm btn-primary"
                          onClick={() => submitAnswer(q, userAnswer || '')}>提交（对照答案）</button>
                      </div>
                    ) : null}
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
                      {isAnswered && mode === 'answer' && (
                        <p style={{ marginTop: 8, fontSize: '.9rem' }}>
                          {result === 'correct'
                            ? <strong style={{ color: 'var(--green)' }}>{'✅ 回答正确！'}</strong>
                            : <strong style={{ color: 'var(--coral)' }}>{'❌ 回答错误'}</strong>}
                        </p>
                      )}
                      <p style={{ marginTop: 8 }}>
                        <strong style={{ color: 'var(--green)' }}>答案：</strong>{q.answer}
                      </p>
                      {isAnswered && mode === 'answer' && userAnswer && (
                        <p style={{ marginTop: 4, fontSize: '.85rem' }}>
                          <strong style={{ color: 'var(--slate)' }}>你的答案：</strong>
                          <span style={{ color: result === 'correct' ? 'var(--green)' : 'var(--coral)' }}>{userAnswer}</span>
                        </p>
                      )}
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
