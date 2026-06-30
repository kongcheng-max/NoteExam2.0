import React, { useState } from 'react';
import { useAuth, useToast } from '../context';
import { api } from '../api';

const style = {
  page: {
    maxWidth: '480px', margin: '40px auto', padding: '0 20px',
  },
  heading: {
    fontFamily: 'var(--font-display)', fontSize: '1.3rem', fontWeight: 600,
    color: 'var(--ink)', marginBottom: 24,
  },
  card: {
    background: '#fff', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-sm)',
    padding: '28px 24px',
  },
  cardTitle: {
    fontSize: '1rem', fontWeight: 600, color: 'var(--ink)', marginBottom: 20,
  },
  label: {
    display: 'block', fontSize: '.82rem', color: 'var(--slate)', marginBottom: 4,
  },
  input: {
    width: '100%', padding: '10px 14px', borderRadius: 6,
    border: '1px solid var(--border)', fontSize: '.9rem',
    marginBottom: 14, boxSizing: 'border-box',
  },
  btn: {
    width: '100%', padding: '10px 0', fontSize: '.9rem',
    borderRadius: 6, border: 'none', cursor: 'pointer',
    background: 'var(--ink)', color: '#fff', fontWeight: 500,
  },
  hint: {
    fontSize: '.78rem', color: 'var(--slate-light)', marginTop: 12, textAlign: 'center',
  },
};

export default function Settings() {
  const { user } = useAuth();
  const showToast = useToast();
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  if (!user) {
    return (
      <div style={style.page}>
        <h1 style={style.heading}>设置</h1>
        <div style={{ ...style.card, textAlign: 'center', color: 'var(--slate-light)', fontSize: '.9rem' }}>
          请先登录后再访问设置
        </div>
      </div>
    );
  }

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (!oldPassword) return showToast('请输入原密码', 'error');
    if (!newPassword) return showToast('请输入新密码', 'error');
    if (newPassword.length < 6) return showToast('新密码至少6位', 'error');
    if (newPassword !== confirmPassword) return showToast('两次输入的新密码不一致', 'error');
    if (oldPassword === newPassword) return showToast('新密码不能与原密码相同', 'error');

    setLoading(true);
    try {
      const res = await api.changePassword(oldPassword, newPassword);
      if (res.success) {
        showToast('密码修改成功');
        setOldPassword('');
        setNewPassword('');
        setConfirmPassword('');
      }
    } catch (err) {
      showToast(err.message || '密码修改失败', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={style.page}>
      <h1 style={style.heading}>设置</h1>

      <div style={style.card}>
        <h2 style={style.cardTitle}>账号信息</h2>
        <div style={{ fontSize: '.9rem', color: 'var(--slate)', marginBottom: 20 }}>
          邮箱：{user.email}
        </div>
      </div>

      <div style={{ ...style.card, marginTop: 16 }}>
        <h2 style={style.cardTitle}>修改密码</h2>
        <form onSubmit={handleChangePassword}>
          <label style={style.label}>原密码</label>
          <input
            type="password" value={oldPassword}
            onChange={(e) => setOldPassword(e.target.value)}
            placeholder="输入当前密码" style={style.input}
          />
          <label style={style.label}>新密码（至少6位）</label>
          <input
            type="password" value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="输入新密码" style={style.input}
          />
          <label style={style.label}>确认新密码</label>
          <input
            type="password" value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="再次输入新密码" style={style.input}
          />
          <button type="submit" style={style.btn} disabled={loading}>
            {loading ? '修改中……' : '修改密码'}
          </button>
        </form>
        <p style={style.hint}>修改成功后，下次登录请使用新密码</p>
      </div>
    </div>
  );
}
