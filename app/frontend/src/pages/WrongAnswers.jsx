import React, { useState } from 'react';
import useSWR from 'swr';
import { api } from '../api';
import { useToast } from '../App';
import { useNavigate } from 'react-router-dom';

const fetcher = (fn) => fn().then((r) => r.data);

const typeNames = {
  single_choice: '单选', multi_choice: '多选', fill_blank: '填空',
  true_false: '判断', short_answer: '简答', essay: '论述',
};
const diffNames = { basic: '基础', advanced: '进阶', challenge: '拔高' };
const diffColors = { basic: 'var(--green)', advanced: 'var(--amber)', challenge: 'var(--coral)' };

export default function WrongAnswers() {
  const showToast = useToast();
  const navigate = useNavigate();
  const { data: items = [], mutate } = useSWR('wrong-answers', () => fetcher(api.getWrongAnswers));
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [expandedId, setExpandedId] = useState(null);

  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleRetrySelected = async () => {
    const selected = items.filter(item => selectedIds.has(item.id));
    if (selected.length === 0) return showToast('请先选择错题', 'error');
    const stems = selected.map(item => item.question?.content?.stem || '').filter(Boolean).join('\n\n');
    if (!stems) return showToast('所选错题无有效内容', 'error');
    try {
      const res = await api.createNote(stems);
      showToast('\u5df2\u521b\u5efa\u590d\u4e60\u7b14\u8bb0\uff0c\u53ef\u5728\u9996\u9875\u751f\u6210\u8bd5\u5377');
      navigate('/');
    } catch (err) { showToast(err.message, 'error'); }
  };

  const handleReview = async (id) => {
    try {
      await api.reviewWrong(id);
      showToast('已复习');
      mutate();
    } catch (err) { showToast(err.message, 'error'); }
  };

  const handleRemove = async (id) => {
    try {
      const item = items.find((x) => x.id === id);
      await api.unmarkWrong(item.question_id);
      showToast('已移出错题本');
      mutate();
    } catch (err) { showToast(err.message, 'error'); }
  };

  const handleDelete = async (id) => {
    try {
      await api.deleteWrong(id);
      showToast('已删除');
      mutate();
    } catch (err) { showToast(err.message, 'error'); }
  };

  return (
    <main style={{ maxWidth: '760px', margin: '0 auto', padding: '32px 20px 60px' }}>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', fontWeight: 600, color: 'var(--ink)' }}>
          错题本
        </h2>
        <p style={{ fontSize: '.82rem', color: 'var(--slate-light)', marginTop: 4 }}>
          共 {items.length} 道错题
        </p>
        {items.length > 0 && (
          <div style={{ marginTop: 14, display: 'flex', gap: 8 }}>
            <button className="btn btn-sm"
              onClick={() => setSelectedIds(selectedIds.size === items.length ? new Set() : new Set(items.map(i => i.id)))}
              style={{ color: 'var(--slate)', background: 'var(--paper)', border: '1px solid var(--border)' }}>
              {selectedIds.size === items.length ? '\u53d6\u6d88\u5168\u9009' : '\u5168\u9009'}
            </button>
            <button className="btn btn-sm btn-primary"
              disabled={selectedIds.size === 0}
              onClick={handleRetrySelected}>
              {selectedIds.size > 0 ? '\u91cd\u505a\u9009\u4e2d ' + selectedIds.size + ' \u9898' : '\u91cd\u505a\u9519\u9898'}
            </button>
          </div>
        )}
      </div>

      {items.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--slate-light)' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>{'\u2705'}</div>
          <div style={{ fontSize: '1rem', fontWeight: 500 }}>暂无错题</div>
          <div style={{ fontSize: '.82rem', marginTop: 4 }}>在试卷预览中点击「错题」按钮标记</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {items.map((item) => {
            const q = item.question;
            const isExpanded = expandedId === item.id;
            return (
              <div
                key={item.id}
                style={{
                  background: '#fff', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)',
                  padding: '20px 24px',
                  borderLeft: '3px solid ' + (diffColors[q?.difficulty] || 'var(--border)'),
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
                      <span style={{
                        fontSize: '.7rem', padding: '2px 8px', borderRadius: 100, fontWeight: 500,
                        background: 'var(--paper)', color: 'var(--slate)',
                      }}>
                        {typeNames[q?.question_type] || q?.question_type || '未知'}
                      </span>
                      <span style={{
                        fontSize: '.7rem', padding: '2px 8px', borderRadius: 100, fontWeight: 500,
                        background: 'var(--paper)', color: diffColors[q?.difficulty] || 'var(--slate)',
                      }}>
                        {diffNames[q?.difficulty] || q?.difficulty}
                      </span>
                      <span style={{ fontSize: '.7rem', color: 'var(--slate-light)' }}>
                        复习 {item.review_count} 次
                      </span>
                    </div>
                    <div
                      style={{ fontSize: '.88rem', lineHeight: 1.6, color: 'var(--ink)', cursor: 'pointer' }}
                      onClick={() => setExpandedId(isExpanded ? null : item.id)}
                    >
                      {q?.content?.stem || '(无题干)'}
                    </div>

                    {isExpanded && (
                      <div style={{ marginTop: 14, borderTop: '1px solid var(--border)', paddingTop: 14 }}>
                        {q?.content?.options?.length > 0 && (
                          <div style={{ marginBottom: 12 }}>
                            {q.content.options.map((opt, j) => (
                              <div key={j} style={{
                                padding: '6px 12px', marginBottom: 4, fontSize: '.85rem',
                                background: 'var(--paper)', borderRadius: 4, color: 'var(--slate)',
                              }}>
                                {opt}
                              </div>
                            ))}
                          </div>
                        )}
                        <div style={{
                          background: 'var(--green-bg)', padding: '10px 14px', borderRadius: 4,
                          fontSize: '.85rem', marginBottom: 6,
                        }}>
                          <strong style={{ color: 'var(--green)' }}>正确答案：</strong>{q?.answer}
                        </div>
                        {q?.explanation && (
                          <div style={{ fontSize: '.82rem', color: 'var(--slate-light)', lineHeight: 1.6 }}>
                            {q.explanation}
                          </div>
                        )}
                        {item.user_answer && (
                          <div style={{
                            background: 'var(--coral-bg)', padding: '10px 14px', borderRadius: 4,
                            fontSize: '.85rem', marginTop: 8,
                          }}>
                            <strong style={{ color: 'var(--coral)' }}>我的答案：</strong>{item.user_answer}
                          </div>
                        )}
                        {item.note && (
                          <div style={{ fontSize: '.82rem', color: 'var(--slate-light)', marginTop: 8, fontStyle: 'italic' }}>
                            备注：{item.note}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
                  <button
                    className="btn btn-sm"
                    style={{ color: 'var(--slate)', background: 'var(--paper)', border: '1px solid var(--border)' }}
                    onClick={() => setExpandedId(isExpanded ? null : item.id)}
                  >
                    {isExpanded ? '收起' : '展开'}
                  </button>
                  <button
                    className="btn btn-sm"
                    style={{ color: '#fff', background: 'var(--green)', border: 'none' }}
                    onClick={() => handleReview(item.id)}
                  >
                    已复习
                  </button>
                  <button
                    className="btn btn-sm"
                    style={{ color: '#B45309', background: 'var(--amber-bg)', border: 'none' }}
                    onClick={() => handleRemove(item.id)}
                  >
                    移出
                  </button>
                  <button
                    className="btn btn-sm btn-danger"
                    onClick={() => handleDelete(item.id)}
                  >
                    删除
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
