import React, { useState } from 'react';

export default function SlabPriceCalculator({ product, slab }) {
  const [quantity, setQuantity] = useState('');
  const price = Number(product?.price || 0);
  const minQty = Number(slab.min_quantity || 0);
  const discountType = slab.discount_type;
  const discountValue = Number(slab.discount_value || 0);
  const qty = Number(quantity || 0);
  const eligible = qty >= minQty && minQty > 0;
  let totalBefore = qty * price;
  let discount = 0;
  if (eligible) {
    if (discountType === 'percent') {
      discount = totalBefore * (discountValue / 100);
    } else {
      discount = discountValue * qty;
    }
  }
  let totalAfter = totalBefore - discount;
  return (
    <div style={{ margin: '18px 0', background: '#fff', border: '1px solid #e0e0e0', borderRadius: 8, padding: 16, maxWidth: 400 }}>
      <div style={{ marginBottom: 10, fontWeight: 600 }}>Slab Price Calculator</div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 8 }}>
        <label>Quantity:</label>
        <input type="number" min={1} value={quantity} onChange={e => setQuantity(e.target.value)} style={{ padding: 6, width: 80 }} />
      </div>
      <div style={{ fontSize: 14, marginBottom: 4 }}>Unit Price: <b>₹{price.toLocaleString()}</b></div>
      <div style={{ fontSize: 14, marginBottom: 4 }}>Total Before Discount: <b>₹{totalBefore.toLocaleString()}</b></div>
      <div style={{ fontSize: 14, marginBottom: 4 }}>Discount: <b style={{ color: eligible ? '#388e3c' : '#888' }}>₹{discount.toLocaleString()}</b> {eligible ? '' : '(Not eligible)'}</div>
      <div style={{ fontSize: 15, fontWeight: 700, color: '#1976d2' }}>Total After Discount: ₹{totalAfter.toLocaleString()}</div>
    </div>
  );
}