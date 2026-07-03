import React, { useState } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function AuthDebug() {
  const [email, setEmail] = useState('test@example.com')
  const [password, setPassword] = useState('password123')
  const [result, setResult] = useState(null)

  async function testLogin() {
    setResult('Testing login...')
    const { data, error } = await supabase.auth.signInWithPassword({ 
      email: email.trim().toLowerCase(), 
      password: password.trim() 
    })
    
    if (error) {
      setResult(`❌ Login FAILED: ${error.message}`)
    } else {
      setResult(`✅ Login SUCCESS! User ID: ${data.user?.id}`)
    }
  }

  async function testRegister() {
    setResult('Testing registration...')
    const { data, error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password: password.trim(),
      options: {
        data: { full_name: 'Test User' }
      }
    })
    
    if (error) {
      setResult(`❌ Registration FAILED: ${error.message}`)
    } else {
      setResult(`✅ Registration SUCCESS! User ID: ${data.user?.id}\n\nNow try logging in with the same credentials.`)
    }
  }

  async function checkSession() {
    const { data } = await supabase.auth.getSession()
    if (data.session) {
      setResult(`✅ Already logged in! User: ${data.session.user.email}`)
    } else {
      setResult(`❌ Not logged in`)
    }
  }

  async function logout() {
    await supabase.auth.signOut()
    setResult('✅ Logged out')
  }

  return (
    <div style={{ maxWidth: 800, margin: '40px auto', padding: 24 }}>
      <h1>🔐 Auth Debug Tool</h1>
      <p>Use this to test if Supabase Auth is working correctly.</p>

      <div style={{ background: '#f5f5f5', padding: 20, borderRadius: 8, marginBottom: 20 }}>
        <h3>Test Credentials</h3>
        <div style={{ display: 'grid', gap: 12 }}>
          <div>
            <label style={{ display: 'block', marginBottom: 4, fontWeight: 600 }}>Email:</label>
            <input 
              type="email" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)}
              style={{ width: '100%', padding: 8, borderRadius: 4, border: '1px solid #ddd' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: 4, fontWeight: 600 }}>Password:</label>
            <input 
              type="password" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)}
              style={{ width: '100%', padding: 8, borderRadius: 4, border: '1px solid #ddd' }}
            />
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
        <button onClick={checkSession} style={{ padding: '10px 16px', background: '#666', color: '#fff', border: 0, borderRadius: 6, cursor: 'pointer' }}>
          Check Session
        </button>
        <button onClick={testRegister} style={{ padding: '10px 16px', background: '#0b5fff', color: '#fff', border: 0, borderRadius: 6, cursor: 'pointer' }}>
          Test Register
        </button>
        <button onClick={testLogin} style={{ padding: '10px 16px', background: '#10b981', color: '#fff', border: 0, borderRadius: 6, cursor: 'pointer' }}>
          Test Login
        </button>
        <button onClick={logout} style={{ padding: '10px 16px', background: '#f00', color: '#fff', border: 0, borderRadius: 6, cursor: 'pointer' }}>
          Logout
        </button>
      </div>

      {result && (
        <div style={{ 
          background: result.includes('❌') ? '#fee' : '#efe', 
          border: `1px solid ${result.includes('❌') ? '#fcc' : '#cfc'}`,
          padding: 20, 
          borderRadius: 8,
          whiteSpace: 'pre-wrap',
          fontFamily: 'monospace'
        }}>
          {result}
        </div>
      )}

      <div style={{ marginTop: 40, padding: 20, background: '#fff3cd', borderRadius: 8, border: '1px solid #ffc107' }}>
        <h3 style={{ marginTop: 0 }}>💡 How It Works</h3>
        <ol style={{ marginBottom: 0 }}>
          <li><strong>Register:</strong> Creates user in Supabase Auth with email + password</li>
          <li><strong>Login:</strong> Checks email + password against Supabase Auth</li>
          <li><strong>Session:</strong> Shows if you're currently logged in</li>
          <li><strong>Logout:</strong> Clears your session</li>
        </ol>
        <p style={{ marginTop: 16, fontSize: 14, color: '#666' }}>
          <strong>Important:</strong> Passwords are stored in Supabase Auth, NOT in your custom database table. 
          The "users" table only stores profile information (name, email, role, verification status).
        </p>
      </div>
    </div>
  )
}
