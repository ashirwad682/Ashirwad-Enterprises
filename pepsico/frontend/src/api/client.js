// Fetch slabs for a specific product
export async function fetchProductSlabs(productId) {
  if (!productId) return [];
  const res = await fetch(apiUrl(`/api/products/${productId}/slabs`));
  if (!res.ok) throw new Error('Failed to fetch product slabs');
  return res.json();
}
export async function fetchUsers() {
  const token = localStorage.getItem('manager_token');
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['x-manager-token'] = token;
  const url = token ? apiUrl('/api/manager/users') : apiUrl('/api/admin/users');
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error('Failed to fetch users');
  return res.json();
}
const rawBase = (import.meta.env.VITE_API_BASE || '').trim();
const API_BASE = rawBase ? rawBase.replace(/\/$/, '') : (import.meta.env.PROD ? '' : 'http://localhost:5001');

function apiUrl(path) {
  if (!path.startsWith('/')) {
    return `${API_BASE}/${path}`
  }
  return `${API_BASE}${path}`
}

export async function fetchProducts(options = {}) {
  const { managerMode = false } = options
  const token = localStorage.getItem('manager_token')
  const headers = { 'Content-Type': 'application/json' }

  // User dashboard must always use public products endpoint.
  let url = apiUrl('/api/products')

  if (managerMode && token) {
    headers['x-manager-token'] = token
    url = apiUrl('/api/manager/products')
  }

  const res = await fetch(url, { headers })

  // Gracefully fall back if manager token is stale/invalid.
  if (!res.ok && managerMode) {
    const fallbackRes = await fetch(apiUrl('/api/products'), { headers: { 'Content-Type': 'application/json' } })
    if (!fallbackRes.ok) throw new Error('Failed to fetch products')
    return fallbackRes.json()
  }

  if (!res.ok) throw new Error('Failed to fetch products')
  return res.json()
}

export async function createOrder({ user_id, product_id, items, total_amount, payment_method, coupon_code, offer_id, subtotal, discount_total, slab_discount, coupon_discount, offer_discount, shipping_fee, gst_amount, shipping_method, shippingMethod }) {
  const normalizedShippingMethod = shipping_method || shippingMethod || null
  const res = await fetch(apiUrl('/api/orders'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id, product_id, items, total_amount, payment_method, coupon_code, offer_id, subtotal, discount_total, slab_discount, coupon_discount, offer_discount, shipping_fee, gst_amount, shipping_method: normalizedShippingMethod })
  })
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({ error: 'Failed to create order' }))
    throw new Error(errorData.error || 'Failed to create order')
  }
  return res.json()
}

export async function fetchNotifications(userId) {
  // UUID validation
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(userId)) return [];
  const headers = { 'Content-Type': 'application/json' };
  const url = apiUrl(`/api/notifications/${userId}`);
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error('Failed to fetch notifications');
  return res.json();
}

export async function markNotificationRead(notificationId, isRead = true) {
  if (!notificationId) throw new Error('notificationId is required')

  const res = await fetch(apiUrl(`/api/notifications/${encodeURIComponent(notificationId)}/read`), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ is_read: Boolean(isRead) })
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || 'Failed to update notification')
  }
  return res.json()
}

export async function markAllNotificationsRead(userId) {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  if (!uuidRegex.test(userId)) throw new Error('Invalid user ID')

  const res = await fetch(apiUrl(`/api/notifications/user/${encodeURIComponent(userId)}/read-all`), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' }
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || 'Failed to mark all notifications as read')
  }
  return res.json()
}

export async function upsertAddress(payload) {
  const res = await fetch(apiUrl('/api/addresses/upsert'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
  if (!res.ok) {
    let body = null
    try {
      body = await res.json()
    } catch (_) {
      // ignore JSON parse errors
    }
    throw new Error(body?.error || 'Failed to save address')
  }
  return res.json()
}

export async function createProfile({ id, email, full_name }) {
  const res = await fetch(apiUrl('/api/auth/profile'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, email, full_name })
  })
  if (!res.ok) {
    let body = null
    try {
      body = await res.json()
    } catch (_) {}
    throw new Error(body?.error || 'Failed to create profile')
  }
  return res.json()
}

