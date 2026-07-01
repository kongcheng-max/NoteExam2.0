import React, { useState } from 'react';
import useSWR from 'swr';
import { api } from '../api';
import { useToast } from '../App';

const fetcher = (fn) => fn().then((r) => r.data);

const diffColors = { basic: 'var(--green)', advanced: 'var(--amber)', challenge: 'var(--coral)' };

export default function Reports() {
  const showToast = useToast();
  const { data: reports = [], mutate, isLoading } = useSWR('reports', () => fetcher(api.getReports));
  const [generating, setGenerating] = useState(false);
  const [expandedId, setExpandedId] = useState(null);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const res = await api.generateReport();
      showToast(res.message || '报告已生成');
      mutate();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setGenerating(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.deleteReport(id);
      showToast('报告已删除');
      mutate();
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  const renderStatBar = (label, value, max = 100) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
      <span style={{ fontSize: '.8rem', color: 'var(--slate)', minWidth: 72 }}>{label}</span>
      <div style={{ flex: 1, background: 'var(--paper)', borderRadius: 100, height: 10, overflow: 'hidden' }}>
        <div style={{
          width: Math.min(value, max) + '%', height: '100%',
          background: value >= 80 ? 'var(--green)' : value >= 50 ? 'var(--amber)' : 'var(--coral)',
          borderRadius: 100, transition: 'width .6s ease',
        }} />
      </div>
      <span style={{ fontSize: '.78rem', color: 'var(--ink)', fontWeight: 500, minWidth: 36 }}>{value}%</span>
    </div>
  );

  return (
    <main style={{ maxWidth: '760px', margin: '0 auto', padding: '32px 20px 60px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.2rem', fontWeight: 600, color: 'var(--ink)' }}>
            学习报告
          </h2>
          <p style={{ fontSize: '.82rem', color: 'var(--slate-light)', marginTop: 4 }}>
            AI 分析你的答题历史和错题记录，生成个性化学习分析
          </p>
        </div>
        <button
          className="btn btn-primary"
          disabled={generating}
          onClick={handleGenerate}
          style={{ whiteSpace: 'nowrap' }}
        >
          {generating ? '生成中……' : '生成新报告'}
        </button>
      </div>

      {isLoading && (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--slate-light)' }}>加载中……</div>
      )}

      {!isLoading && reports.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--slate-light)' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>{'\u{1F4CA}'}</div>
          <div style={{ fontSize: '1rem', fontWeight: 500 }}>暂无学习报告</div>
          <div style={{ fontSize: '.82rem', marginTop: 4, marginBottom: 20 }}>
            完成一些试卷答题后，点击「生成新报告」获取 AI 分析
          </div>
          <button className="btn btn-primary" onClick={handleGenerate} disabled={generating}>
            {generating ? '生成中……' : '生成我的第一份报告'}
          </button>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {reports.map((report) => {
          const c = report.content || {};
          const isExpanded = expandedId === report.id;
          return (
            <div
              key={report.id}
              style={{
                background: '#fff', border: '1px solid var(--border)',
                borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)',
                padding: '24px 28px',
              }}
            >
              {/* 报告头部 */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                <div>
                  <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--ink)', fontFamily: 'var(--font-display)' }}>
                    {report.title}
                  </h3>
                  <div style={{ fontSize: '.75rem', color: 'var(--slate-light)', marginTop: 3 }}>
                    {new Date(report.created_at).toLocaleDateString('zh-CN', {
                      year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
                    })}
                    {' · '}{report.total_exams}份试卷 · {report.total_questions}道题 · 均分{report.avg_score}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <span style={{
                    fontSize: '1.5rem', fontWeight: 700, color: 'var(--ink)',
                    fontFamily: 'var(--font-display)',
                  }}>
                    {report.avg_score}
                  </span>
                  <span style={{ fontSize: '.75rem', color: 'var(--slate-light)' }}>/ 100</span>
                </div>
              </div>

              {/* 摘要 */}
              {c.summary && (
                <p style={{ fontSize: '.85rem', color: 'var(--slate)', lineHeight: 1.7, marginBottom: 14 }}>
                  {c.summary}
                </p>
              )}

              {/* 展开/收起按钮 */}
              <button
                className="btn btn-sm"
                style={{ color: 'var(--slate)', background: 'var(--paper)', border: '1px solid var(--border)' }}
                onClick={() => setExpandedId(isExpanded ? null : report.id)}
              >
                {isExpanded ? '收起详情' : '查看详情'}
              </button>

              {/* 展开详情 */}
              {isExpanded && (
                <div style={{ marginTop: 18, borderTop: '1px solid var(--border)', paddingTop: 18 }}>
                  {/* 各题型得分率 */}
                  {c.statistics?.type_accuracy && (
                    <div style={{ marginBottom: 20 }}>
                      <h4 style={{ fontSize: '.85rem', fontWeight: 600, color: 'var(--ink)', marginBottom: 10 }}>
                        各题型得分率
                      </h4>
                      {Object.entries(c.statistics.type_accuracy).map(([type, val]) => (
                        renderStatBar(
                          { single_choice: '单选题', multi_choice: '多选题', fill_blank: '填空题',
                            true_false: '判断题', short_answer: '简答题', essay: '论述题' }[type] || type,
                          typeof val === 'number' ? val : 0
                        )
                      ))}
                    </div>
                  )}

                  {/* 各难度得分率 */}
                  {c.statistics?.difficulty_accuracy && (
                    <div style={{ marginBottom: 20 }}>
                      <h4 style={{ fontSize: '.85rem', fontWeight: 600, color: 'var(--ink)', marginBottom: 10 }}>
                        各难度得分率
                      </h4>
                      {Object.entries(c.statistics.difficulty_accuracy).map(([diff, val]) => (
                        renderStatBar(
                          { basic: '基础', advanced: '进阶', challenge: '拔高' }[diff] || diff,
                          typeof val === 'number' ? val : 0
                        )
                      ))}
                    </div>
                  )}

                  {/* 优势与薄弱点 */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 20 }}>
                    {c.strengths?.length > 0 && (
                      <div style={{ background: 'var(--green-bg)', borderRadius: 'var(--radius-sm)', padding: 14 }}>
                        <h4 style={{ fontSize: '.82rem', fontWeight: 600, color: 'var(--green)', marginBottom: 8 }}>
                          {'\u{1F3AF}'} 优势领域
                        </h4>
                        <ul style={{ margin: 0, paddingLeft: 18 }}>
                          {c.strengths.map((s, i) => (
                            <li key={i} style={{ fontSize: '.8rem', color: 'var(--slate)', lineHeight: 1.6 }}>{s}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {c.weaknesses?.length > 0 && (
                      <div style={{ background: 'var(--coral-bg)', borderRadius: 'var(--radius-sm)', padding: 14 }}>
                        <h4 style={{ fontSize: '.82rem', fontWeight: 600, color: 'var(--coral)', marginBottom: 8 }}>
                          {'\u26A0\uFE0F'} 需加强
                        </h4>
                        <ul style={{ margin: 0, paddingLeft: 18 }}>
                          {c.weaknesses.map((w, i) => (
                            <li key={i} style={{ fontSize: '.8rem', color: 'var(--slate)', lineHeight: 1.6 }}>{w}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  {/* 错误模式分析 */}
                  {c.error_patterns?.length > 0 && (
                    <div style={{ marginBottom: 20 }}>
                      <h4 style={{ fontSize: '.85rem', fontWeight: 600, color: 'var(--ink)', marginBottom: 10 }}>
                        错误模式分析
                      </h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {c.error_patterns.map((ep, i) => (
                          <div key={i} style={{
                            background: 'var(--paper)', borderRadius: 'var(--radius-sm)',
                            padding: '12px 16px', border: '1px solid var(--border)',
                          }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontSize: '.82rem', fontWeight: 500, color: 'var(--ink)' }}>
                                {ep.pattern}
                              </span>
                              <span style={{
                                fontSize: '.7rem', padding: '2px 8px', borderRadius: 100,
                                background: 'var(--coral-bg)', color: 'var(--coral)', fontWeight: 500,
                              }}>
                                {ep.count}次
                              </span>
                            </div>
                            <p style={{ fontSize: '.78rem', color: 'var(--slate-light)', marginTop: 4 }}>
                              {ep.description}
                            </p>
                            {ep.suggestion && (
                              <p style={{ fontSize: '.78rem', color: 'var(--green)', marginTop: 2 }}>
                                {'\u{1F4A1}'} {ep.suggestion}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 学习建议 */}
                  {c.recommendations?.length > 0 && (
                    <div style={{ marginBottom: 20 }}>
                      <h4 style={{ fontSize: '.85rem', fontWeight: 600, color: 'var(--ink)', marginBottom: 10 }}>
                        学习建议
                      </h4>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {c.recommendations.map((rec, i) => (
                          <div key={i} style={{
                            display: 'flex', alignItems: 'center', gap: 10,
                            padding: '10px 14px', background: 'var(--paper)', borderRadius: 'var(--radius-sm)',
                          }}>
                            <span style={{
                              fontSize: '.68rem', padding: '2px 6px', borderRadius: 4, fontWeight: 600,
                              background: rec.priority === 'high' ? 'var(--coral-bg)' :
                                         rec.priority === 'low' ? 'var(--green-bg)' : 'var(--amber-bg)',
                              color: rec.priority === 'high' ? 'var(--coral)' :
                                     rec.priority === 'low' ? 'var(--green)' : 'var(--amber)',
                            }}>
                              {rec.priority === 'high' ? '优先' : rec.priority === 'low' ? '可选' : '建议'}
                            </span>
                            <div>
                              <div style={{ fontSize: '.82rem', fontWeight: 500, color: 'var(--ink)' }}>{rec.area}</div>
                              <div style={{ fontSize: '.75rem', color: 'var(--slate-light)' }}>{rec.action}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 阶段目标 */}
                  {c.goals?.length > 0 && (
                    <div style={{ marginBottom: 20 }}>
                      <h4 style={{ fontSize: '.85rem', fontWeight: 600, color: 'var(--ink)', marginBottom: 10 }}>
                        {'\u{1F3AF}'} 阶段目标
                      </h4>
                      {c.goals.map((g, i) => (
                        <div key={i} style={{
                          display: 'flex', alignItems: 'center', gap: 12,
                          padding: '10px 14px', border: '1px dashed var(--border)',
                          borderRadius: 'var(--radius-sm)', marginBottom: 6,
                        }}>
                          <span style={{
                            fontSize: '1.2rem', fontWeight: 700, color: 'var(--ink)',
                            fontFamily: 'var(--font-display)',
                          }}>
                            {g.target_score}分
                          </span>
                          <div>
                            <div style={{ fontSize: '.82rem', color: 'var(--ink)' }}>{g.description}</div>
                            {g.timeline && (
                              <div style={{ fontSize: '.72rem', color: 'var(--slate-light)' }}>{g.timeline}</div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* 删除按钮 */}
                  <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
                    <button
                      className="btn btn-sm btn-danger"
                      onClick={() => handleDelete(report.id)}
                    >
                      删除此报告
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </main>
  );
}
