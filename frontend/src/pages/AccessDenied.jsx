import React from 'react';
export default function AccessDenied() {
  return (
    <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fffbe6' }}>
      <div style={{ padding: 40, borderRadius: 12, boxShadow: '0 2px 16px rgba(0,0,0,0.07)', background: '#fff', maxWidth: 420 }}>
        <h2 style={{ color: '#d32f2f', marginBottom: 16 }}>403 - Access Denied</h2>
        <p style={{ color: '#555', fontSize: 16 }}>You do not have permission to view this page.<br />Contact your admin for access.</p>
      </div>
    </div>
  );
}
