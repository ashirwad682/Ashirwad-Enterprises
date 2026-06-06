import React from 'react'

export default function AccountVerifiedBanner({ user, onClose }) {
  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      background: 'rgba(0,0,0,0.18)',
      zIndex: 9999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <div style={{
        background: 'rgba(255,255,255,0.98)',
        borderRadius: 28,
        boxShadow: '0 8px 40px rgba(80, 0, 128, 0.13)',
        padding: 36,
        minWidth: 340,
        maxWidth: 420,
        textAlign: 'center',
        position: 'relative',
        overflow: 'hidden',
        border: '1.5px solid #f3e8ff',
      }}>
        {/* Festive color splashes */}
        <div style={{
          position: 'absolute',
          top: -32,
          left: -32,
          width: 120,
          height: 120,
          background: 'radial-gradient(circle at 40% 40%, #ff80ab 0%, #fff0 80%)',
          zIndex: 0,
          filter: 'blur(2px)'
        }} />
        <div style={{
          position: 'absolute',
          bottom: -24,
          right: -24,
          width: 100,
          height: 100,
          background: 'radial-gradient(circle at 60% 60%, #a5b4fc 0%, #fff0 80%)',
          zIndex: 0,
          filter: 'blur(2px)'
        }} />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{
            width: 70,
            height: 70,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #22c55e 0%, #a5b4fc 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 18px',
            boxShadow: '0 4px 18px #22c55e33',
          }}>
            <span style={{ fontSize: 38, color: '#fff', fontWeight: 800 }}>✓</span>
          </div>
          <h2 style={{ fontSize: 26, fontWeight: 900, margin: '18px 0 8px', color: '#1e293b', letterSpacing: -1 }}>Account Verified Successfully!</h2>
          <div style={{ color: '#64748b', fontSize: 15, marginBottom: 22 }}>
            Your email has been verified. You now have full access to our platform.<br />Welcome to the Ashirwad Enterprises family!
          </div>
          <div style={{
            background: 'linear-gradient(90deg, #fdf2f8 0%, #f0fdfa 100%)',
            borderRadius: 16,
            padding: '14px 18px',
            margin: '0 auto 18px',
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            maxWidth: 320,
            boxShadow: '0 2px 8px #a5b4fc22',
            border: '1.5px solid #f3e8ff',
            justifyContent: 'center',
          }}>
            <div style={{
              width: 40,
              height: 40,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #ff80ab 0%, #a5b4fc 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: 18,
              color: '#fff',
              boxShadow: '0 2px 8px #ff80ab22',
            }}>{(user?.name || 'U').split(' ').map(w => w[0]).join('').toUpperCase()}</div>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: 12, color: '#7c3aed', fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>Active User</div>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#1e293b', margin: '2px 0 2px' }}>{user?.name || 'User'}</div>
              <div style={{ fontSize: 13, color: '#64748b', fontWeight: 600 }}>ID: {user?.id || 'N/A'}</div>
            </div>
            <span style={{ marginLeft: 'auto', color: '#22c55e', fontSize: 20 }}>✔️</span>
          </div>
          <button onClick={onClose} style={{
            display: 'block',
            margin: '0 auto 10px',
            width: '100%',
            maxWidth: 260,
            background: 'linear-gradient(90deg, #ff80ab 0%, #a5b4fc 100%)',
            color: '#fff',
            fontWeight: 800,
            fontSize: 16,
            borderRadius: 12,
            padding: '12px 0',
            border: 'none',
            boxShadow: '0 4px 18px #a5b4fc33',
            letterSpacing: 0.5,
            transition: 'background 0.2s',
            cursor: 'pointer',
          }}>Continue</button>
          <div style={{ fontSize: 13, color: '#64748b', marginTop: 8 }}>
            <span style={{ marginRight: 6 }}>Need help?</span>
            <a href="mailto:support@ashirwad.com" style={{ color: '#7c3aed', fontWeight: 700, textDecoration: 'underline' }}>Contact our support team</a>
          </div>
        </div>
      </div>
    </div>
  )
}
