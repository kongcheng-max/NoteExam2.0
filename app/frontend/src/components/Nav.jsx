import React from 'react';
import { useAuth } from '../App';

const style = {
  nav: {
    background: '#fff', borderBottom: '1px solid var(--border)',
    position: 'sticky', top: 0, zIndex: 100,
  },
  inner: {
    maxWidth: '760px', margin: '0 auto', padding: '14px 20px',
    display: 'flex', alignItems: 'baseline', gap: 12,
  },
  logo: {
    fontFamily: 'var(--font-display)', fontSize: '1.35rem', fontWeight: 700,
    color: 'var(--ink)', textDecoration: 'none', letterSpacing: '-0.02em',
  },
  tagline: { fontSize: '.8rem', color: 'var(--slate-light)' },
  link: { fontSize: '.82rem', color: 'var(--slate)', textDecoration: 'none',
    padding: '2px 10px', borderRadius: 100, background: 'var(--paper)' },
};

export default function Nav() {
  const { user, showLogin, logout } = useAuth();

  return (
    <header style={style.nav}>
      <div style={style.inner}>
        <a href="/" style={style.logo}>NoteExam</a>
        <span style={style.tagline}>笔记即试卷</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          <a href="/wrong-answers" style={style.link}>错题本</a>
          {user ? (
            <>
              <a href="/settings" style={{ ...style.link, fontSize: '.78rem' }}>设置</a>
              <span style={{ fontSize: '.78rem', color: 'var(--slate)' }}>{user.email}</span>
              <button onClick={logout}
                style={{ ...style.link, border: 'none', cursor: 'pointer', fontSize: '.78rem' }}>
                退出
              </button>
            </>
          ) : (
            <button onClick={showLogin}
              style={{ ...style.link, border: 'none', cursor: 'pointer', fontSize: '.82rem' }}>
              登录 / 注册
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
