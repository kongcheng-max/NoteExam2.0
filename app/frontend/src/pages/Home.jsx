import React, { useState, useCallback } from 'react';
import useSWR from 'swr';
import { api } from '../api';
import { useToast } from '../App';
import LoadingOverlay from '../components/LoadingOverlay';
import ExamModal from '../components/ExamModal';

const fetcher = (fn) => fn().then((r) => r.data);

const QUESTION_TYPES = [
  { key: 'single_choice', label: '单选' },
  { key: 'multi_choice', label: '多选' },
  { key: 'true_false', label: '判断' },
  { key: 'fill_blank', label: '填空' },
  { key: 'short_answer', label: '简答' },
  { key: 'essay', label: '论述' },
];
const DIFFICULTIES = [
  { key: 'basic', label: '基础' },
  { key: 'advanced', label: '进阶' },
  { key: 'challenge', label: '拔高' },
];

export default function Home() {
  const showToast = useToast();
  const { data: notes = [], mutate: mutateNotes } = useSWR('notes', () => fetcher(api.getNotes));
  const { data: exams = [], mutate: mutateExams } = useSWR('exams', () => fetcher(api.getExams));

  const [content, setContent] = useState('');
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState({ show: false, text: '', sub: '' });
  const [examView, setExamView] = useState(null);
  const [knowledgeView, setKnowledgeView] = useState(null);

  // BUG-015: exam config state
  const [examConfig, setExamConfig] = useState({
    // noteId set at generate time
    questionTypes: ['single_choice', 'multi_choice', 'true_false', 'fill_blank', 'short_answer'],
    difficulties: ['basic', 'advanced', 'challenge'],
    totalQuestions: 20,
  });

  // BUG-016: delete confirmation
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const toggleType = (key) => {
    setExamConfig((c) => ({
      ...c,
      questionTypes: c.questionTypes.includes(key)
        ? c.questionTypes.filter((t) => t !== key)
        : [...c.questionTypes, key],
    }));
  };
  const toggleDiff = (key) => {
    setExamConfig((c) => ({
      ...c,
      difficulties: c.difficulties.includes(key)
        ? c.difficulties.filter((d) => d !== key)
        : [...c.difficulties, key],
    }));
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    const trimmed = content.trim();
    if (!trimmed) return showToast('请输入笔记内容', 'error');
    if (trimmed.length > 50000) return showToast('笔记内容不能超过 50,000 字符', 'error');
    setUploading(true);
    try {
      await api.createNote(trimmed);
      showToast('笔记上传成功');
      setContent('');
      mutateNotes();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setUploading(false);
    }
  };

  // BUG-016: confirm before delete
  const handleDeleteNote = async (id) => {
    setDeleteConfirm({ type: 'note', id });
  };
  const handleDeleteExam = async (id) => {
    setDeleteConfirm({ type: 'exam', id });
  };
  const confirmDelete = async () => {
    if (!deleteConfirm) return;
    const { type, id } = deleteConfirm;
    setDeleteConfirm(null);
    try {
      if (type === 'note') {
        await api.deleteNote(id);
        showToast('笔记已删除');
        mutateNotes();
        mutateExams();
      } else {
        await api.deleteExam(id);
        showToast('试卷已删除');
        mutateExams();
        mutateNotes();
      }
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  // BUG-014: fetch knowledge points + BUG-015: pass config
  const handleGenerate = async (noteId) => {
    setLoading({ show: true, text: 'AI 正在分析笔记，提取知识点……', sub: '这可能需要 10–30 秒' });
    try {
      const res = await api.generateExam(noteId, {
        questionTypes: examConfig.questionTypes,
        difficulties: examConfig.difficulties,
        totalQuestions: examConfig.totalQuestions,
      });
      showToast(res.message || '试卷生成成功');
      mutateExams();

      // BUG-014: fetch knowledge points
      try {
        const kpRes = await api.getKnowledgePoints(noteId);
        setKnowledgeView(kpRes.data || []);
      } catch { /* ignore */ }

      if (res.data?.exam_id) {
        setLoading({ show: true, text: '加载试卷中……', sub: '' });
        const examRes = await api.getExam(res.data.exam_id);
        setExamView(examRes.data);
      }
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleViewExam = async (examId) => {
    try {
      const res = await api.getExam(examId);
      setExamView(res.data);
    } catch (err) {
      showToast(err.message, 'error');
    }
  };

  return (
    <>
      <div className="container">
        {/* Upload */}
        <section className="card" style={{ marginBottom: 36, textAlign: 'center' }}>
          <div style={{
            width: 44, height: 44, borderRadius: '50%', background: 'var(--paper)',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1.4rem', color: 'var(--ink-light)', marginBottom: 16,
          }}>+</div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.25rem', fontWeight: 600, marginBottom: 6 }}>
            上传你的学习笔记
          </h2>
          <p style={{ fontSize: '.9rem', color: 'var(--slate)', marginBottom: 24 }}>
            粘贴文本内容，AI 将自动提取知识点并生成试卷
          </p>
          <form onSubmit={handleUpload}>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="在此粘贴你的笔记内容……&#10;&#10;例如：课堂笔记、读书摘录、知识点总结……"
              rows={8}
              maxLength={50000}
              style={{
                width: '100%', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)', padding: 14,
                fontFamily: 'var(--font-body)', fontSize: '.9rem',
                color: 'var(--ink)', background: 'var(--paper)',
                resize: 'vertical', lineHeight: 1.7, outline: 'none',
              }}
            />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 }}>
              <span style={{
                fontSize: '.78rem',
                color: content.length > 50000 ? 'var(--coral)' : 'var(--slate-light)',
              }}>
                {content.length.toLocaleString()} / 50,000
              </span>
              <button type="submit" className="btn btn-primary" disabled={uploading}>
                {uploading ? '上传中……' : '上传笔记'}
              </button>
            </div>
          </form>
        </section>

        {/* Notes List */}
        {notes.length > 0 && (
          <>
            <div style={{
              display: 'flex', alignItems: 'baseline', gap: 10, margin: '36px 0 16px',
            }}>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.15rem', fontWeight: 600 }}>
                我的笔记
              </h2>
              <span style={{ fontSize: '.8rem', color: 'var(--slate-light)' }}>
                {notes.length} 篇
              </span>
            </div>

            {/* BUG-015: Exam config panel */}
            <div className="card" style={{ marginBottom: 16, padding: 20 }}>
              <p style={{ fontSize: '.85rem', fontWeight: 500, color: 'var(--ink)', marginBottom: 10 }}>出题配置</p>
              <div style={{ marginBottom: 10 }}>
                <span style={{ fontSize: '.78rem', color: 'var(--slate-light)', marginRight: 8 }}>题型：</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {QUESTION_TYPES.map((t) => (
                    <button
                      key={t.key}
                      onClick={() => toggleType(t.key)}
                      style={{
                        padding: '4px 12px', border: '1px solid var(--border)',
                        borderRadius: 100, fontSize: '.78rem', cursor: 'pointer',
                        background: examConfig.questionTypes.includes(t.key) ? 'var(--ink)' : '#fff',
                        color: examConfig.questionTypes.includes(t.key) ? '#fff' : 'var(--slate)',
                        fontWeight: 500,
                      }}
                    >{t.label}</button>
                  ))}
                </div>
              </div>
              <div style={{ marginBottom: 10 }}>
                <span style={{ fontSize: '.78rem', color: 'var(--slate-light)', marginRight: 8 }}>难度：</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {DIFFICULTIES.map((d) => (
                    <button
                      key={d.key}
                      onClick={() => toggleDiff(d.key)}
                      style={{
                        padding: '4px 12px', border: '1px solid var(--border)',
                        borderRadius: 100, fontSize: '.78rem', cursor: 'pointer',
                        background: examConfig.difficulties.includes(d.key) ? 'var(--ink)' : '#fff',
                        color: examConfig.difficulties.includes(d.key) ? '#fff' : 'var(--slate)',
                        fontWeight: 500,
                      }}
                    >{d.label}</button>
                  ))}
                </div>
              </div>
              <div>
                <span style={{ fontSize: '.78rem', color: 'var(--slate-light)', marginRight: 8 }}>题数：</span>
                <input
                  type="number" min={5} max={50}
                  value={examConfig.totalQuestions}
                  onChange={(e) => setExamConfig((c) => ({ ...c, totalQuestions: parseInt(e.target.value) || 20 }))}
                  style={{
                    width: 72, padding: '4px 8px', border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)', fontSize: '.85rem', textAlign: 'center',
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {notes.map((n) => (
                <div key={n.id} style={{
                  background: '#fff', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)',
                  padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 16,
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: '.95rem', fontWeight: 500, color: 'var(--ink)',
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>
                      {n.content.substring(0, 80)}
                    </div>
                    <div style={{ fontSize: '.78rem', color: 'var(--slate-light)', marginTop: 2 }}>
                      <span style={{
                        display: 'inline-block', padding: '3px 10px',
                        borderRadius: 100, fontSize: '.72rem', fontWeight: 500,
                        background: 'var(--paper)', color: 'var(--ink-light)',
                      }}>
                        {n.note_type}
                      </span>
                      {' '}{new Date(n.created_at).toLocaleDateString('zh-CN')}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                    <button className="btn btn-sm btn-primary" onClick={() => handleGenerate(n.id)}>出题</button>
                    <button className="btn btn-sm btn-danger" onClick={() => handleDeleteNote(n.id)}>删除</button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* BUG-014: Knowledge Points Display */}
        {knowledgeView && knowledgeView.length > 0 && (
          <>
            <div style={{
              display: 'flex', alignItems: 'baseline', gap: 10, margin: '36px 0 16px',
            }}>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.15rem', fontWeight: 600 }}>
                提取的知识点
              </h2>
              <span style={{ fontSize: '.8rem', color: 'var(--slate-light)' }}>
                {knowledgeView.length} 个
              </span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 24 }}>
              {knowledgeView.map((kp) => (
                <span key={kp.id} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '6px 14px', background: '#fff',
                  border: '1px solid var(--border)', borderRadius: 100,
                  fontSize: '.82rem', color: 'var(--ink)',
                }}>
                  <span style={{ fontWeight: 500 }}>{kp.name}</span>
                  <span style={{ fontSize: '.68rem', color: 'var(--slate-light)' }}>{kp.importance === 'high' ? '★高' : kp.importance === 'normal' ? '中' : '低'}</span>
                </span>
              ))}
            </div>
          </>
        )}

        {/* Exams List */}
        {exams.length > 0 && (
          <>
            <div style={{
              display: 'flex', alignItems: 'baseline', gap: 10, margin: '36px 0 16px',
            }}>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.15rem', fontWeight: 600 }}>
                已生成的试卷
              </h2>
              <span style={{ fontSize: '.8rem', color: 'var(--slate-light)' }}>
                {exams.length} 份
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {exams.map((e) => (
                <div key={e.id} style={{
                  background: '#fff', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)',
                  padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 16,
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: '.95rem', fontWeight: 500, color: 'var(--ink)',
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>
                      {e.title}
                    </div>
                    <div style={{ fontSize: '.78rem', color: 'var(--slate-light)', marginTop: 2 }}>
                      <span style={{
                        display: 'inline-block', padding: '3px 10px',
                        borderRadius: 100, fontSize: '.72rem', fontWeight: 500,
                        background: 'var(--paper)', color: 'var(--slate)',
                      }}>
                        {e.question_count} 题
                      </span>
                      {' '}{new Date(e.created_at).toLocaleDateString('zh-CN')}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                    <button className="btn btn-sm btn-primary" onClick={() => handleViewExam(e.id)}>查看</button>
                    <button className="btn btn-sm btn-danger" onClick={() => handleDeleteExam(e.id)}>删除</button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {loading.show && <LoadingOverlay text={loading.text} sub={loading.sub} />}
      {examView && <ExamModal exam={examView} onClose={() => setExamView(null)} />}

      {/* BUG-016: Delete Confirm Modal */}
      {deleteConfirm && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 250,
          background: 'rgba(15,23,42,.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            background: '#fff', borderRadius: 'var(--radius)',
            boxShadow: 'var(--shadow-lg)', padding: 28,
            maxWidth: 380, width: '90%', textAlign: 'center',
            animation: 'modalIn .2s ease',
          }}>
            <p style={{ fontSize: '.95rem', color: 'var(--ink)', marginBottom: 6 }}>
              确定删除此{deleteConfirm.type === 'note' ? '笔记' : '试卷'}？
            </p>
            <p style={{ fontSize: '.82rem', color: 'var(--slate-light)', marginBottom: 20 }}>
              {deleteConfirm.type === 'note' ? '关联的知识点和试卷也会一并删除' : '试卷中的试题也会一并删除'}
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button className="btn btn-sm" onClick={() => setDeleteConfirm(null)}
                style={{ color: 'var(--slate)', background: 'var(--paper)', border: '1px solid var(--border)' }}>
                取消
              </button>
              <button className="btn btn-sm btn-danger" onClick={confirmDelete}>
                确认删除
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
