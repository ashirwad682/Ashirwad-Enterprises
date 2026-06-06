import React, { useState, useEffect } from 'react';
import { useAdminAuth } from '../../context/AdminAuthContext';
const API_BASE = import.meta.env.VITE_API_BASE ? import.meta.env.VITE_API_BASE.replace(/\/$/, '') : (import.meta.env.PROD ? '' : 'http://localhost:5001');

export default function OffersTab({ managerMode }) {
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { adminKey } = useAdminAuth ? useAdminAuth() : { adminKey: null };
  const managerToken = localStorage.getItem('manager_token');

  useEffect(() => {
    if (managerMode && !managerToken) return;
    if (!managerMode && !adminKey) return;
    fetchOffers();
  }, [adminKey, managerToken, managerMode]);

  async function fetchOffers() {
    setLoading(true);
    setError(null);
    try {
      let url, headers;
      if (managerMode) {
        url = `${API_BASE}/api/manager/offers`;
        headers = { 'x-manager-token': managerToken };
      } else {
        url = `${API_BASE}/api/admin/offers`;
        headers = { 'x-admin-key': adminKey };
      }
      const res = await fetch(url, { headers });
      if (!res.ok) throw new Error('Failed to fetch offers');
      const data = await res.json();
      setOffers(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h3>Offers {managerMode && '(Manager View)'}</h3>
      {loading ? 'Loading...' : error ? error : (
        <ul>
          {offers.map(offer => (
            <li key={offer.id}>{offer.title} - {offer.discountValue}{offer.discountType === 'percent' ? '%' : '₹'}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
