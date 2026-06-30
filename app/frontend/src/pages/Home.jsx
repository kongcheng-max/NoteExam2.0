import React, { useState, useRef, useCallback } from 'react';
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
];
const DIFFICULTIES = [
  { key: 'basic', label: '基础' },
  { key: 'advanced', label: '进阶' },
  { key: 'challenge', label: '拔高' },
];

const UPLOAD_MODES = [
  { key: 'text', label: '粘贴文本' },
  { key: 'image', label: '上传图片' },
  { key: 'pdf', label: '上传PDF' },
];

export default function Home() {
  const showToast = useToast();
  const { data: notes = [], mutate: mutateNotes } = useSWR('notes', () => fetcher(api.getNotes));
  const { data: exams = [], mutate: mutateExams } = useSWR('exams', () => fetcher(api.getExams));

  const [content, setContent] = useState('');
  const [uploadMode, setUploadMode] = useState('text');
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [loading, setLoading] = useState({ show: false, text: '', sub: '' });
  const [examView, setExamView] = useState(null);
  const [knowledgeView, setKnowledgeView] = useState(null);
  const [knowledgeNoteId, setKnowledgeNoteId] = useState(null);
  const [editKp, setEditKp] = useState(null);
  const [newKp, setNewKp] = useState({ name: '', category: '', importance: 'normal' });
  const fileInputRef = useRef(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [ocrPolling, setOcrPolling] = useState({});
  const [ocrEditId, setOcrEditId] = useState(null);
  const [ocrEditText, setOcrEditText] = useState('');

  const [examConfig, setExamConfig] = useState({
    questionTypes: ['single_choice', 'multi_choice', 'true_false', 'fill_blank'],
    difficulties: ['basic', 'advanced', 'challenge'],
    totalQuestions: 20,
  });

  const [deleteConfirm, setDeleteConfirm] = useState(null);

  const toggleType = (key) => {
    setExamConfig((c) => ({ ...c,
      questionTypes: c.questionTypes.includes(key)
        ? c.questionTypes.filter((t) => t !== key)
        : [...c.questionTypes, key],
    }));
  };
  const toggleDiff = (key) => {
    setExamConfig((c) => ({ ...c,
      difficulties: c.difficulties.includes(key)
        ? c.difficulties.filter((d) => d !== key)
        : [...c.difficulties, key],
    }));
  };

  // 文本上传
  const handleUpload = async (e) => {
    e.preventDefault();
    const trimmed = content.trim();
    if (!trimmed) return showToast('请输入笔记内容', 'error');
    if (trimmed.length > 50000) return showToast('内容超过50,000字符限制', 'error');
    setUploading(true);
    try {
      await api.createNote(trimmed);
      showToast('笔记上传成功');
      setContent('');
      mutateNotes();
    } catch (err) { showToast(err.message, 'error'); }
    finally { setUploading(false); }
  };

  // 文件上传（含 OCR 进度轮询）
  const pollOcrResult = async (noteId) => {
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 2000));
      try {
        const res = await api.getNote(noteId);
        if (res.data?.content && res.data.content.trim()) {
          setOcrPolling((p) => ({ ...p, [noteId]: 'done' }));
          mutateNotes();
          return;
        }
        setOcrPolling((p) => ({ ...p, [noteId]: 'polling' }));
      } catch { break; }
    }
    setOcrPolling((p) => ({ ...p, [noteId]: 'timeout' }));
  };

  const handleUpdateNoteContent = async (noteId) => {
    if (!ocrEditText.trim()) return showToast('内容不能为空', 'error');
    try {
      await api.updateNote(noteId, ocrEditText.trim());
      showToast('笔记内容已更新');
      setOcrEditId(null);
      setOcrEditText('');
      mutateNotes();
    } catch (err) { showToast(err.message, 'error'); }
  };

  const handleFileUpload = async () => {
    if (!selectedFile) return showToast('请选择文件', 'error');
    setUploading(true);
    const noteType = uploadMode === 'pdf' ? 'pdf' : 'image';
    try {
      const res = await api.uploadFile(selectedFile, noteType);
      const noteId = res.data?.id;
      showToast(res.message || '文件上传成功，正在处理...');
      setSelectedFile(null);
      setPreviewUrl(null);
      mutateNotes();
      if (noteId) {
        setOcrPolling((p) => ({ ...p, [noteId]: 'polling' }));
        pollOcrResult(noteId);
      }
    } catch (err) { showToast(err.message, 'error'); }
    finally { setUploading(false); }
  };

  const handleFileDrop = useCallback((e) => {
    e.preventDefault();
    const file = e.dataTransfer?.files?.[0];
    if (file) {
      const ext = file.name.split('.').pop().toLowerCase();
      if (uploadMode === 'image' && !['jpg', 'jpeg', 'png'].includes(ext)) {
        return showToast('仅支持 JPG/PNG 格式图片', 'error');
      }
      if (uploadMode === 'pdf' && ext !== 'pdf') {
        return showToast('仅支持 PDF 格式文件', 'error');
      }
      setSelectedFile(file);
    }
  }, [uploadMode, showToast]);

  // 知识点管理
  const handleViewKnowledge = async (noteId) => {
    setKnowledgeNoteId(noteId);
    try {
      const res = await api.getKnowledgePoints(noteId);
      setKnowledgeView(res.data || []);
      setEditKp(null);
      setNewKp({ name: '', category: '', importance: 'normal' });
    } catch { showToast('加载知识点失败', 'error'); }
  };

  const handleAddKp = async () => {
    if (!newKp.name.trim()) return showToast('名称不能为空', 'error');
    try {
      await api.addKnowledgePoint(knowledgeNoteId, newKp);
      showToast('知识点已添加');
      setNewKp({ name: '', category: '', importance: 'normal' });
      handleViewKnowledge(knowledgeNoteId);
    } catch (err) { showToast(err.message, 'error'); }
  };

  const handleUpdateKp = async (kpId, name) => {
    try {
      await api.updateKnowledgePoint(knowledgeNoteId, kpId, { name });
      showToast('已更新');
      setEditKp(null);
      handleViewKnowledge(knowledgeNoteId);
    } catch (err) { showToast(err.message, 'error'); }
  };

  const handleDeleteKp = async (kpId) => {
    try {
      await api.deleteKnowledgePoint(knowledgeNoteId, kpId);
      showToast('已删除');
      handleViewKnowledge(knowledgeNoteId);
    } catch (err) { showToast(err.message, 'error'); }
  };

  const handleDeleteNote = async (noteId) => {
    try {
      await api.deleteNote(noteId);
      showToast('笔记已删除');
      mutateNotes();
      mutateExams();
      setDeleteConfirm(null);
    } catch (err) { showToast(err.message, 'error'); }
  };

  const handleDeleteExam = async (examId) => {
    try {
      await api.deleteExam(examId);
      showToast('试卷已删除');
      mutateExams();
      setDeleteConfirm(null);
    } catch (err) { showToast(err.message, 'error'); }
  };

  const confirmDelete = () => {
    if (!deleteConfirm) return;
    if (deleteConfirm.type === 'note') handleDeleteNote(deleteConfirm.id);
    else handleDeleteExam(deleteConfirm.id);
  };

  // 生成试卷
  const handleGenerate = async (noteId) => {
    if (examConfig.questionTypes.length === 0) {
      return showToast('请至少选择一种题型', 'error');
    }
    if (examConfig.difficulties.length === 0) {
      return showToast('请至少选择一种难度', 'error');
    }
    setLoading({ show: true, text: 'AI 正在分析笔记，提取知识点……', sub: '这可能需要 10-30 秒' });
    try {
      const res = await api.generateExam(noteId, examConfig);
      showToast(res.message || '试卷生成成功');
      setKnowledgeView(null);
      setKnowledgeNoteId(null);
      mutateNotes();
      mutateExams();
    } catch (err) { showToast(err.message, 'error'); }
    finally { setLoading(false); }
  };

  // 查看试卷
  const handleViewExam = async (examId) => {
    try {
      setLoading({ show: true, text: '加载试卷中……', sub: '' });
      const res = await api.getExam(examId);
      setExamView(res.data);
    } catch (err) { showToast(err.message, 'error'); }
    finally { setLoading(false); }
  };

  return (
    <div className="container">
      {/* 上传区域 */}
      <div className="card" style={{ marginBottom: 32 }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem', fontWeight: 700, marginBottom: 6 }}>
          上传你的学习笔记
        </h1>
        <p style={{ color: 'var(--slate-light)', fontSize: '.88rem', marginBottom: 20 }}>
          粘贴文本内容，AI 将自动提取知识点并生成试卷
        </p>

        {/* 上传模式切换 */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 18 }}>
          {UPLOAD_MODES.map((m) => (
            <button
              key={m.key}
              onClick={() => { setUploadMode(m.key); setSelectedFile(null); }}
              style={{
                padding: '6px 16px', borderRadius: 100, border: 'none', cursor: 'pointer',
                fontSize: '.8rem', fontWeight: 500, transition: 'all .2s',
                background: uploadMode === m.key ? 'var(--ink)' : 'var(--paper)',
                color: uploadMode === m.key ? '#fff' : 'var(--slate)',
              }}
            >
              {m.label}
            </button>
          ))}
        </div>

        {uploadMode === 'text' ? (
          <form onSubmit={handleUpload}>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="在此粘贴你的笔记内容……"
              rows={8}
              maxLength={50000}
              style={{
                width: '100%', padding: 14, borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border)', fontSize: '.9rem',
                fontFamily: 'var(--font-body)', resize: 'vertical', marginBottom: 14,
              }}
            />
            <button type="submit" className="btn btn-primary" disabled={uploading}>
              {uploading ? '上传中……' : '上传笔记'}
            </button>
          </form>
        ) : (
          <div>
            <div
              onDrop={handleFileDrop}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: '2px dashed var(--border)', borderRadius: 'var(--radius)',
                padding: '40px 20px', textAlign: 'center', cursor: 'pointer',
                background: selectedFile ? 'var(--green-bg)' : 'var(--paper)',
                transition: 'all .2s', marginBottom: 14,
              }}
            >
              {selectedFile ? (
                <div>
                  {uploadMode === 'image' && previewUrl ? (
                    <img src={previewUrl} alt="预览"
                      style={{ maxWidth: '100%', maxHeight: 160, borderRadius: 8, marginBottom: 8, objectFit: 'contain' }} />
                  ) : null}
                  <div style={{ fontSize: '1rem', fontWeight: 500, color: 'var(--ink)' }}>
                    {selectedFile.name}
                  </div>
                  <div style={{ fontSize: '.8rem', color: 'var(--slate-light)', marginTop: 4 }}>
                    {(selectedFile.size / 1024).toFixed(1)} KB
                  </div>
                </div>
              ) : (
                <div>
                  <div style={{ fontSize: '2rem', marginBottom: 8 }}>
                    {uploadMode === 'image' ? '🖼️' : '📄'}
                  </div>
                  <div style={{ color: 'var(--slate)', fontSize: '.9rem' }}>
                    点击选择或拖拽{uploadMode === 'image' ? '图片' : 'PDF'}文件到此处
                  </div>
                  <div style={{ color: 'var(--slate-light)', fontSize: '.75rem', marginTop: 4 }}>
                    {uploadMode === 'image' ? '支持 JPG/PNG 格式，最大 10MB' : '最大 10MB'}
                  </div>
                </div>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept={uploadMode === 'image' ? 'image/jpeg,image/png' : 'application/pdf'}
              onChange={(e) => {
                  const file = e.target.files?.[0] || null;
                  setSelectedFile(file);
                  if (file && uploadMode === 'image') {
                    setPreviewUrl(URL.createObjectURL(file));
                  } else {
                    setPreviewUrl(null);
                  }
                }}
              style={{ display: 'none' }}
            />
            <button
              className="btn btn-primary"
              disabled={uploading || !selectedFile}
              onClick={handleFileUpload}
            >
              {uploading ? '上传中……' : '上传并识别'}
            </button>
          </div>
        )}
      </div>

      {/* 笔记列表 */}
      {notes.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 14 }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.15rem', fontWeight: 600 }}>
              我的笔记
            </h2>
            <span style={{ fontSize: '.8rem', color: 'var(--slate-light)' }}>
              {notes.length} 篇
            </span>
          </div>

          {/* 出题配置 */}
          <div className="card" style={{ padding: '20px 24px', marginBottom: 20 }}>
            <p style={{ fontSize: '.85rem', fontWeight: 500, color: 'var(--ink)', marginBottom: 10 }}>
              出题配置
            </p>
            <div style={{ marginBottom: 10 }}>
              <span style={{ fontSize: '.78rem', color: 'var(--slate-light)', marginRight: 8 }}>题型：</span>
              {QUESTION_TYPES.map((t) => (
                <button
                  key={t.key}
                  onClick={() => toggleType(t.key)}
                  style={{
                    marginRight: 6, marginBottom: 4, padding: '4px 12px', borderRadius: 100,
                    border: 'none', cursor: 'pointer', fontSize: '.75rem', fontWeight: 500,
                    background: examConfig.questionTypes.includes(t.key) ? 'var(--ink)' : 'var(--paper)',
                    color: examConfig.questionTypes.includes(t.key) ? '#fff' : 'var(--slate)',
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <div style={{ marginBottom: 10 }}>
              <span style={{ fontSize: '.78rem', color: 'var(--slate-light)', marginRight: 8 }}>难度：</span>
              {DIFFICULTIES.map((d) => (
                <button
                  key={d.key}
                  onClick={() => toggleDiff(d.key)}
                  style={{
                    marginRight: 6, marginBottom: 4, padding: '4px 12px', borderRadius: 100,
                    border: 'none', cursor: 'pointer', fontSize: '.75rem', fontWeight: 500,
                    background: examConfig.difficulties.includes(d.key) ? 'var(--ink)' : 'var(--paper)',
                    color: examConfig.difficulties.includes(d.key) ? '#fff' : 'var(--slate)',
                  }}
                >
                  {d.label}
                </button>
              ))}
            </div>
            <div>
              <span style={{ fontSize: '.78rem', color: 'var(--slate-light)', marginRight: 8 }}>题数：</span>
              <input
                type="number"
                min={1}
                max={50}
                value={examConfig.totalQuestions}
                onChange={(e) => setExamConfig((c) => ({ ...c, totalQuestions: Math.min(50, Math.max(1, parseInt(e.target.value) || 1)) }))}
                style={{
                  width: 70, padding: '4px 8px', borderRadius: 4, border: '1px solid var(--border)',
                  fontSize: '.85rem', textAlign: 'center',
                }}
              />
            </div>
          </div>

          {notes.map((n) => (
            <div
              key={n.id}
              className="card"
              style={{ padding: '20px 24px', marginBottom: 14 }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                <div
                  style={{
                    width: 40, height: 40, borderRadius: 'var(--radius-sm)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '1.2rem',
                    background: n.note_type === 'image' ? 'var(--coral-bg)' :
                      n.note_type === 'pdf' ? 'var(--amber-bg)' : 'var(--green-bg)',
                  }}
                >
                  {n.note_type === 'image' ? '🖼' : n.note_type === 'pdf' ? '📄' : '📝'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '.9rem', fontWeight: 500, color: 'var(--ink)', marginBottom: 4 }}>
                    {n.original_filename ? (
                      <span>{n.original_filename}</span>
                    ) : (
                      <span style={{
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                        display: 'block', maxWidth: '100%',
                      }}>
                        {n.content?.substring(0, 80) || '(空)'}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '.75rem', color: 'var(--slate-light)' }}>
                    {n.note_type === 'text' ? '文本笔记' : n.note_type === 'image' ? '图片笔记' : 'PDF笔记'}
                    {' · '}
                    {new Date(n.created_at).toLocaleDateString('zh-CN')}
                    {!n.content && (n.note_type === 'image' || n.note_type === 'pdf') ? (
                      <span style={{ marginLeft: 8, fontSize: '.72rem', color: 'var(--amber)' }}>
                        {ocrPolling[n.id] === 'polling' ? '⏳ OCR 识别中...' :
                         ocrPolling[n.id] === 'timeout' ? '⚠ OCR 超时' :
                         ocrPolling[n.id] === 'done' && n.content ? '✅ 识别完成' : ''}
                      </span>
                    ) : null}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <button
                    className="btn btn-sm"
                    style={{ color: 'var(--slate)', background: 'var(--paper)', border: '1px solid var(--border)' }}
                    onClick={() => handleViewKnowledge(n.id)}
                  >
                    知识点
                  </button>
                  <button
                    className="btn btn-sm btn-primary"
                    onClick={() => handleGenerate(n.id)}
                  >
                    出题
                  </button>
                  <button
                    className="btn btn-sm btn-danger"
                    onClick={() => setDeleteConfirm({ type: 'note', id: n.id })}
                  >
                    删除
                  </button>
                </div>
              </div>
              {/* OCR 结果查看/编辑 */}
              {(n.note_type === 'image' || n.note_type === 'pdf') && n.content && (
                <div style={{ marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                  {ocrEditId === n.id ? (
                    <div>
                      <textarea
                        value={ocrEditText}
                        onChange={(e) => setOcrEditText(e.target.value)}
                        rows={6}
                        style={{
                          width: '100%', padding: 10, borderRadius: 4,
                          border: '1px solid var(--border)', fontSize: '.85rem',
                          fontFamily: 'var(--font-body)', resize: 'vertical',
                        }}
                      />
                      <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                        <button
                          className="btn btn-sm btn-primary"
                          onClick={() => handleUpdateNoteContent(n.id)}
                        >
                          保存
                        </button>
                        <button
                          className="btn btn-sm"
                          onClick={() => { setOcrEditId(null); setOcrEditText(''); }}
                          style={{ color: 'var(--slate)', background: 'var(--paper)', border: '1px solid var(--border)' }}
                        >
                          取消
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div style={{ fontSize: '.75rem', color: 'var(--slate-light)', marginBottom: 6 }}>
                        OCR 识别结果
                      </div>
                      <div style={{
                        fontSize: '.85rem', color: 'var(--slate)', lineHeight: 1.6,
                        maxHeight: 80, overflow: 'hidden', whiteSpace: 'pre-wrap',
                        background: 'var(--paper)', padding: '8px 12px', borderRadius: 4,
                      }}>
                        {n.content.substring(0, 200)}{n.content.length > 200 ? '...' : ''}
                      </div>
                      <button
                        className="btn btn-sm"
                        onClick={() => { setOcrEditId(n.id); setOcrEditText(n.content); }}
                        style={{ marginTop: 8, color: 'var(--slate)', background: 'var(--paper)', border: '1px solid var(--border)' }}
                      >
                        编辑识别文本
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 知识点管理面板 */}
      {knowledgeNoteId && (
        <div className="card" style={{ padding: '20px 24px', marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', fontWeight: 600 }}>
              提取的知识点
            </h3>
            <button
              onClick={() => { setKnowledgeNoteId(null); setKnowledgeView(null); }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--slate-light)', fontSize: '1.2rem' }}
            >
              &times;
            </button>
          </div>

          {/* 添加知识点 */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            <input
              value={newKp.name}
              onChange={(e) => setNewKp((k) => ({ ...k, name: e.target.value }))}
              placeholder="知识点名称"
              onKeyDown={(e) => e.key === 'Enter' && handleAddKp()}
              style={{
                flex: 1, padding: '6px 10px', borderRadius: 4, border: '1px solid var(--border)',
                fontSize: '.85rem',
              }}
            />
            <input
              value={newKp.category}
              onChange={(e) => setNewKp((k) => ({ ...k, category: e.target.value }))}
              placeholder="类别"
              style={{
                width: 100, padding: '6px 10px', borderRadius: 4, border: '1px solid var(--border)',
                fontSize: '.85rem',
              }}
            />
            <select
              value={newKp.importance}
              onChange={(e) => setNewKp((k) => ({ ...k, importance: e.target.value }))}
              style={{
                width: 80, padding: '6px 8px', borderRadius: 4, border: '1px solid var(--border)',
                fontSize: '.85rem',
              }}
            >
              <option value="high">高</option>
              <option value="normal">中</option>
              <option value="low">低</option>
            </select>
            <button className="btn btn-sm btn-primary" onClick={handleAddKp}>添加</button>
          </div>

          {(knowledgeView || []).length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {(knowledgeView || []).map((kp) => (
                <div
                  key={kp.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '8px 12px', background: 'var(--paper)', borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border)',
                  }}
                >
                  {editKp === kp.id ? (
                    <>
                      <input
                        defaultValue={kp.name}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleUpdateKp(kp.id, e.target.value);
                          if (e.key === 'Escape') setEditKp(null);
                        }}
                        autoFocus
                        style={{
                          flex: 1, padding: '4px 8px', borderRadius: 4,
                          border: '1px solid var(--border)', fontSize: '.85rem',
                        }}
                      />
                      <button
                        onClick={(e) => handleUpdateKp(kp.id, e.target.previousSibling?.value || kp.name)}
                        style={{ border: 'none', background: 'var(--green)', color: '#fff',
                          borderRadius: 4, padding: '3px 8px', cursor: 'pointer', fontSize: '.75rem' }}
                      >
                        保存
                      </button>
                      <button
                        onClick={() => setEditKp(null)}
                        style={{ border: 'none', background: 'var(--paper)', color: 'var(--slate)',
                          borderRadius: 4, padding: '3px 8px', cursor: 'pointer', fontSize: '.75rem' }}
                      >
                        取消
                      </button>
                    </>
                  ) : (
                    <>
                      <span style={{ flex: 1, fontSize: '.88rem', color: 'var(--ink)' }}>{kp.name}</span>
                      {kp.category && (
                        <span style={{ fontSize: '.72rem', padding: '2px 6px', borderRadius: 100,
                          background: 'var(--ink)', color: '#fff' }}>
                          {kp.category}
                        </span>
                      )}
                      <span style={{ fontSize: '.72rem', color: 'var(--slate-light)' }}>
                        {kp.importance === 'high' ? '★高' : kp.importance === 'low' ? '☆低' : '中'}
                      </span>
                      <button
                        onClick={() => setEditKp(kp.id)}
                        style={{ border: 'none', background: 'none', cursor: 'pointer',
                          color: 'var(--slate-light)', fontSize: '.75rem' }}
                      >
                        编辑
                      </button>
                      <button
                        onClick={() => handleDeleteKp(kp.id)}
                        style={{ border: 'none', background: 'none', cursor: 'pointer',
                          color: 'var(--coral)', fontSize: '.75rem' }}
                      >
                        删
                      </button>
                    </>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p style={{ color: 'var(--slate-light)', fontSize: '.85rem', textAlign: 'center', padding: 20 }}>
              暂无知识点，点击「出题」自动提取或手动添加
            </p>
          )}
        </div>
      )}

      {/* 试卷列表 */}
      {exams.length > 0 && (
        <div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, margin: '36px 0 16px' }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.15rem', fontWeight: 600 }}>
              试卷
            </h2>
            <span style={{ fontSize: '.8rem', color: 'var(--slate-light)' }}>
              {exams.length} 份
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {exams.map((e) => (
              <div
                key={e.id}
                style={{
                  background: '#fff', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)',
                  padding: '20px 24px', display: 'flex', alignItems: 'center', gap: 16,
                }}
              >
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
                    {' ' + new Date(e.created_at).toLocaleDateString('zh-CN')}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                  <a
                    href={api.getExportUrl(e.id, 'html', true)}
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn-sm"
                    style={{
                      color: 'var(--slate)', background: 'var(--paper)',
                      border: '1px solid var(--border)', textDecoration: 'none',
                    }}
                  >
                    导出
                  </a>
                  <button className="btn btn-sm btn-primary" onClick={() => handleViewExam(e.id)}>
                    查看
                  </button>
                  <button
                    className="btn btn-sm btn-danger"
                    onClick={() => setDeleteConfirm({ type: 'exam', id: e.id })}
                  >
                    删除
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 空状态 */}
      {notes.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--slate-light)' }}>
          <div style={{ fontSize: '3rem', marginBottom: 12 }}>[ + ]</div>
          <div style={{ fontSize: '1rem', fontWeight: 500 }}>暂无笔记</div>
          <div style={{ fontSize: '.85rem', marginTop: 4 }}>
            粘贴文本或上传图片/PDF 以开始使用
          </div>
        </div>
      )}

      {/* Loading */}
      {loading.show && <LoadingOverlay text={loading.text} sub={loading.sub} />}

      {/* 试卷弹窗 */}
      {examView && (
        <ExamModal
          exam={examView}
          onClose={() => setExamView(null)}
          onRefresh={() => handleViewExam(examView.id)}
          showToast={showToast}
        />
      )}

      {/* 删除确认 */}
      {deleteConfirm && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 250,
          background: 'rgba(15,23,42,.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            background: '#fff', borderRadius: 'var(--radius)',
            boxShadow: 'var(--shadow-lg)', padding: 28, maxWidth: 380,
            width: '90%', textAlign: 'center', animation: 'modalIn .2s ease',
          }}>
            <p style={{ fontSize: '.95rem', color: 'var(--ink)', marginBottom: 6 }}>
              确定删除此{deleteConfirm.type === 'note' ? '笔记' : '试卷'}？
            </p>
            <p style={{ fontSize: '.82rem', color: 'var(--slate-light)', marginBottom: 20 }}>
              {deleteConfirm.type === 'note'
                ? '关联的知识点和试卷也会一并删除。'
                : '所有题目将被删除。'}
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button
                className="btn btn-sm"
                onClick={() => setDeleteConfirm(null)}
                style={{ color: 'var(--slate)', background: 'var(--paper)', border: '1px solid var(--border)' }}
              >
                取消
              </button>
              <button className="btn btn-sm btn-danger" onClick={confirmDelete}>
                确认删除
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
