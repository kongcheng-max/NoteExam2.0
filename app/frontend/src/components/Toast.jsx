import React from 'react';

const baseStyle = {
  position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)',
  padding: '10px 22px', borderRadius: 'var(--radius-sm)',
  fontSize: '.85rem', fontWeight: 500, zIndex: 400,
  boxShadow: 'var(--shadow-lg)', animation: 'modalIn .2s ease',
};
const typeStyle = {
  success: { background: 'var(--ink)', color: '#fff' },
  error: { background: 'var(--coral)', color: '#fff' },
};

export default function Toast({ message, type = 'success' }) {
  return <div style={{ ...baseStyle, ...typeStyle[type] }}>{message}</div>;
}
