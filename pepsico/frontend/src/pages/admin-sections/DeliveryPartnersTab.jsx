import React, { useState, useEffect } from 'react';
import { useAdminAuth } from '../../context/AdminAuthContext';
const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5001';

export default function DeliveryPartnersTab({ managerMode }) {
  const [partners, setPartners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { adminKey } = useAdminAuth ? useAdminAuth() : { adminKey: null };
  const managerToken = localStorage.getItem('manager_token');

  useEffect(() => {
    if (managerMode && !managerToken) return;
    if (!managerMode && !adminKey) return;
    fetchPartners();
  }, [adminKey, managerToken, managerMode]);

  async function fetchPartners() {
    setLoading(true);
    setError(null);
    try {
      let url, headers;
      if (managerMode) {
        url = `${API_BASE}/api/manager/delivery-partners`;
        headers = { 'x-manager-token': managerToken };
      } else {
        url = `${API_BASE}/api/admin/delivery-partners`;
        headers = { 'x-admin-key': adminKey };
      }
      const res = await fetch(url, { headers });
      if (!res.ok) throw new Error('Failed to fetch delivery partners');
      const data = await res.json();
      setPartners(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h3>Delivery Partners {managerMode && '(Manager View)'}</h3>
      {loading ? 'Loading...' : error ? error : (
        <ul>
          {partners.map(p => (
            <li key={p.id}>{p.name} - {p.email}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
