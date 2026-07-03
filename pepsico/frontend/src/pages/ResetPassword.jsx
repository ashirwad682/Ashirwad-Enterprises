
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import BrandVideoLogo from '../components/BrandVideoLogo';

export default function ResetPassword() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Check if we are in a password reset session
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        setError('Invalid or expired password reset link.');
      }
    });
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    if (!password || !confirmPassword) {
      setError('Please fill in all fields.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      setError(error.message || 'Failed to update password.');
    } else {
      setSuccess(true);
      setTimeout(() => navigate('/login'), 2000);
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div className="card" style={{ padding: 40, maxWidth: 400, width: '100%' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <BrandVideoLogo size={88} style={{ marginBottom: 18, boxShadow: '0 20px 60px rgba(10,29,83,0.2)', borderRadius: 18 }} />
          <h2 style={{ marginBottom: 4, color: 'var(--brand-saffron)' }}>Ashirwad Enterprises</h2>
          <p style={{ color: 'var(--text-secondary)', margin: '4px 0 0 0', fontSize: 12, letterSpacing: 0.4, textTransform: 'uppercase' }}>Authorized PepsiCo Distributor</p>
        </div>
        <h2 style={{ textAlign: 'center', marginBottom: 24 }}>Reset Password</h2>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <input
            type="password"
            placeholder="New password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Confirm new password"
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
            required
          />
          {error && <div className="alert error">{error}</div>}
          {success && <div className="alert success">Password updated! Redirecting to login...</div>}
          <button type="submit" className="btn" disabled={loading}>
            {loading ? 'Updating...' : 'Update Password'}
          </button>
        </form>
      </div>
    </div>
  );
}