export async function validateCoupon(code, total, items = [], user_id) {
  const res = await fetch(apiUrl('/api/coupons/validate'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, total, items, user_id })
  })
  if (!res.ok) throw new Error('Failed to validate coupon')
  return res.json()
}

export async function fetchPincode(pin) {
  const res = await fetch(apiUrl(`/api/geo/pincode/${pin}`))
  if (!res.ok) throw new Error('Invalid pincode')
  return res.json()
}

export async function fetchUserOrders(userId) {
  // UUID validation
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(userId)) return [];
  const headers = { 'Content-Type': 'application/json' };
  const url = apiUrl(`/api/orders/${userId}`);
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error('Failed to fetch orders');
  return res.json();
}

export async function fetchOffers(userId = null) {
  const url = userId ? apiUrl(`/api/offers?user_id=${userId}`) : apiUrl('/api/offers')
  const res = await fetch(url)
  if (!res.ok) throw new Error('Failed to fetch offers')
  return res.json()
}

export async function fetchAdminOffers(adminKey) {
  try {
    const res = await fetch(apiUrl('/api/admin/offers'), {
      headers: { 'x-admin-api-key': adminKey }
    })
    const body = await res.json().catch(() => ([]))

    if (!res.ok) {
      const message = (body && body.error) || 'Failed to fetch admin offers'
      if (res.status === 404 || res.status === 500 || /offers table/i.test(message)) {
        console.warn('fetchAdminOffers fallback triggered:', message)
        return []
      }
      throw new Error(message)
    }

    return Array.isArray(body) ? body : []
  } catch (err) {
    console.warn('fetchAdminOffers error, returning empty list', err)
    return []
  }
}

export async function createAdminOffer(adminKey, payload) {
  const res = await fetch(apiUrl('/api/admin/offers'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-admin-api-key': adminKey
    },
    body: JSON.stringify(payload)
  })
  let body = null
  let fallbackText = ''
  try {
    body = await res.json()
  } catch (_) {
    fallbackText = await res.text().catch(() => '')
  }
  if (!res.ok) {
    const message = body?.error || body?.message || fallbackText || `Failed to create offer (HTTP ${res.status})`
    throw new Error(message)
  }
  return body
}

export async function updateAdminOffer(adminKey, id, payload) {
  const res = await fetch(apiUrl(`/api/admin/offers/${id}`), {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'x-admin-api-key': adminKey
    },
    body: JSON.stringify(payload)
  })
  let body = null
  let fallbackText = ''
  try {
    body = await res.json()
  } catch (_) {
    fallbackText = await res.text().catch(() => '')
  }
  if (!res.ok) {
    const message = body?.error || body?.message || fallbackText || `Failed to update offer (HTTP ${res.status})`
    throw new Error(message)
  }
  return body
}

export async function deleteAdminOffer(adminKey, id) {
  const res = await fetch(apiUrl(`/api/admin/offers/${id}`), {
    method: 'DELETE',
    headers: { 'x-admin-api-key': adminKey }
  })
  let body = null
  let fallbackText = ''
  try {
    body = await res.json()
  } catch (_) {
    fallbackText = await res.text().catch(() => '')
  }
  if (!res.ok) {
    const message = body?.error || body?.message || fallbackText || `Failed to delete offer (HTTP ${res.status})`
    throw new Error(message)
  }
  return body
}

export async function getPaymentConfig() {
  const res = await fetch(apiUrl('/api/payments/config'))
  if (!res.ok) throw new Error('Failed to load payment config')
  return res.json()
}

export async function createRazorpayOrder(amount) {
  const res = await fetch(apiUrl('/api/payments/create-order'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount })
  })
  if (!res.ok) throw new Error('Failed to create Razorpay order')
  return res.json()
}
