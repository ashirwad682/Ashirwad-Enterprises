const apiCache = {}

export function getCachedDataSync(key, maxAgeMs = 15000) {
  const cached = apiCache[key]
  if (cached && Date.now() - cached.timestamp < maxAgeMs) {
    return cached.data
  }
  return null
}

export function setCachedData(key, data) {
  apiCache[key] = {
    data,
    timestamp: Date.now()
  }
}

export function clearApiCache(keyPrefix = '') {
  if (!keyPrefix) {
    for (const key in apiCache) {
      delete apiCache[key]
    }
  } else {
    for (const key in apiCache) {
      if (key.startsWith(keyPrefix)) {
        delete apiCache[key]
      }
    }
  }
}

// Fetch slabs for a specific product
export async function fetchProductSlabs(productId) {
  if (!productId) return [];
  const cacheKey = `slabs_${productId}`
  const cached = getCachedDataSync(cacheKey, 60000)
  if (cached) return cached

  const res = await fetch(apiUrl(`/api/products/${productId}/slabs`));
  if (!res.ok) throw new Error('Failed to fetch product slabs');
  const data = await res.json();
  setCachedData(cacheKey, data)
  return data;
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
  if (!managerMode) {
    const cached = getCachedDataSync('products')
    if (cached) return cached
  }

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
    const fallbackData = await fallbackRes.json()
    if (!managerMode) setCachedData('products', fallbackData)
    return fallbackData
  }

  if (!res.ok) throw new Error('Failed to fetch products')
  const data = await res.json()
  if (!managerMode) setCachedData('products', data)
  return data
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
  clearApiCache('orders_')
  clearApiCache('products')
  return res.json()
}

export async function fetchNotifications(userId) {
  // UUID validation
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(userId)) return [];
  
  const cacheKey = `notifications_${userId}`
  const cached = getCachedDataSync(cacheKey, 10000)
  if (cached) return cached

  const headers = { 'Content-Type': 'application/json' };
  const url = apiUrl(`/api/notifications/${userId}`);
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error('Failed to fetch notifications');
  const data = await res.json();
  setCachedData(cacheKey, data)
  setCachedData('notifications_current_user', data)
  return data;
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
  clearApiCache('notifications_')
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
  clearApiCache('notifications_')
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

export async function checkExpressServiceability({ pincode, state, district }) {
  const params = new URLSearchParams()
  if (pincode) params.set('pincode', pincode)
  if (state) params.set('state', state)
  if (district) params.set('district', district)

  const res = await fetch(apiUrl(`/api/express-locations/check?${params.toString()}`))
  if (!res.ok) {
    // If backend not reachable, fail gracefully — assume not eligible
    return { eligible: false, message: 'Unable to verify Express Delivery availability.' }
  }
  return res.json()
}

export async function fetchUserOrders(userId) {
  // UUID validation
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(userId)) return [];
  
  const cacheKey = `orders_${userId}`
  const cached = getCachedDataSync(cacheKey, 10000)
  if (cached) return cached

  const headers = { 'Content-Type': 'application/json' };
  const url = apiUrl(`/api/orders/${userId}`);
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error('Failed to fetch orders');
  const data = await res.json();
  setCachedData(cacheKey, data)
  return data;
}

export async function fetchOffers(userId = null) {
  const cacheKey = userId ? `offers_${userId}` : 'offers_public'
  const cached = getCachedDataSync(cacheKey, 15000)
  if (cached) return cached

  const url = userId ? apiUrl(`/api/offers?user_id=${userId}`) : apiUrl('/api/offers')
  const res = await fetch(url)
  if (!res.ok) throw new Error('Failed to fetch offers')
  const data = await res.json();
  setCachedData(cacheKey, data)
  return data;
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

export async function verifyAndCreateOrder(paymentResponse, orderPayload) {
  const res = await fetch(apiUrl('/api/payments/verify-and-create-order'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ paymentResponse, orderPayload })
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || 'Failed to verify payment and create order')
  }
  clearApiCache('orders_')
  clearApiCache('products')
  return res.json()
}

