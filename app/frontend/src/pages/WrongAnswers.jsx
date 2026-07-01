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
  const { data: stats } = useSWR('wrong-answers-stats', () => fetcher(api.getWrongAnswerStats));
  const { data: analyses = [], mutate: mutateAnalyses } = useSWR('wrong-answer-analyses', () => fetcher(api.getWrongAnswerAnalyses));
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [expandedId, setExpandedId] = useState(null);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [expandedAnalysisId, setExpandedAnalysisId] = useState(null);

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
      showToast('已创建复习笔记，可在首页生成试卷');
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

  const handleAnalyze = async () => {
    setAnalyzing(true);
    try {
      const res = await api.analyzeWrongAnswers();
      showToast(res.message || '分析完成');
      mutateAnalyses();
      setShowAnalysis(true);
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleDeleteAnalysis = async (id) => {
    try {
      await api.deleteWrongAnswerAnalysis(id);
      showToast('分析记录已删除');
      mutateAnalyses();
    } catch (err) { showToast(err.message, 'error'); }
  };

  return (
    <main style={{ maxWidth: '760px', margin: '0 auto', padding: '32px 20px 60px' }}>
      {/* 页面头部 */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', fontWeight: 600, color: 'var(--ink)' }}>
          错题本
        </h2>
        <p style={{ fontSize: '.82rem', color: 'var(--slate-light)', marginTop: 4 }}>
          共 {items.length} 道错题
        </p>
      </div>

      {/* V2.0: 统计分析概览 */}
      {stats && stats.total > 0 && (
        <div style={{
          background: '#fff', border: '1px solid var(--border)',
          borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)',
          padding: '18px 24px', marginBottom: 20,
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 14,
        }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--ink)', fontFamily: 'var(--font-display)' }}>
              {stats.total}
            </div>
            <div style={{ fontSize: '.72rem', color: 'var(--slate-light)' }}>错题总数</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--green)', fontFamily: 'var(--font-display)' }}>
              {stats.reviewed}
            </div>
            <div style={{ fontSize: '.72rem', color: 'var(--slate-light)' }}>已复习</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--coral)', fontFamily: 'var(--font-display)' }}>
              {stats.unreviewed}
            </div>
            <div style={{ fontSize: '.72rem', color: 'var(--slate-light)' }}>未复习</div>
          </div>
          {stats.by_type && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '.75rem', color: 'var(--slate)', display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 4 }}>
                {Object.entries(stats.by_type).map(([t, c]) => (
                  <span key={t} style={{ padding: '1px 6px', borderRadius: 100, background: 'var(--paper)', fontSize: '.7rem' }}>
                    {typeNames[t] || t} {c}
                  </span>
                ))}
              </div>
              <div style={{ fontSize: '.72rem', color: 'var(--slate-light)', marginTop: 2 }}>题型分布</div>
            </div>
          )}
        </div>
      )}

      {/* V2.0: 智能分析按钮 */}
      {items.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <button
            className="btn btn-sm"
            style={{ color: '#fff', background: 'var(--ink)', border: 'none' }}
            disabled={analyzing}
            onClick={handleAnalyze}
          >
            {analyzing ? 'AI 分析中……' : '\u{1F9E0} AI 智能分析错题'}
          </button>
        </div>
      )}

      {/* V2.0: 展示分析结果 */}
      {analyses.length > 0 && showAnalysis && (
        <div style={{
          background: '#fff', border: '1px solid var(--border)',
          borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)',
          padding: '20px 24px', marginBottom: 20,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h3 style={{ fontSize: '.9rem', fontWeight: 600, color: 'var(--ink)' }}>
              {'\u{1F9E0}'} AI 错题分析结果
            </h3>
            <button className="btn btn-sm" style={{
              color: 'var(--slate)', background: 'var(--paper)', border: '1px solid var(--border)',
            }} onClick={() => setShowAnalysis(false)}>收起</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {analyses.slice(0, 3).map((analysis) => {
              const a = analysis.analysis_data || {};
              const isExpanded = expandedAnalysisId === analysis.id;
              const weakKps = analysis.weak_kps || [];
              return (
                <div key={analysis.id} style={{
                  background: 'var(--paper)', borderRadius: 'var(--radius-sm)', padding: '14px 18px',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <span style={{ fontSize: '.82rem', fontWeight: 500, color: 'var(--ink)' }}>
                        {new Date(analysis.created_at).toLocaleDateString('zh-CN')} · {analysis.total_wrong}道错题分析
                      </span>
                      {a.summary && (
                        <p style={{ fontSize: '.75rem', color: 'var(--slate-light)', marginTop: 3 }}>{a.summary}</p>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-sm" style={{
                        color: 'var(--slate)', background: '#fff', border: '1px solid var(--border)',
                        fontSize: '.72rem', padding: '4px 10px',
                      }} onClick={() => setExpandedAnalysisId(isExpanded ? null : analysis.id)}>
                        {isExpanded ? '收起' : '详情'}
                      </button>
                      <button className="btn btn-sm btn-danger" style={{
                        fontSize: '.72rem', padding: '4px 10px',
                      }} onClick={() => handleDeleteAnalysis(analysis.id)}>
                        删除
                      </button>
                    </div>
                  </div>

                  {/* 薄弱知识点标签 */}
                  {weakKps.length > 0 && (
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                      {weakKps.map((kp, i) => (
                        <span key={i} style={{
                          fontSize: '.7rem', padding: '3px 10px', borderRadius: 100,
                          background: kp.severity === 'high' ? 'var(--coral-bg)' : 'var(--amber-bg)',
                          color: kp.severity === 'high' ? 'var(--coral)' : 'var(--amber)',
                          fontWeight: 500,
                        }}>
                          {kp.name} ({kp.error_count}次)
                        </span>
                      ))}
                    </div>
                  )}

                  {/* 展开详情 */}
                  {isExpanded && (
                    <div style={{ marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                      {/* 按题型分布 */}
                      {a.by_type && (
                        <div style={{ marginBottom: 10 }}>
                          <div style={{ fontSize: '.75rem', fontWeight: 500, color: 'var(--slate)', marginBottom: 4 }}>题型分布</div>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            {Object.entries(a.by_type).map(([t, c]) => (
                              <span key={t} style={{
                                fontSize: '.7rem', padding: '2px 8px', borderRadius: 100,
                                background: 'var(--paper)', color: 'var(--slate)',
                              }}>
                                {typeNames[t] || t}: {c}题
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* 错误原因 */}
                      {a.error_causes?.length > 0 && (
                        <div style={{ marginBottom: 10 }}>
                          <div style={{ fontSize: '.75rem', fontWeight: 500, color: 'var(--slate)', marginBottom: 4 }}>错误原因</div>
                          {a.error_causes.map((ec, i) => (
                            <div key={i} style={{
                              display: 'flex', justifyContent: 'space-between',
                              fontSize: '.73rem', color: 'var(--slate-light)', padding: '2px 0',
                            }}>
                              <span>{ec.cause}</span>
                              <span>{ec.count}次 ({ec.percentage}%)</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* 提升计划 */}
                      {a.improvement_plan?.length > 0 && (
                        <div>
                          <div style={{ fontSize: '.75rem', fontWeight: 500, color: 'var(--slate)', marginBottom: 4 }}>提升计划</div>
                          {a.improvement_plan.map((ip, i) => (
                            <div key={i} style={{
                              display: 'flex', alignItems: 'center', gap: 8,
                              padding: '6px 10px', background: '#fff', borderRadius: 4,
                              marginBottom: 4, fontSize: '.73rem',
                            }}>
                              <span style={{ color: 'var(--ink)', fontWeight: 500 }}>{ip.focus}</span>
                              <span style={{ color: 'var(--slate-light)' }}>{ip.method}</span>
                              <span style={{
                                marginLeft: 'auto', fontSize: '.68rem', color: 'var(--slate-light)',
                              }}>{ip.expected_effort}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 操作栏 */}
      {items.length > 0 && (
        <div style={{ marginBottom: 16, display: 'flex', gap: 8 }}>
          <button className="btn btn-sm"
            onClick={() => setSelectedIds(selectedIds.size === items.length ? new Set() : new Set(items.map(i => i.id)))}
            style={{ color: 'var(--slate)', background: 'var(--paper)', border: '1px solid var(--border)' }}>
            {selectedIds.size === items.length ? '取消全选' : '全选'}
          </button>
          <button className="btn btn-sm btn-primary"
            disabled={selectedIds.size === 0}
            onClick={handleRetrySelected}>
            {selectedIds.size > 0 ? '重做选中 ' + selectedIds.size + ' 题' : '重做错题'}
          </button>
        </div>
      )}

      {/* 空状态 */}
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
                  <input
                    type="checkbox"
                    checked={selectedIds.has(item.id)}
                    onChange={() => toggleSelect(item.id)}
                    style={{ marginTop: 4, accentColor: 'var(--ink)' }}
                  />
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
