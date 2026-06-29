import React from 'react';

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
};

export default function Nav() {
  return (
    <header style={style.nav}>
      <div style={style.inner}>
        <a href="/" style={style.logo}>NoteExam</a>
        <span style={style.tagline}>笔记即试卷</span>
      </div>
    </header>
  );
}