export async function verifyIfscCode(ifsc) {
  const res = await fetch(apiUrl(`/api/bank/verify-ifsc?ifsc=${encodeURIComponent(ifsc)}`))
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(body.error || 'Failed to verify IFSC Code. Please enter a valid IFSC Code.')
  }
  return body
}

export async function resolveAccountHolderName(accountNumber, ifsc, role, options = {}) {
  const headers = { 'Content-Type': 'application/json' }
  if (role === 'user') {
    if (options.token) {
      headers['Authorization'] = `Bearer ${options.token}`
    }
  } else if (role === 'manager') {
    const token = localStorage.getItem('manager_token')
    if (token) {
      headers['x-manager-token'] = token
    }
  } else if (role === 'delivery') {
    if (options.dpId) {
      headers['x-delivery-partner-id'] = options.dpId
    }
  }

  const res = await fetch(
    apiUrl(`/api/bank/resolve-account-holder?account_number=${encodeURIComponent(accountNumber)}&ifsc=${encodeURIComponent(ifsc || '')}`),
    { headers }
  )
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(body.error || 'Failed to resolve account holder name')
  }
  return body
}


export async function fetchBankAccount(role, options = {}) {
  let url = ''
  const headers = { 'Content-Type': 'application/json' }

  if (role === 'user') {
    url = apiUrl('/api/user/bank-account')
    if (options.token) {
      headers['Authorization'] = `Bearer ${options.token}`
    }
  } else if (role === 'manager') {
    url = apiUrl('/api/manager/bank-account')
    const token = localStorage.getItem('manager_token')
    if (token) {
      headers['x-manager-token'] = token
    }
  } else if (role === 'delivery') {
    url = apiUrl('/api/delivery/bank-account')
    if (options.dpId) {
      headers['x-delivery-partner-id'] = options.dpId
    }
  } else {
    throw new Error('Invalid role for bank account fetch')
  }

  const res = await fetch(url, { headers })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || 'Failed to fetch bank account details')
  }
  return res.json()
}

export async function saveBankAccount(role, payload, options = {}) {
  let url = ''
  const headers = { 'Content-Type': 'application/json' }

  if (role === 'user') {
    url = apiUrl('/api/user/bank-account')
    if (options.token) {
      headers['Authorization'] = `Bearer ${options.token}`
    }
  } else if (role === 'manager') {
    url = apiUrl('/api/manager/bank-account')
    const token = localStorage.getItem('manager_token')
    if (token) {
      headers['x-manager-token'] = token
    }
  } else if (role === 'delivery') {
    url = apiUrl('/api/delivery/bank-account')
    if (options.dpId) {
      headers['x-delivery-partner-id'] = options.dpId
    }
  } else {
    throw new Error('Invalid role for bank account save')
  }

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload)
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(body.error || 'Failed to save bank account details')
  }
  return body
}

