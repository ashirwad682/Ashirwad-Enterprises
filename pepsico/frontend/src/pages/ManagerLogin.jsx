import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const API_BASE = import.meta.env.VITE_API_BASE 
  ? import.meta.env.VITE_API_BASE.replace(/\/$/, '') 
  : (import.meta.env.PROD ? 'https://pepsico-backend.vercel.app' : 'http://localhost:5001');

export default function ManagerLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  async function handleLogin(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const trimmedEmail = email.trim().toLowerCase();
    const trimmedPassword = password.trim();
    if (!trimmedEmail || !trimmedPassword) {
      setError('Email and password are required');
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/api/manager/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmedEmail, password: trimmedPassword })
      });

      const contentType = res.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error("Backend connection failed. Vercel returned HTML instead of JSON.");
      }

      const result = await res.json();
      setLoading(false);
      if (!res.ok) {
        setError(result.error || 'Login failed');
        return;
      }
      // Save token and permissions
      localStorage.setItem('manager_token', result.token);
      localStorage.setItem('manager_permissions', JSON.stringify(result.manager.permissions || []));
      localStorage.setItem('manager_is_active', String(Boolean(result.manager?.is_active)));
      localStorage.setItem('manager_name', result.manager?.full_name || '');
      localStorage.setItem('manager_profile_verification_status', result.manager?.profile_verification_status || 'Pending Verification');
      navigate('/manager-dashboard');
    } catch (err) {
      console.error(err);
      setError(err.message === 'Failed to fetch' ? 'Network error: Cannot connect to backend.' : err.message || 'Login failed. Please try again.');
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: 'calc(100vh - 200px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div className="card" style={{ padding: 40, maxWidth: 420, width: '100%' }}>
        <h2 style={{ marginBottom: 24 }}>Manager Login</h2>
        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div className="form-group">
            <label>Email Address</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required />
          </div>
          <div className="form-group">
            <label>Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} required />
          </div>
          {error && <div className="alert error">{error}</div>}
          <button type="submit" className="btn" disabled={loading} style={{ marginTop: 8 }}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
