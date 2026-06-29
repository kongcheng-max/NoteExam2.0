import React, { useEffect } from 'react';

const overlayStyle = {
  position: 'fixed', inset: 0, zIndex: 300,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  background: 'rgba(243,244,246,.85)', backdropFilter: 'blur(4px)',
};
const cardStyle = { textAlign: 'center' };
const spinnerStyle = {
  width: 36, height: 36, margin: '0 auto 20px',
  border: '3px solid var(--border)', borderTopColor: 'var(--ink)',
  borderRadius: '50%', animation: 'spin .8s linear infinite',
};
const textStyle = { fontFamily: 'var(--font-display)', fontSize: '1.05rem', fontWeight: 600, color: 'var(--ink)', marginBottom: 4 };
const subStyle = { fontSize: '.82rem', color: 'var(--slate-light)' };

export default function LoadingOverlay({ text, sub }) {
  useEffect(() => { document.body.style.overflow = 'hidden'; return () => { document.body.style.overflow = ''; }; }, []);
  return (
    <div style={overlayStyle}>
      <div style={cardStyle}>
        <div style={spinnerStyle} />
        <p style={textStyle}>{text}</p>
        {sub && <p style={subStyle}>{sub}</p>}
      </div>
    </div>
  );
}
