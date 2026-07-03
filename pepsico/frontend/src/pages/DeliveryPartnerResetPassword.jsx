import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

export default function DeliveryPartnerResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [loading, setLoading] = useState(false);
  const [strength, setStrength] = useState(0);
  const [strengthMsg, setStrengthMsg] = useState('');
  const [confirmStrength, setConfirmStrength] = useState(0);
  const [confirmStrengthMsg, setConfirmStrengthMsg] = useState('');
  const navigate = useNavigate();

  // Password strength checker
  const checkStrength = (pwd) => {
    let score = 0;
    let msg = '';
    const hasMinLength = pwd.length >= 6;
    const letterCount = (pwd.match(/[a-zA-Z]/g) || []).length;
    const symbolCount = (pwd.match(/[^a-zA-Z0-9]/g) || []).length;
    const numberCount = (pwd.match(/[0-9]/g) || []).length;
    if (hasMinLength) score++;
    if (letterCount >= 2) score++;
    if (symbolCount >= 1) score++;
    if (numberCount >= 3) score++;
    if (score === 4) {
      msg = 'Strong: 6+ chars, 2 letters, 1 symbol, 3 numbers';
    } else {
      msg = 'Weak: 6+ chars, 2 letters, 1 symbol, 3 numbers required';
    }
    setStrength(score);
    setStrengthMsg(msg);
    return score === 4;
  };

  const handlePasswordChange = (e) => {
    const val = e.target.value;
    setPassword(val);
    checkStrength(val);
  };

  const handleConfirmPasswordChange = (e) => {
    const val = e.target.value;
    setConfirmPassword(val);
    // Check strength and match
    let score = 0;
    let msg = '';
    const hasMinLength = val.length >= 6;
    const letterCount = (val.match(/[a-zA-Z]/g) || []).length;
    const symbolCount = (val.match(/[^a-zA-Z0-9]/g) || []).length;
    const numberCount = (val.match(/[0-9]/g) || []).length;
    if (hasMinLength) score++;
    if (letterCount >= 2) score++;
    if (symbolCount >= 1) score++;
    if (numberCount >= 3) score++;
    if (score === 4 && val === password) {
      msg = 'Strong & matches password';
    } else if (val !== password) {
      msg = 'Passwords do not match';
    } else {
      msg = 'Weak: 6+ chars, 2 letters, 1 symbol, 3 numbers required';
    }
    setConfirmStrength(score === 4 && val === password ? 4 : score);
    setConfirmStrengthMsg(msg);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    if (!checkStrength(password)) {
      setError('Password must be at least 6 characters, contain at least 2 letters, 1 symbol, and 3 numbers.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/delivery/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password })
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess('Password reset successful! You can now log in.');
        setTimeout(() => navigate('/delivery-login'), 2000);
      } else {
        setError(data.error || 'Failed to reset password.');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    }
    setLoading(false);
  };

  if (!token) {
    return <div style={{ padding: 32, textAlign: 'center', color: 'red' }}>Invalid or missing reset token.</div>;
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--brand-gradient)' }}>
      <div className="card" style={{ padding: 40, maxWidth: 400, width: '100%' }}>
        <h2 style={{ marginBottom: 18, color: 'var(--brand-saffron)' }}>Reset Delivery Partner Password</h2>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <input
            type="password"
            placeholder="New password"
            value={password}
            onChange={handlePasswordChange}
            minLength={6}
            required
            style={{ padding: 12, borderRadius: 8, border: '1px solid #ddd' }}
          />
          {/* Password strength meter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
            <div style={{ width: 40, height: 8, borderRadius: 4, background: strength > 0 ? '#22c55e' : '#e5e7eb', transition: 'background 0.2s' }} />
            <div style={{ width: 40, height: 8, borderRadius: 4, background: strength > 1 ? '#22c55e' : '#e5e7eb', transition: 'background 0.2s' }} />
            <div style={{ width: 40, height: 8, borderRadius: 4, background: strength > 2 ? '#22c55e' : '#e5e7eb', transition: 'background 0.2s' }} />
            <div style={{ width: 40, height: 8, borderRadius: 4, background: strength > 3 ? '#22c55e' : '#e5e7eb', transition: 'background 0.2s' }} />
            <span style={{ marginLeft: 12, fontSize: 15, color: strength === 4 ? '#64748b' : '#be123c', fontWeight: 500 }}>{strengthMsg}</span>
          </div>
          <input
            type="password"
            placeholder="Confirm new password"
            value={confirmPassword}
            onChange={handleConfirmPasswordChange}
            minLength={6}
            required
            style={{ padding: 12, borderRadius: 8, border: '1px solid #ddd' }}
          />
          {/* Confirm password strength meter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
            <div style={{ width: 40, height: 8, borderRadius: 4, background: confirmStrength > 0 ? '#22c55e' : '#e5e7eb', transition: 'background 0.2s' }} />
            <div style={{ width: 40, height: 8, borderRadius: 4, background: confirmStrength > 1 ? '#22c55e' : '#e5e7eb', transition: 'background 0.2s' }} />
            <div style={{ width: 40, height: 8, borderRadius: 4, background: confirmStrength > 2 ? '#22c55e' : '#e5e7eb', transition: 'background 0.2s' }} />
            <div style={{ width: 40, height: 8, borderRadius: 4, background: confirmStrength > 3 ? '#22c55e' : '#e5e7eb', transition: 'background 0.2s' }} />
            <span style={{ marginLeft: 12, fontSize: 15, color: confirmStrength === 4 ? '#64748b' : '#be123c', fontWeight: 500 }}>{confirmStrengthMsg}</span>
          </div>
          {error && <div style={{ color: 'red', fontSize: 14 }}>{error}</div>}
          {success && <div style={{ color: 'green', fontSize: 14 }}>{success}</div>}
          <button
            type="submit"
            disabled={loading}
            style={{
              padding: '14px 0',
              background: '#0b5fff', // Strong blue for high contrast
              color: '#fff',
              border: 'none',
              borderRadius: 10,
              fontWeight: 800,
              fontSize: 18,
              letterSpacing: 0.5,
              boxShadow: '0 4px 18px rgba(11,95,255,0.18)',
              marginTop: 8,
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'background 0.2s, box-shadow 0.2s',
              outline: 'none',
            }}
            onMouseOver={e => e.currentTarget.style.background = '#084fc7'}
            onMouseOut={e => e.currentTarget.style.background = '#0b5fff'}
          >
            {loading ? 'Updating...' : 'Update Password'}
          </button>
        </form>
      </div>
    </div>
  );
}