export async function deleteBankAccount(role, options = {}) {
  let url = ''
  const headers = { 'Content-Type': 'application/json' }

  if (role === 'user') {
    url = apiUrl('/api/user/bank-account')
    if (options.token) {
      headers['Authorization'] = `Bearer ${options.token}`
    }
  } else if (role === 'manager') {
    url = apiUrl('/api/manager/bank-account')
    const token = localStorage.getItem('manager_token')
    if (token) {
      headers['x-manager-token'] = token
    }
  } else if (role === 'delivery') {
    url = apiUrl('/api/delivery/bank-account')
    if (options.dpId) {
      headers['x-delivery-partner-id'] = options.dpId
    }
  } else {
    throw new Error('Invalid role for bank account delete')
  }

  const res = await fetch(url, {
    method: 'DELETE',
    headers
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(body.error || 'Failed to remove bank account details')
  }
  return body
}

export async function fetchAdminBankAccounts(adminKey) {
  const res = await fetch(apiUrl('/api/admin/bank-accounts'), {
    headers: { 'x-admin-api-key': adminKey }
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || 'Failed to fetch bank accounts for admin')
  }
  return res.json()
}

export async function adminApproveBankAccount(adminKey, id, notes = '') {
  const res = await fetch(apiUrl(`/api/admin/bank-accounts/${id}/approve`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-admin-api-key': adminKey },
    body: JSON.stringify({ notes })
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(body.error || 'Failed to approve bank account')
  }
  return body
}

export async function adminRejectBankAccount(adminKey, id, notes = '') {
  const res = await fetch(apiUrl(`/api/admin/bank-accounts/${id}/reject`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-admin-api-key': adminKey },
    body: JSON.stringify({ notes })
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(body.error || 'Failed to reject bank account')
  }
  return body
}

export async function adminRequestChangesBankAccount(adminKey, id, notes) {
  const res = await fetch(apiUrl(`/api/admin/bank-accounts/${id}/request-changes`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-admin-api-key': adminKey },
    body: JSON.stringify({ notes })
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(body.error || 'Failed to request bank account changes')
  }
  return body
}

export async function adminUpdateManagerSalaryConfig(adminKey, id, baseSalary, payrollSchedule = 'monthly') {
  const res = await fetch(apiUrl(`/api/admin/managers/${id}/salary-config`), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'x-admin-api-key': adminKey },
    body: JSON.stringify({ base_salary: baseSalary, payroll_schedule: payrollSchedule })
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body.error || 'Failed to update manager salary config')
  return body
}

export async function adminCalculateDeliveryPartnerSalary(adminKey, partnerId, startDate, endDate) {
  const params = new URLSearchParams({ delivery_partner_id: partnerId, start_date: startDate, end_date: endDate })
  const res = await fetch(apiUrl(`/api/admin/salaries/calculate-delivery-partner?${params.toString()}`), {
    headers: { 'x-admin-api-key': adminKey }
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body.error || 'Failed to calculate delivery partner salary')
  return body
}

export async function adminInitiateSalary(adminKey, data) {
  const res = await fetch(apiUrl('/api/admin/salaries/initiate'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-admin-api-key': adminKey },
    body: JSON.stringify(data)
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body.error || 'Failed to initiate salary')
  return body
}

export async function fetchAdminSalariesHistory(adminKey) {
  const res = await fetch(apiUrl('/api/admin/salaries/history'), {
    headers: { 'x-admin-api-key': adminKey }
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || 'Failed to fetch salaries history')
  }
  return res.json()
}

export async function adminUpdateSalaryStatus(adminKey, id, status, transactionId = '', remarks = '') {
  const res = await fetch(apiUrl(`/api/admin/salaries/${id}/status`), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'x-admin-api-key': adminKey },
    body: JSON.stringify({ payment_status: status, transaction_id: transactionId, remarks })
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body.error || 'Failed to update salary status')
  return body
}

export async function adminInitiateRefund(adminKey, orderId, amount, remarks = '') {
  const res = await fetch(apiUrl('/api/admin/refunds/initiate'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-admin-api-key': adminKey },
    body: JSON.stringify({ order_id: orderId, amount, remarks })
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body.error || 'Failed to initiate refund')
  return body
}

export async function fetchAdminRefundsHistory(adminKey) {
  const res = await fetch(apiUrl('/api/admin/refunds/history'), {
    headers: { 'x-admin-api-key': adminKey }
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || 'Failed to fetch refunds history')
  }
  return res.json()
}

export async function adminUpdateRefundStatus(adminKey, id, status, transactionId = '', remarks = '') {
  const res = await fetch(apiUrl(`/api/admin/refunds/${id}/status`), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', 'x-admin-api-key': adminKey },
    body: JSON.stringify({ payment_status: status, transaction_id: transactionId, remarks })
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body.error || 'Failed to update refund status')
  return body
}

export async function fetchAdminFinancialRecords(adminKey) {
  const res = await fetch(apiUrl('/api/admin/financials/records'), {
    headers: { 'x-admin-api-key': adminKey }
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error || 'Failed to fetch financial records')
  }
  return res.json()
}


