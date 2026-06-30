import React, { useState, useCallback, useRef, useEffect } from 'react';
import { ToastContext, AuthContext, useToast, useAuth } from './context';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Nav from './components/Nav';
import Home from './pages/Home';
import WrongAnswers from './pages/WrongAnswers';
import Settings from './pages/Settings';
import OfflineBanner from './components/OfflineBanner';
import Toast from './components/Toast';
import { api, setToken, getToken } from './api';

// Re-exported from context.js for backward compatibility
export { useToast, useAuth, ToastContext, AuthContext };

function LoginModal({ onClose, onSuccess }) {
  const showToast = useToast();
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) return showToast('请填写邮箱和密码', 'error');
    if (password.length < 6) return showToast('密码至少6位', 'error');
    setLoading(true);
    try {
      const res = isRegister
        ? await api.register(email, password)
        : await api.login(email, password);
      setToken(res.data.token);
      showToast(isRegister ? '注册成功' : '登录成功');
      onSuccess(res.data.user);
      onClose();
    } catch (err) { showToast(err.message, 'error'); }
    finally { setLoading(false); }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 300,
      background: 'rgba(15,23,42,.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{
        background: '#fff', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-lg)',
        padding: 32, maxWidth: 400, width: '90%', animation: 'modalIn .25s ease',
      }}>
        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', fontWeight: 600, marginBottom: 20 }}>
          {isRegister ? '注册' : '登录'}
        </h3>
        <form onSubmit={handleSubmit}>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
            placeholder="邮箱" autoFocus
            style={{ width: '100%', padding: '10px 14px', borderRadius: 6, border: '1px solid var(--border)',
              fontSize: '.9rem', marginBottom: 12, boxSizing: 'border-box' }} />
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
            placeholder="密码（至少6位）"
            style={{ width: '100%', padding: '10px 14px', borderRadius: 6, border: '1px solid var(--border)',
              fontSize: '.9rem', marginBottom: 16, boxSizing: 'border-box' }} />
          <button type="submit" className="btn btn-primary" disabled={loading}
            style={{ width: '100%', padding: '10px 0', fontSize: '.9rem' }}>
            {loading ? '请稍候……' : (isRegister ? '注册' : '登录')}
          </button>
        </form>
        <p style={{ textAlign: 'center', marginTop: 14, fontSize: '.82rem', color: 'var(--slate-light)' }}>
          {isRegister ? '已有账号？' : '没有账号？'}
          <button onClick={() => setIsRegister(!isRegister)}
            style={{ background: 'none', border: 'none', color: 'var(--ink)', cursor: 'pointer',
              fontWeight: 500, fontSize: '.82rem', textDecoration: 'underline' }}>
            {isRegister ? '去登录' : '去注册'}
          </button>
        </p>
        <button onClick={onClose}
          style={{ display: 'block', margin: '12px auto 0', background: 'none', border: 'none',
            color: 'var(--slate-light)', cursor: 'pointer', fontSize: '.8rem' }}>
          暂不登录，继续使用
        </button>
      </div>
    </div>
  );
}

export default function App() {
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  const timerRef = useRef(null);
  const [user, setUser] = useState(null);
  const [showLogin, setShowLogin] = useState(false);

  const showToast = useCallback((message, type = 'success') => {
    clearTimeout(timerRef.current);
    setToast({ show: true, message, type });
    timerRef.current = setTimeout(() => setToast((t) => ({ ...t, show: false })), 3000);
  }, []);

  useEffect(() => {
    if (getToken()) {
      api.getMe().then(r => { if (r.success) setUser(r.data); }).catch(() => {});
    }
  }, []);

  const handleLogout = async () => {
    try { await api.logout(); } catch {}
    setToken('');
    setUser(null);
    showToast('已退出登录');
  };

  return (
    <ToastContext.Provider value={showToast}>
      <AuthContext.Provider value={{ user, setUser, showLogin: () => setShowLogin(true), logout: handleLogout }}>
        <BrowserRouter>
          <Nav />
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/wrong-answers" element={<WrongAnswers />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
          {toast.show && <Toast message={toast.message} type={toast.type} />}
          {showLogin && <LoginModal onClose={() => setShowLogin(false)} onSuccess={(u) => setUser(u)} />}
          <OfflineBanner />
        </BrowserRouter>
      </AuthContext.Provider>
    </ToastContext.Provider>
  );
}
