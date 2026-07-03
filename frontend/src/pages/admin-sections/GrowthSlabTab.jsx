
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import SlabPriceCalculator from './SlabPriceCalculator';

export default function GrowthSlabTab({ adminKey, managerMode = false }) {
  const managerToken = localStorage.getItem('manager_token');
  const [products, setProducts] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [slabs, setSlabs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [form, setForm] = useState({
    min_quantity: '',
    discount_type: 'percent',
    discount_value: '',
    start_date: '',
    end_date: ''
  });
  const [editingSlab, setEditingSlab] = useState(null);

  useEffect(() => {
    if (managerMode && !managerToken) {
      setProducts([]);
      return;
    }

    if (!managerMode && !adminKey) {
      setProducts([]);
      return;
    }

    const headers = managerMode
      ? { 'x-manager-token': managerToken }
      : { 'x-admin-api-key': adminKey };
    const endpoint = managerMode ? '/api/manager/products' : '/api/products';

    axios.get(endpoint, { headers })
      .then(res => setProducts(res.data || []))
      .catch(() => setProducts([]));
  }, [adminKey, managerMode, managerToken]);

  useEffect(() => {
    if (selectedProduct) fetchSlabs(selectedProduct.id);
    else setSlabs([]);
  }, [selectedProduct]);

  function fetchSlabs(productId) {
    setLoading(true);
    setError('');
    setSuccess('');

    const headers = managerMode
      ? { 'x-manager-token': managerToken }
      : { 'x-admin-api-key': adminKey };
    const basePath = managerMode ? '/api/manager/products' : '/api/admin/products';

    axios.get(`${basePath}/${productId}/slabs`, { headers })
      .then(res => setSlabs(res.data || []))
      .catch(() => setSlabs([]))
      .finally(() => setLoading(false));
  }

  function handleFormChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  function validateForm() {
    if (!form.min_quantity || Number(form.min_quantity) < 1) return 'Min quantity must be at least 1';
    if (!form.discount_value || Number(form.discount_value) < 0) return 'Discount value must be 0 or more';
    if (!form.start_date) return 'Start date required';
    if (!form.end_date) return 'End date required';
    if (form.end_date < form.start_date) return 'End date cannot be before start date';
    return '';
  }

  function handleCreateOrUpdate(e) {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (!selectedProduct) return;
    const validation = validateForm();
    if (validation) {
      setError(validation);
      return;
    }
    setLoading(true);
    const method = editingSlab ? 'put' : 'post';
    const headers = managerMode
      ? { 'x-manager-token': managerToken }
      : { 'x-admin-api-key': adminKey };
    const basePath = managerMode ? '/api/manager/products' : '/api/admin/products';
    const url = editingSlab
      ? `${basePath}/${selectedProduct.id}/slabs/${editingSlab.id}`
      : `${basePath}/${selectedProduct.id}/slabs`;

    axios[method](url, form, { headers })
      .then(() => {
        fetchSlabs(selectedProduct.id);
        setForm({ min_quantity: '', discount_type: 'percent', discount_value: '', start_date: '', end_date: '' });
        setEditingSlab(null);
        setSuccess(editingSlab ? 'Slab updated successfully.' : 'Slab added successfully.');
      })
      .catch(err => setError(err?.response?.data?.error || 'Error'))
      .finally(() => setLoading(false));
  }

  function handleEdit(slab) {
    setEditingSlab(slab);
    setForm({
      min_quantity: slab.min_quantity,
      discount_type: slab.discount_type,
      discount_value: slab.discount_value,
      start_date: slab.start_date,
      end_date: slab.end_date
    });
    setError('');
    setSuccess('');
  }

  function handleDelete(slab) {
    if (!selectedProduct || !window.confirm('Delete this slab?')) return;
    setLoading(true);
    setError('');
    setSuccess('');

    const headers = managerMode
      ? { 'x-manager-token': managerToken }
      : { 'x-admin-api-key': adminKey };
    const basePath = managerMode ? '/api/manager/products' : '/api/admin/products';

    axios.delete(`${basePath}/${selectedProduct.id}/slabs/${slab.id}`, { headers })
      .then(() => {
        fetchSlabs(selectedProduct.id);
        setSuccess('Slab deleted successfully.');
      })
      .catch(err => setError(err?.response?.data?.error || 'Error'))
      .finally(() => setLoading(false));
  }

  function handleProductChange(e) {
    const prod = products.find(p => p.id === e.target.value);
    setSelectedProduct(prod || null);
    setForm({ min_quantity: '', discount_type: 'percent', discount_value: '', start_date: '', end_date: '' });
    setEditingSlab(null);
    setError('');
    setSuccess('');
  }

  return (
    <div style={{ padding: 24, maxWidth: 700, margin: '0 auto', fontFamily: 'sans-serif' }}>
      <h2 style={{ marginBottom: 16 }}>Product Slabs</h2>
      <div style={{ marginBottom: 20 }}>
        <label htmlFor="product-select" style={{ fontWeight: 500 }}>Select Product: </label>
        <select id="product-select" value={selectedProduct?.id || ''} onChange={handleProductChange} style={{ padding: 6, minWidth: 180 }}>
          <option value=''>-- Select --</option>
          {products.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>
      {selectedProduct && (
        <div style={{ border: '1px solid #eee', borderRadius: 8, padding: 20, background: '#fafbfc', marginBottom: 32 }}>
          <h3 style={{ marginTop: 0 }}>{editingSlab ? 'Edit Slab' : 'Add New Slab'} for <span style={{ color: '#1976d2' }}>{selectedProduct.name}</span></h3>
          {/* Slab Price Calculation Summary */}
          <div style={{ marginBottom: 12, background: '#f5faff', border: '1px solid #b3e5fc', borderRadius: 8, padding: 12, maxWidth: 400 }}>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>Slab Price Summary</div>
            <div style={{ fontSize: 14, marginBottom: 4 }}>Unit Price: <b>₹{selectedProduct?.price?.toLocaleString() || '0'}</b></div>
            <div style={{ fontSize: 14, marginBottom: 4 }}>Total Before Discount: <b>₹{(Number(form.min_quantity || 0) * Number(selectedProduct?.price || 0)).toLocaleString()}</b></div>
            <div style={{ fontSize: 14, marginBottom: 4 }}>Discount: <b style={{ color: Number(form.min_quantity || 0) >= 1 ? '#388e3c' : '#888' }}>₹{
              (() => {
                const qty = Number(form.min_quantity || 0);
                const price = Number(selectedProduct?.price || 0);
                const totalBefore = qty * price;
                const discountType = form.discount_type;
                const discountValue = Number(form.discount_value || 0);
                if (qty < 1) return 0;
                if (discountType === 'percent') {
                  return (totalBefore * (discountValue / 100)).toLocaleString();
                } else {
                  return (discountValue * qty).toLocaleString();
                }
              })()
            }</b></div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#1976d2' }}>Total After Discount: ₹{
              (() => {
                const qty = Number(form.min_quantity || 0);
                const price = Number(selectedProduct?.price || 0);
                const totalBefore = qty * price;
                const discountType = form.discount_type;
                const discountValue = Number(form.discount_value || 0);
                let discount = 0;
                if (qty >= 1) {
                  if (discountType === 'percent') {
                    discount = totalBefore * (discountValue / 100);
                  } else {
                    discount = discountValue * qty;
                  }
                }
                return (totalBefore - discount).toLocaleString();
              })()
            }</div>
          </div>
          <form onSubmit={handleCreateOrUpdate} style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', marginBottom: 8 }}>
            <div>
              <input name="min_quantity" type="number" placeholder="Min Qty" value={form.min_quantity} onChange={handleFormChange} required min={1} style={{ padding: 6, width: 90 }} />
            </div>
            <div>
              <select name="discount_type" value={form.discount_type} onChange={handleFormChange} style={{ padding: 6, width: 90 }}>
                <option value="percent">Percent</option>
                <option value="fixed">Fixed</option>
              </select>
            </div>
            <div>
              <input name="discount_value" type="number" placeholder="Discount" value={form.discount_value} onChange={handleFormChange} required min={0} style={{ padding: 6, width: 90 }} />
            </div>
            <div>
              <input name="start_date" type="date" value={form.start_date} onChange={handleFormChange} required style={{ padding: 6 }} />
            </div>
            <div>
              <input name="end_date" type="date" value={form.end_date} onChange={handleFormChange} required style={{ padding: 6 }} />
            </div>
            <div>
              <button type="submit" disabled={loading} style={{ padding: '6px 16px', background: '#1976d2', color: '#fff', border: 'none', borderRadius: 4, fontWeight: 500 }}>
                {editingSlab ? 'Update' : 'Add'} Slab
              </button>
              {editingSlab && (
                <button type="button" onClick={() => { setEditingSlab(null); setForm({ min_quantity: '', discount_type: 'percent', discount_value: '', start_date: '', end_date: '' }); setError(''); setSuccess(''); }} style={{ marginLeft: 8, padding: '6px 16px', background: '#eee', border: 'none', borderRadius: 4 }}>
                  Cancel
                </button>
              )}
            </div>
          </form>
          {error && <div style={{ color: '#d32f2f', marginBottom: 8 }}>{error}</div>}
          {success && <div style={{ color: '#388e3c', marginBottom: 8 }}>{success}</div>}
        </div>
      )}

      {selectedProduct && (
        <div>
          <h4 style={{ margin: '12px 0 8px 0' }}>Slabs for <span style={{ color: '#1976d2' }}>{selectedProduct.name}</span></h4>
          {loading ? (
            <div style={{ color: '#1976d2', fontWeight: 500, margin: '16px 0' }}>Loading...</div>
          ) : slabs.length === 0 ? (
            <div style={{ color: '#888', fontStyle: 'italic', margin: '16px 0' }}>No slabs found for this product.</div>
          ) : (
            <table style={{ borderCollapse: 'collapse', width: '100%', background: '#fff' }}>
              <thead>
                <tr style={{ background: '#f5f5f5' }}>
                  <th style={{ padding: 8, border: '1px solid #eee' }}>Min Qty</th>
                  <th style={{ padding: 8, border: '1px solid #eee' }}>Type</th>
                  <th style={{ padding: 8, border: '1px solid #eee' }}>Value</th>
                  <th style={{ padding: 8, border: '1px solid #eee' }}>Start</th>
                  <th style={{ padding: 8, border: '1px solid #eee' }}>End</th>
                  <th style={{ padding: 8, border: '1px solid #eee' }}>Price Summary</th>
                  <th style={{ padding: 8, border: '1px solid #eee' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {slabs.map(slab => (
                  <tr key={slab.id}>
                    <td style={{ padding: 8, border: '1px solid #eee', textAlign: 'center' }}>{slab.min_quantity}</td>
                    <td style={{ padding: 8, border: '1px solid #eee', textAlign: 'center' }}>{slab.discount_type}</td>
                    <td style={{ padding: 8, border: '1px solid #eee', textAlign: 'center' }}>{slab.discount_value}</td>
                    <td style={{ padding: 8, border: '1px solid #eee', textAlign: 'center' }}>{slab.start_date}</td>
                    <td style={{ padding: 8, border: '1px solid #eee', textAlign: 'center' }}>{slab.end_date}</td>
                    <td style={{ padding: 8, border: '1px solid #eee', textAlign: 'center', fontSize: 13 }}>
                      {/* Slab Price Summary for each slab */}
                      <div>Unit Price: ₹{selectedProduct?.price?.toLocaleString() || '0'}</div>
                      <div>Total Before: ₹{(Number(slab.min_quantity || 0) * Number(selectedProduct?.price || 0)).toLocaleString()}</div>
                      <div>Discount: ₹{
                        (() => {
                          const qty = Number(slab.min_quantity || 0);
                          const price = Number(selectedProduct?.price || 0);
                          const totalBefore = qty * price;
                          const discountType = slab.discount_type;
                          const discountValue = Number(slab.discount_value || 0);
                          if (qty < 1) return 0;
                          if (discountType === 'percent') {
                            return (totalBefore * (discountValue / 100)).toLocaleString();
                          } else {
                            return (discountValue * qty).toLocaleString();
                          }
                        })()
                      }</div>
                      <div style={{ fontWeight: 600, color: '#1976d2' }}>Total After: ₹{
                        (() => {
                          const qty = Number(slab.min_quantity || 0);
                          const price = Number(selectedProduct?.price || 0);
                          const totalBefore = qty * price;
                          const discountType = slab.discount_type;
                          const discountValue = Number(slab.discount_value || 0);
                          let discount = 0;
                          if (qty >= 1) {
                            if (discountType === 'percent') {
                              discount = totalBefore * (discountValue / 100);
                            } else {
                              discount = discountValue * qty;
                            }
                          }
                          return (totalBefore - discount).toLocaleString();
                        })()
                      }</div>
                    </td>
                    <td style={{ padding: 8, border: '1px solid #eee', textAlign: 'center' }}>
                      <button onClick={() => handleEdit(slab)} style={{ marginRight: 8, padding: '4px 10px', background: '#fff', border: '1px solid #1976d2', color: '#1976d2', borderRadius: 4, cursor: 'pointer' }}>Edit</button>
                      <button onClick={() => handleDelete(slab)} style={{ padding: '4px 10px', background: '#fff', border: '1px solid #d32f2f', color: '#d32f2f', borderRadius: 4, cursor: 'pointer' }}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
