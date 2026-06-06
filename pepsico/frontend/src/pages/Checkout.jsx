import React, { useMemo, useState, useEffect } from 'react'
import { useCart } from '../context/CartContext'
import { createOrder, upsertAddress, validateCoupon, fetchPincode, getPaymentConfig, createRazorpayOrder, fetchOffers, fetchProductSlabs } from '../api/client'
import { supabase } from '../lib/supabaseClient'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { useMediaQuery } from '../lib/useMediaQuery'
import { calculateSlabDiscountAmount, formatSlabRuleText, resolveApplicableSlab } from '../lib/slabUtils'

function loadRazorpay() {
  return new Promise((resolve) => {
    if (window.Razorpay) return resolve(true)
    const script = document.createElement('script')
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    script.onload = () => resolve(true)
    script.onerror = () => resolve(false)
    document.body.appendChild(script)
  })
}

function buildPickupAvailability(now = new Date()) {
  const placedAt = now instanceof Date ? new Date(now) : new Date(now)
  if (Number.isNaN(placedAt.getTime())) return null

  const cutoff = new Date(placedAt)
  cutoff.setHours(17, 0, 0, 0)

  if (placedAt <= cutoff) {
    const availableUntil = new Date(placedAt)
    availableUntil.setHours(21, 0, 0, 0)
    return {
      availableFrom: placedAt,
      availableUntil,
      mode: 'same_day'
    }
  }

  const availableFrom = new Date(placedAt)
  availableFrom.setDate(availableFrom.getDate() + 1)
  availableFrom.setHours(9, 0, 0, 0)

  const availableUntil = new Date(availableFrom)
  availableUntil.setHours(21, 0, 0, 0)

  return {
    availableFrom,
    availableUntil,
    mode: 'next_day'
  }
}

function formatPickupAvailabilityLabel(pickupWindow) {
  if (!pickupWindow?.availableFrom || !pickupWindow?.availableUntil) {
    return 'Pickup slot will be shared after approval.'
  }

  const start = pickupWindow.availableFrom
  const end = pickupWindow.availableUntil
  const dateLabel = start.toLocaleDateString('en-IN', {
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  })
  const startTime = start.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
  const endTime = end.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })

  return `${dateLabel}, ${startTime} - ${endTime}`
}

export default function Checkout() {
  const accentFont = "'Space Grotesk', 'Sora', 'Inter', system-ui, -apple-system, sans-serif"
  const { state, dispatch } = useCart()
  const navigate = useNavigate()
  const isTablet = useMediaQuery('(max-width: 1024px)')
  const isMobile = useMediaQuery('(max-width: 640px)')
  const [status, setStatus] = useState(null)
  const [error, setError] = useState(null)
  const [addr, setAddr] = useState(null)
  const [userProfile, setUserProfile] = useState(null)
  const [loadingAddr, setLoadingAddr] = useState(true)
  const [addrError, setAddrError] = useState(null)
  const [coupon, setCoupon] = useState('')
  const [offers, setOffers] = useState([])
  const [autoOffer, setAutoOffer] = useState(null)
  const [autoDiscount, setAutoDiscount] = useState(0)
  const [couponDiscount, setCouponDiscount] = useState(0)
  const [couponDetails, setCouponDetails] = useState(null)
  const [couponFeedback, setCouponFeedback] = useState(null)
  const [applying, setApplying] = useState(false)
  const [paying, setPaying] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState('razorpay')
  const [shippingMethod, setShippingMethod] = useState('express') // 'standard', 'express', or 'pickup_drive'
  const [productSlabsById, setProductSlabsById] = useState({})

  const items = useMemo(() => Object.values(state.items), [state.items])
  const productIds = useMemo(() => {
    return Array.from(new Set(items.map((item) => String(item?.product?.id || '')).filter(Boolean)))
  }, [items])

  useEffect(() => {
    let cancelled = false

    if (productIds.length === 0) {
      setProductSlabsById({})
      return () => {
        cancelled = true
      }
    }

    async function loadSlabs() {
      const entries = await Promise.all(productIds.map(async (productId) => {
        try {
          const slabs = await fetchProductSlabs(productId)
          return [productId, { loaded: true, slabs: Array.isArray(slabs) ? slabs : [] }]
        } catch (error) {
          return [productId, { loaded: true, slabs: [] }]
        }
      }))

      if (!cancelled) {
        setProductSlabsById(Object.fromEntries(entries))
      }
    }

    loadSlabs()

    return () => {
      cancelled = true
    }
  }, [productIds])

  const resolvedItems = useMemo(() => {
    return items.map((item) => {
      const qty = Number(item.qty || 0)
      const price = Number(item.product?.price || 0)
      const productId = String(item.product?.id || '')
      const slabEntry = productSlabsById[productId]
      const candidateSlabs = slabEntry?.loaded ? slabEntry.slabs : (item.slab ? [item.slab] : [])
      const slab = resolveApplicableSlab(candidateSlabs, qty) || null

      return {
        ...item,
        slab,
        slab_discount: calculateSlabDiscountAmount({ price, quantity: qty, slab })
      }
    })
  }, [items, productSlabsById])

  // Subtotal: sum of unit price * quantity for all items (before slab discount)
  const subtotal = useMemo(() => {
    return resolvedItems.reduce((sum, item) => {
      const price = Number(item.product.price);
      const qty = item.qty;
      return sum + (price * qty);
    }, 0);
  }, [resolvedItems]);

  // Slab discount: applies only to the slab quantity, not the entire cart quantity
  const slabDiscount = useMemo(() => {
    return resolvedItems.reduce((sum, item) => {
      const price = Number(item.product.price);
      const qty = item.qty;
      return sum + calculateSlabDiscountAmount({ price, quantity: qty, slab: item.slab });
    }, 0);
  }, [resolvedItems]);

  // Offer discount: only for qualifying product(s), supports auto-applied and manual offers
  const offerDiscount = useMemo(() => {
    // Prefer auto-applied offer if present
    const offer = autoOffer || state.offer;
    if (!offer) return 0;
    return resolvedItems.reduce((sum, item) => {
      const price = Number(item.product.price);
      const qty = item.qty;
      let discount = 0;
      // Offer applies only to eligible product(s)
      if (
        offer.id &&
        item.product.offer_id &&
        String(item.product.offer_id) === String(offer.id)
      ) {
        // Apply offer discount on price AFTER slab discount (if any)
        let effectivePrice = price;
        if (item.slab && qty >= item.slab.min_quantity) {
          if (item.slab.discount_type === 'percent') {
            effectivePrice = price * (1 - Number(item.slab.discount_value) / 100);
          } else {
            effectivePrice = price - Number(item.slab.discount_value);
          }
        }
        if (offer.discount_type === 'percent') {
          discount = effectivePrice * qty * (Number(offer.discount_value) / 100);
        } else {
          discount = Number(offer.discount_value) * qty;
        }
      }
      // Prevent negative discounts
      if (discount < 0) discount = 0;
      return sum + discount;
    }, 0);
  }, [resolvedItems, autoOffer, state.offer]);

  // Keep offer discount source consistent between display and billing totals.
  const appliedOfferDiscount = useMemo(
    () => Math.max(Number(autoDiscount) || 0, Number(offerDiscount) || 0),
    [autoDiscount, offerDiscount]
  )

  // Total discount: slab + offer + coupon
  const totalDiscount = useMemo(
    () => slabDiscount + appliedOfferDiscount + couponDiscount,
    [slabDiscount, appliedOfferDiscount, couponDiscount]
  )

  // Total after discount
  const subtotalAfterDiscount = useMemo(() => Math.max(0, subtotal - totalDiscount), [subtotal, totalDiscount])
  const orderItemsPayload = useMemo(() => {
    return resolvedItems.map((it) => {
      const qty = Number(it.qty || 0)
      const price = Number(it.product?.price || 0)
      const slab = it.slab
        ? {
            min_quantity: Number(it.slab.min_quantity || 0),
            discount_type: it.slab.discount_type,
            discount_value: Number(it.slab.discount_value || 0),
            start_date: it.slab.start_date || null,
            end_date: it.slab.end_date || null
          }
        : null

      let itemSlabDiscount = 0
      itemSlabDiscount = calculateSlabDiscountAmount({ price, quantity: qty, slab })

      return {
        product_id: it.product.id,
        quantity: qty,
        slab,
        slab_discount: Number(itemSlabDiscount.toFixed(2))
      }
    })
  }, [resolvedItems])

  const isPickupOrder = shippingMethod === 'pickup_drive'
  const pickupWindow = useMemo(() => {
    if (!isPickupOrder) return null
    return buildPickupAvailability(new Date())
  }, [isPickupOrder])
  const pickupAvailabilityLabel = useMemo(() => formatPickupAvailabilityLabel(pickupWindow), [pickupWindow])
  
  // Shipping fee based on method selection
  const shippingFee = useMemo(() => shippingMethod === 'express' ? 500 : 0, [shippingMethod])
  
  // GST (5%) - applied only on product total, NOT on shipping
  const gstRate = 0.05
  const gstAmount = useMemo(() => Math.round(subtotalAfterDiscount * gstRate), [subtotalAfterDiscount])
  
  // Total payable = product total + GST + shipping
  const totalPayable = useMemo(() => subtotalAfterDiscount + gstAmount + shippingFee, [subtotalAfterDiscount, gstAmount, shippingFee])
  const cartIsEmpty = items.length === 0
  const detailGridColumns = isMobile ? '1fr' : '120px 1fr'

  useEffect(() => {
    loadSavedAddress()
  }, [])

  useEffect(() => {
    loadOffers()
  }, [])

  async function loadSavedAddress() {
    try {
      setLoadingAddr(true)
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) {
        setAddrError('Please login first')
        return
      }

      // Validate UUID
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      if (!uuidRegex.test(authUser.id)) {
        setAddrError('User ID is not valid. Please contact support.')
        return
      }

      // Fetch user profile
      const { data: profileData } = await supabase
        .from('users')
        .select('*')
        .eq('id', authUser.id)
        .single()
      
      if (profileData) {
        setUserProfile(profileData)
      }

      // Fetch address
      const { data, error } = await supabase
        .from('addresses')
        .select('*')
        .eq('user_id', authUser.id)
        .eq('is_default', true)
        .single()

      if (error) {
        if (error.code === 'PGRST116') {
          setAddrError('No saved address found. Please add one in your Profile first.')
        } else {
          throw error
        }
        return
      }

      setAddr(data)
    } catch (err) {
      setAddrError(`Error loading address: ${err.message}`)
    } finally {
      setLoadingAddr(false)
    }
  }

  async function loadOffers() {
    try {
      // Get user ID to filter out already-used offers
      const { data: { user } } = await supabase.auth.getUser()
      const userId = user?.id || null
      
      const data = await fetchOffers(userId)
      setOffers(Array.isArray(data) ? data : [])
    } catch (err) {
      console.warn('Failed to load offers:', err)
    }
  }

  useEffect(() => {
    if (!offers.length || subtotal <= 0) {
      setAutoOffer(null)
      setAutoDiscount(0)
      return
    }

    let bestOffer = null
    let bestSavings = 0

    for (const offer of offers) {
      if (!offer) continue
      const minAmount = Number(offer.minimumAmount || 0)
      if (subtotal < minAmount) continue

      // If offer is for a specific product, calculate discount only on that product's amount
      let discountValue = 0;
      if (offer.productId) {
        const eligibleItems = items.filter(({ product }) => String(product.id) === String(offer.productId));
        if (!eligibleItems.length) continue;
        const eligibleTotal = eligibleItems.reduce((sum, { product, qty }) => sum + (Number(product.price) * qty), 0);
        if (offer.discountType === 'percent') {
          discountValue = eligibleTotal * Number(offer.discountValue || 0) / 100;
        } else {
          discountValue = Number(offer.discountValue || 0) * eligibleItems.reduce((sum, { qty }) => sum + qty, 0);
        }
      } else {
        // If offer is on subtotal (no productId), fallback to old logic
        discountValue = offer.discountType === 'percent'
          ? (subtotal * Number(offer.discountValue || 0)) / 100
          : Number(offer.discountValue || 0)
      }

      const savings = Math.min(subtotal, Math.max(0, discountValue))
      if (savings > bestSavings) {
        bestSavings = savings
        bestOffer = offer
      }
    }

    if (bestOffer) {
      setAutoOffer(bestOffer)
      setAutoDiscount(Number(bestSavings.toFixed(2)))
    } else {
      setAutoOffer(null)
      setAutoDiscount(0)
    }
  }, [offers, items, subtotal])

  const cardStyle = {
    background: '#fff',
    borderRadius: 18,
    padding: '18px 18px 20px',
    border: '1px solid #e8edf5',
    boxShadow: '0 18px 60px rgba(15,23,42,0.08)'
  }

  const chipStyle = {
    padding: '6px 12px',
    borderRadius: 999,
    background: '#eef2ff',
    color: '#243bff',
    fontSize: 12,
    fontWeight: 600,
    letterSpacing: 0.2
  }

  async function applyCouponCode() {
    const normalizedCode = coupon.trim().toUpperCase()
    if (!normalizedCode) {
      setCouponFeedback({ type: 'error', message: 'Enter a coupon code first.' })
      return
    }

    setCoupon(normalizedCode)
    setApplying(true)
    setCouponFeedback(null)
    try {
      // Get user_id from supabase auth
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) {
        setCouponFeedback({ type: 'error', message: 'Please login to apply a coupon.' })
        setApplying(false)
        return
      }
      const res = await validateCoupon(normalizedCode, subtotal, orderItemsPayload, authUser.id)

      if (!res?.valid) {
        setCouponDiscount(0)
        setCouponDetails(null)

        let message = 'Coupon not applicable to this order.'
        switch (res?.reason) {
          case 'NOT_FOUND':
            message = 'Coupon not recognized. Please check the code.'
            break
          case 'MIN_AMOUNT_NOT_MET':
            message = `This coupon requires a minimum order of ₹${Number(res?.minimumAmount || 0).toFixed(2)}.`
            break
          case 'PRODUCT_NOT_IN_CART':
            message = 'Add the qualifying product to use this coupon.'
            break
          case 'NOT_STARTED':
            message = 'This coupon is not active yet.'
            break
          case 'EXPIRED':
            message = 'This coupon has expired.'
            break
          case 'NO_DISCOUNT':
            message = 'This coupon cannot be applied to the current cart value.'
            break
          case 'COUPON_ALREADY_USED':
            message = 'You have already used this coupon. Each coupon can only be used once per user.'
            break
          default:
            break
        }

        setCouponFeedback({ type: 'error', message })
        return
      }

      const savings = Number(res.discount || 0)
      setCouponDiscount(savings)
      setCouponDetails(res.coupon || { code: normalizedCode })
      setCouponFeedback(null)
    } catch (e) {
      setCouponDiscount(0)
      setCouponDetails(null)
      setCouponFeedback({ type: 'error', message: e.message })
    } finally {
      setApplying(false)
    }
  }

  async function payAndPlaceOrder() {
    if (cartIsEmpty) {
      setError('Your cart is empty. Add some products first.')
      return
    }

    if (!isPickupOrder && !addr) {
      setError('No saved address found. Please add one in your Profile first.')
      return
    }

    setPaying(true)
    setError(null)
    setStatus(paymentMethod === 'cod' ? 'Placing order...' : 'Initializing payment...')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setError('Please login before placing an order.')
      setStatus(null)
      setPaying(false)
      return
    }
      // Validate UUID
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      if (!uuidRegex.test(user.id)) {
        setError('User ID is not valid. Please contact support.')
        setStatus(null)
        setPaying(false)
        return
      }

    try {
      // Validate stock before placing order
      const outOfStockItems = resolvedItems.filter(({ product, qty }) => qty > (product.stock || 0))
      if (outOfStockItems.length > 0) {
        const itemNames = outOfStockItems.map(({ product, qty }) => `${product.name} (ordered: ${qty}, available: ${product.stock || 0})`).join(', ')
        setError(`Insufficient stock for: ${itemNames}. Please update your cart.`)
        setStatus(null)
        setPaying(false)
        return
      }

      if (paymentMethod === 'cod') {
        // Create single order with all items (using saved address)
        try {
          const res = await createOrder({ 
            user_id: user.id, 
            items: orderItemsPayload,
            total_amount: totalPayable,
            payment_method: 'COD',
            ...(coupon && { coupon_code: coupon }),
            ...(autoOffer?.id && { offer_id: autoOffer.id }),
            subtotal,
            discount_total: totalDiscount,
            slab_discount: slabDiscount,
            coupon_discount: couponDiscount,
            offer_discount: appliedOfferDiscount,
            shipping_fee: shippingFee,
            gst_amount: gstAmount,
            shipping_method: shippingMethod
          })
          dispatch({ type: 'clear' })
          setStatus('Order placed successfully with Cash on Delivery!')
          setPaying(false)
          navigate('/dashboard/order-success', {
            replace: true,
            state: {
              orderId: res[0]?.id || res?.id,
              payment: { method: 'COD', status: 'pending' },
              address: isPickupOrder ? null : addr,
              subtotal,
              discount: totalDiscount,
              shipping: shippingFee,
              shippingMethod: shippingMethod,
              pickupWindow: pickupWindow ? {
                availableFrom: pickupWindow.availableFrom.toISOString(),
                availableUntil: pickupWindow.availableUntil.toISOString()
              } : null,
              gst: gstAmount,
              total: totalPayable,
              items: resolvedItems.map(({ product, qty, slab, slab_discount }) => ({ id: product.id, name: product.name, price: product.price, qty, slab, slab_discount }))
            }
          })
        } catch (e) {
          if (e.message === 'COUPON_ALREADY_USED') {
            setCouponFeedback({ type: 'error', message: 'You have already used this coupon. Each coupon can only be used once per user.' })
            setCoupon('')
            setCouponDiscount(0)
            setCouponDetails(null)
          } else if (e.message === 'OFFER_ALREADY_USED') {
            setError('This offer has already been used on your account and cannot be applied again.')
            setAutoOffer(null)
            setAutoDiscount(0)
            await loadOffers() // Reload offers to remove the used one
          } else {
            setError(e.message)
          }
          setPaying(false)
          setStatus(null)
        }
        return
      }

      const loaded = await loadRazorpay()
      if (!loaded) throw new Error('Failed to load Razorpay. Check your connection and try again.')

      const cfg = await getPaymentConfig()
      if (!cfg.key_id) throw new Error('Payment is not configured. Ask admin to set Razorpay keys.')

      const order = await createRazorpayOrder(totalPayable)
      setStatus('Waiting for payment...')

      const options = {
        key: cfg.key_id,
        amount: order.amount,
        currency: order.currency,
        order_id: order.id,
        name: 'PepsiCo Distributor',
        description: 'Order payment',
        handler: async function (response) {
          try {
            // Create single order with all items (using saved address)
            const res = await createOrder({ 
              user_id: user.id, 
              items: orderItemsPayload,
              total_amount: totalPayable,
              payment_method: 'prepaid',
              ...(coupon && { coupon_code: coupon }),
              ...(autoOffer?.id && { offer_id: autoOffer.id }),
              subtotal,
              discount_total: totalDiscount,
              slab_discount: slabDiscount,
              coupon_discount: couponDiscount,
              offer_discount: appliedOfferDiscount,
              shipping_fee: shippingFee,
              gst_amount: gstAmount,
              shipping_method: shippingMethod
            })
            dispatch({ type: 'clear' })
            setStatus('Payment successful. Order placed!')
            setPaying(false)
            navigate('/dashboard/order-success', {
              replace: true,
              state: {
                orderId: res[0]?.id || res?.id,
                payment: response,
                address: isPickupOrder ? null : addr,
                subtotal,
                discount: totalDiscount,
                shipping: shippingFee,
                shippingMethod: shippingMethod,
                pickupWindow: pickupWindow ? {
                  availableFrom: pickupWindow.availableFrom.toISOString(),
                  availableUntil: pickupWindow.availableUntil.toISOString()
                } : null,
                gst: gstAmount,
                total: totalPayable,
                items: resolvedItems.map(({ product, qty, slab, slab_discount }) => ({ id: product.id, name: product.name, price: product.price, qty, slab, slab_discount }))
              }
            })
          } catch (e) {
            if (e.message === 'COUPON_ALREADY_USED') {
              setCouponFeedback({ type: 'error', message: 'You have already used this coupon. Each coupon can only be used once per user.' })
              setCoupon('')
              setCouponDiscount(0)
              setCouponDetails(null)
            } else if (e.message === 'OFFER_ALREADY_USED') {
              setError('This offer has already been used on your account and cannot be applied again.')
              setAutoOffer(null)
              setAutoDiscount(0)
              await loadOffers() // Reload offers to remove the used one
            } else {
              setError('Payment captured but order creation failed: ' + e.message)
            }
            setPaying(false)
            setStatus(null)
          }
        },
        prefill: {},
        theme: { color: '#0b5fff' }
      }

      const rzp = new window.Razorpay(options)
      rzp.on('payment.failed', function (resp) {
        setError(resp?.error?.description || 'Payment failed. Please try again.')
        setPaying(false)
        setStatus(null)
      })
      rzp.open()
    } catch (e) {
      if (e.message === 'COUPON_ALREADY_USED') {
        setCouponFeedback({ type: 'error', message: 'You have already used this coupon. Each coupon can only be used once per user.' })
      } else {
        setError(e.message)
      }
      setStatus(null)
      setPaying(false)
    }
  }

  if (cartIsEmpty) {
    return (
      <div style={{ minHeight: '80vh', display: 'grid', placeItems: 'center', background: '#fafbfc', fontFamily: accentFont, padding: isMobile ? 16 : 24 }}>
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }} style={{ textAlign: 'center', maxWidth: 460 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🛒</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#0f172a', marginBottom: 10, letterSpacing: '-0.02em' }}>Your cart is empty</div>
          <p style={{ color: '#64748b', marginBottom: 20, fontSize: 14 }}>Add some products to proceed with checkout.</p>
          <button
            onClick={() => navigate('/dashboard/products')}
            style={{ background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 10, padding: '14px 24px', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}
          >
            Browse products
          </button>
        </motion.div>
      </div>
    )
  }

  return (
    <div style={{ background: '#fafbfc', minHeight: '100vh', fontFamily: accentFont, paddingBottom: 48 }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: isMobile ? '18px 16px 0' : '24px 24px 0' }}>
        {/* Header with back button */}
        <div style={{ marginBottom: 32 }}>
          <button
            type="button"
            onClick={() => navigate('/dashboard/cart')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 12px',
              border: '1px solid #e5e7eb',
              background: '#fff',
              color: '#64748b',
              fontWeight: 500,
              fontSize: 14,
              cursor: 'pointer',
              borderRadius: 8,
              marginBottom: 20,
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.color = '#3b82f6' }}
            onMouseLeave={(e) => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.color = '#64748b' }}
          >
            <span style={{ fontSize: 16 }}>←</span>
            <span>Back to cart</span>
          </button>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: isMobile ? 'stretch' : 'flex-start', flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? 12 : 0 }}>
            <div>
              <h1 style={{ margin: 0, fontSize: 32, fontWeight: 700, color: '#0f172a', letterSpacing: '-0.03em' }}>Checkout</h1>
              <p style={{ margin: '8px 0 0', color: '#64748b', fontSize: 15 }}>Review your order details and complete payment.</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, color: '#15803d', fontSize: 13, fontWeight: 600, alignSelf: isMobile ? 'flex-start' : 'auto' }}>
              <span style={{ fontSize: 16 }}>🔒</span>
              <span>Secure SSL Encryption</span>
            </div>
          </div>
        </div>

        {/* Error and Status Messages */}
        {(error || status || addrError) && (
          <div style={{ marginBottom: 20 }}>
            {error && (
              <div style={{ padding: '14px 16px', background: '#fef2f2', border: '1px solid #fee2e2', borderRadius: 12, color: '#991b1b', fontSize: 13, marginBottom: 12 }}>
                {error}
              </div>
            )}
            {addrError && !error && !isPickupOrder && (
              <div style={{ padding: '14px 16px', background: '#fef2f2', border: '1px solid #fee2e2', borderRadius: 12, color: '#991b1b', fontSize: 13, marginBottom: 12 }}>
                {addrError}
              </div>
            )}
            {status && (
              <div style={{ padding: '14px 16px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 12, color: '#1e40af', fontSize: 13 }}>
                {status}
              </div>
            )}
          </div>
        )}

        {/* Main Content: Two Column Layout */}
        <div style={{ display: 'grid', gridTemplateColumns: isTablet ? '1fr' : '1.85fr 1fr', gap: 24, alignItems: 'start' }}>
          
          {/* Left Column: Shipping, Shipping Method, Payment */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            
            {/* Shipping Information */}
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 16, padding: isMobile ? 18 : 24, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: isMobile ? 'stretch' : 'flex-start', flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? 10 : 0, marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 20 }}>{isPickupOrder ? '🏬' : '🚚'}</span>
                  <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#0f172a' }}>{isPickupOrder ? 'Pickup Information' : 'Shipping Information'}</h2>
                </div>
                <span style={{
                  padding: '5px 11px',
                  background: isPickupOrder ? '#fef3c7' : '#dcfce7',
                  color: isPickupOrder ? '#92400e' : '#166534',
                  fontSize: 11,
                  fontWeight: 700,
                  borderRadius: 6,
                  textTransform: 'uppercase',
                  letterSpacing: 0.5
                }}>
                  {isPickupOrder ? '● Pickup & Drive selected' : '● Auto-fetched from Profile'}
                </span>
              </div>

              {isPickupOrder ? (
                <div style={{
                  background: '#fff7ed',
                  borderRadius: 12,
                  padding: 18,
                  border: '1px solid #fed7aa',
                  display: 'grid',
                  gap: 10
                }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#9a3412' }}>No delivery address required for Pickup & Drive.</div>
                  <div style={{ fontSize: 13, color: '#7c2d12' }}>
                    Pickup availability: <strong>{pickupAvailabilityLabel}</strong>
                  </div>
                  <div style={{ fontSize: 12, color: '#9a3412' }}>
                    Admin will assign the nearest warehouse after approval. You will receive full warehouse and timing details in notifications.
                  </div>
                </div>
              ) : loadingAddr ? (
                <div style={{ padding: 32, textAlign: 'center', color: '#6b7280', fontSize: 14 }}>Loading address...</div>
              ) : addrError ? (
                <div style={{ padding: 16, background: '#fef2f2', border: '1px solid #fee2e2', borderRadius: 12, color: '#991b1b', fontSize: 13 }}>
                  <div style={{ marginBottom: 10 }}>{addrError}</div>
                  <button
                    onClick={() => navigate('/dashboard/profile')}
                    style={{
                      padding: '10px 16px',
                      background: '#dc2626',
                      color: '#fff',
                      border: 0,
                      borderRadius: 8,
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    Go to Profile
                  </button>
                </div>
              ) : (
                <div style={{ background: '#f8fafc', borderRadius: 12, padding: 18, display: 'grid', gap: 14 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: detailGridColumns, gap: 12 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.6 }}>NAME</div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#0f172a' }}>{userProfile?.full_name || 'User'}</div>
                  </div>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: detailGridColumns, gap: 12 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.6 }}>CONTACT NUMBER</div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#0f172a' }}>{userProfile?.phone ? `+91 ${userProfile.phone}` : '+91 00000 00000'}</div>
                  </div>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: detailGridColumns, gap: 12 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.6 }}>DELIVERY ADDRESS</div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#0f172a', lineHeight: 1.6 }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                        <span>📍</span>
                        <span>{addr?.address_line}, {addr?.district}, {addr?.state}, {addr?.pincode}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>

            {/* Shipping Method */}
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.1 }} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 16, padding: isMobile ? 18 : 24, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
                <span style={{ fontSize: 20 }}>📦</span>
                <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#0f172a' }}>Shipping Method</h2>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {/* Standard Delivery Option */}
                <button
                  type="button"
                  onClick={() => setShippingMethod('standard')}
                  style={{
                    padding: 18,
                    border: shippingMethod === 'standard' ? '2px solid #3b82f6' : '1px solid #e5e7eb',
                    borderRadius: 12,
                    display: 'flex',
                    flexDirection: isMobile ? 'column' : 'row',
                    justifyContent: 'space-between',
                    alignItems: isMobile ? 'flex-start' : 'center',
                    background: shippingMethod === 'standard' ? '#eff6ff' : '#fff',
                    position: 'relative',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    textAlign: 'left'
                  }}
                  onMouseEnter={(e) => { if (shippingMethod !== 'standard') e.currentTarget.style.borderColor = '#cbd5e1' }}
                  onMouseLeave={(e) => { if (shippingMethod !== 'standard') e.currentTarget.style.borderColor = '#e5e7eb' }}
                >
                  {shippingMethod === 'standard' && (
                    <div style={{ position: 'absolute', top: -1, left: -1, width: 22, height: 22, borderRadius: '50%', background: '#3b82f6', display: 'grid', placeItems: 'center', boxShadow: '0 2px 4px rgba(59,130,246,0.3)' }}>
                      <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#fff' }} />
                    </div>
                  )}
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 15, fontWeight: 600, color: '#0f172a', marginBottom: 5 }}>Standard Distribution</div>
                    <div style={{ fontSize: 13, color: shippingMethod === 'standard' ? '#3b82f6' : '#64748b', fontWeight: 500 }}>Delivered in 3-5 business days</div>
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#16a34a', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span>Free</span>
                    {shippingMethod === 'standard' && <span style={{ fontSize: 12 }}>✓</span>}
                  </div>
                </button>

                {/* Express Delivery Option */}
                <button
                  type="button"
                  onClick={() => setShippingMethod('express')}
                  style={{
                    padding: 18,
                    border: shippingMethod === 'express' ? '2px solid #3b82f6' : '1px solid #e5e7eb',
                    borderRadius: 12,
                    display: 'flex',
                    flexDirection: isMobile ? 'column' : 'row',
                    justifyContent: 'space-between',
                    alignItems: isMobile ? 'flex-start' : 'center',
                    background: shippingMethod === 'express' ? '#eff6ff' : '#fff',
                    position: 'relative',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    textAlign: 'left'
                  }}
                  onMouseEnter={(e) => { if (shippingMethod !== 'express') e.currentTarget.style.borderColor = '#cbd5e1' }}
                  onMouseLeave={(e) => { if (shippingMethod !== 'express') e.currentTarget.style.borderColor = '#e5e7eb' }}
                >
                  {shippingMethod === 'express' && (
                    <div style={{ position: 'absolute', top: -1, left: -1, width: 22, height: 22, borderRadius: '50%', background: '#3b82f6', display: 'grid', placeItems: 'center', boxShadow: '0 2px 4px rgba(59,130,246,0.3)' }}>
                      <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#fff' }} />
                    </div>
                  )}
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                      <div style={{ fontSize: 15, fontWeight: 600, color: '#0f172a' }}>Express Delivery</div>
                      <span style={{ padding: '2px 8px', background: '#fef3c7', color: '#92400e', fontSize: 10, fontWeight: 700, borderRadius: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>Fast</span>
                    </div>
                    <div style={{ fontSize: 13, color: shippingMethod === 'express' ? '#3b82f6' : '#64748b', fontWeight: 500 }}>Same-day delivery if ordered before 12 PM</div>
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span>₹500</span>
                    {shippingMethod === 'express' && <span style={{ fontSize: 12 }}>✓</span>}
                  </div>
                </button>

                {/* Pickup & Drive Option */}
                <button
                  type="button"
                  onClick={() => setShippingMethod('pickup_drive')}
                  style={{
                    padding: 18,
                    border: shippingMethod === 'pickup_drive' ? '2px solid #f59e0b' : '1px solid #e5e7eb',
                    borderRadius: 12,
                    display: 'flex',
                    flexDirection: isMobile ? 'column' : 'row',
                    justifyContent: 'space-between',
                    alignItems: isMobile ? 'flex-start' : 'center',
                    background: shippingMethod === 'pickup_drive' ? '#fffbeb' : '#fff',
                    position: 'relative',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    textAlign: 'left'
                  }}
                  onMouseEnter={(e) => { if (shippingMethod !== 'pickup_drive') e.currentTarget.style.borderColor = '#fcd34d' }}
                  onMouseLeave={(e) => { if (shippingMethod !== 'pickup_drive') e.currentTarget.style.borderColor = '#e5e7eb' }}
                >
                  {shippingMethod === 'pickup_drive' && (
                    <div style={{ position: 'absolute', top: -1, left: -1, width: 22, height: 22, borderRadius: '50%', background: '#f59e0b', display: 'grid', placeItems: 'center', boxShadow: '0 2px 4px rgba(245,158,11,0.3)' }}>
                      <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#fff' }} />
                    </div>
                  )}
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                      <div style={{ fontSize: 15, fontWeight: 600, color: '#0f172a' }}>Pickup &amp; Drive</div>
                      <span style={{ padding: '2px 8px', background: '#ecfdf5', color: '#065f46', fontSize: 10, fontWeight: 700, borderRadius: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>Self-Pickup</span>
                    </div>
                    <div style={{ fontSize: 13, color: shippingMethod === 'pickup_drive' ? '#b45309' : '#64748b', fontWeight: 500 }}>
                      {shippingMethod === 'pickup_drive'
                        ? `Pickup window: ${pickupAvailabilityLabel} (after admin approval)`
                        : 'Self-pickup from nearest warehouse — no delivery charge'
                      }
                    </div>
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#16a34a', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <span>Free</span>
                    {shippingMethod === 'pickup_drive' && <span style={{ fontSize: 12 }}>✓</span>}
                  </div>
                </button>
              </div>
            </motion.div>

            {/* Payment Method */}
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.2 }} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 16, padding: isMobile ? 18 : 24, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <span style={{ fontSize: 20 }}>💳</span>
                <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: '#0f172a' }}>Payment Method</h2>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('razorpay')}
                  style={{
                    padding: 16,
                    border: paymentMethod === 'razorpay' ? '2px solid #3b82f6' : '1px solid #e5e7eb',
                    borderRadius: 12,
                    background: paymentMethod === 'razorpay' ? '#eff6ff' : '#fff',
                    cursor: 'pointer',
                    position: 'relative',
                    textAlign: 'left',
                    display: 'block',
                    width: '100%'
                  }}
                >
                  {paymentMethod === 'razorpay' && (
                    <div style={{ position: 'absolute', top: -1, left: -1, width: 20, height: 20, borderRadius: '50%', background: '#3b82f6', display: 'grid', placeItems: 'center' }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#fff' }} />
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'center', flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? 10 : 0 }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#0f172a', marginBottom: 4 }}>Pay with Razorpay</div>
                      <div style={{ fontSize: 13, color: '#64748b' }}>Secure online payment via Razorpay gateway</div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      <span style={{ padding: '3px 8px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 4, fontSize: 11, fontWeight: 700, color: '#1e40af' }}>UPI</span>
                      <span style={{ padding: '3px 8px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 4, fontSize: 11, fontWeight: 700, color: '#1e40af' }}>Cards</span>
                      <span style={{ padding: '3px 8px', background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 4, fontSize: 11, fontWeight: 700, color: '#1e40af' }}>NetBanking</span>
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setPaymentMethod('cod')}
                  style={{
                    padding: 16,
                    border: paymentMethod === 'cod' ? '2px solid #3b82f6' : '1px solid #e5e7eb',
                    borderRadius: 12,
                    background: paymentMethod === 'cod' ? '#eff6ff' : '#fff',
                    cursor: 'pointer',
                    position: 'relative',
                    textAlign: 'left',
                    display: 'block',
                    width: '100%'
                  }}
                >
                  {paymentMethod === 'cod' && (
                    <div style={{ position: 'absolute', top: -1, left: -1, width: 20, height: 20, borderRadius: '50%', background: '#3b82f6', display: 'grid', placeItems: 'center' }}>
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#fff' }} />
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'center', flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? 10 : 0 }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#0f172a', marginBottom: 4 }}>Cash on Delivery (COD)</div>
                      <div style={{ fontSize: 13, color: '#64748b' }}>Pay cash when your order is delivered</div>
                    </div>
                    <span style={{ fontSize: 24 }}>💵</span>
                  </div>
                </button>
              </div>
            </motion.div>
          </div>

          {/* Right Column: Order Summary */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.15 }} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 16, padding: isMobile ? 18 : 24, position: isTablet ? 'static' : 'sticky', top: 24, boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
            <h2 style={{ margin: '0 0 20px', fontSize: 17, fontWeight: 700, color: '#0f172a' }}>Order Summary</h2>

            {/* Product List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 20 }}>
              {resolvedItems.map(({ product, qty, slab }) => {
                const price = Number(product.price);
                let totalBefore = price * qty;
                let discount = 0;
                let totalAfter = totalBefore;
                let slabInfo = null;
                let priceDisplay = <span style={{ fontWeight: 700, color: '#0f172a' }}>₹{totalBefore.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>;
                if (slab && qty >= slab.min_quantity) {
                  discount = calculateSlabDiscountAmount({ price, quantity: qty, slab })
                  totalAfter = totalBefore - discount;
                  priceDisplay = (
                    <span>
                      <span style={{ textDecoration: 'line-through', color: '#b91c1c', marginRight: 6 }}>₹{totalBefore.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                      <span style={{ fontWeight: 700, color: '#0f172a' }}>₹{totalAfter.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</span>
                    </span>
                  );
                  slabInfo = (
                    <div style={{ fontSize: 12, color: '#1976d2', marginTop: 2 }}>
                      <b>Slab Applied:</b> {formatSlabRuleText(slab)}<br />
                      <span>Unit Price: ₹{price.toLocaleString()} | Total Before: ₹{totalBefore.toLocaleString()} | <b>Discount: ₹{discount.toLocaleString()}</b> | <b>Total After: ₹{totalAfter.toLocaleString()}</b></span>
                    </div>
                  );
                }
                return (
                  <div key={product.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: isMobile ? 'stretch' : 'flex-start', flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? 8 : 12 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <div style={{ width: 20, height: 20, background: '#f3f4f6', borderRadius: 4, display: 'grid', placeItems: 'center', fontSize: 11, fontWeight: 700, color: '#6b7280' }}>{product.name.charAt(0)}</div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: '#0f172a' }}>{product.name}</div>
                      </div>
                      <div style={{ fontSize: 12, color: '#64748b', marginLeft: 28 }}>Qty: {qty}</div>
                      {slabInfo}
                    </div>
                    <div style={{ fontSize: 14 }}>{priceDisplay}</div>
                  </div>
                );
              })}
            </div>

            {/* Coupon Code Section */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 }}>COUPON CODE</div>
              <div style={{ display: 'flex', gap: 8, flexDirection: isMobile ? 'column' : 'row' }}>
                <input
                  value={coupon}
                  onChange={(e) => setCoupon(e.target.value)}
                  placeholder="Enter code"
                  style={{ flex: 1, padding: '10px 12px', borderRadius: 8, border: '1px solid #d1d5db', outline: 'none', fontSize: 13, fontWeight: 500, textTransform: 'uppercase' }}
                  onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                  onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
                />
                <button
                  type="button"
                  onClick={applyCouponCode}
                  disabled={applying || !coupon.trim()}
                  style={{
                    padding: '10px 18px',
                    borderRadius: 8,
                    border: 'none',
                    background: applying ? '#9ca3af' : '#0f172a',
                    color: '#fff',
                    fontWeight: 600,
                    fontSize: 13,
                    cursor: applying ? 'not-allowed' : 'pointer'
                  }}
                >
                  {applying ? 'Applying...' : 'Apply'}
                </button>
              </div>
              {couponFeedback && (
                <div style={{
                  marginTop: 8,
                  padding: '8px 10px',
                  borderRadius: 6,
                  background: couponFeedback.type === 'error' ? '#fef2f2' : '#f0fdf4',
                  border: couponFeedback.type === 'error' ? '1px solid #fecaca' : '1px solid #bbf7d0',
                  color: couponFeedback.type === 'error' ? '#991b1b' : '#166534',
                  fontSize: 11
                }}>
                  {couponFeedback.message}
                </div>
              )}
            </div>

            {/* Price Breakdown */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingTop: 20, borderTop: '1px solid #e5e7eb' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: '#64748b' }}>
                <span>Subtotal</span>
                <span style={{ fontWeight: 600, color: '#0f172a' }}>₹{subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>

              {/* Slab Discount (if applicable) */}
              {slabDiscount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: '#1976d2', fontWeight: 600 }}>
                  <span>Slab Discount</span>
                  <span>-₹{slabDiscount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
              )}

              {/* Offer Discount (if applicable) */}
              {appliedOfferDiscount > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: '#059669' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <span style={{ fontWeight: 600 }}>Offer Discount</span>
                      <span style={{ fontSize: 11, color: '#6b7280' }}>{autoOffer?.title || autoOffer?.message || state.offer?.title || state.offer?.message || 'Applied offer'}</span>
                    </div>
                    <span style={{ fontWeight: 600 }}>- ₹{appliedOfferDiscount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                </div>
              )}

              {/* Coupon Discount (if applicable) */}
              {couponDiscount > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: '#7c3aed' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <span style={{ fontWeight: 600 }}>Coupon Discount</span>
                      <span style={{ fontSize: 11, color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>{couponDetails?.code || coupon}</span>
                    </div>
                    <span style={{ fontWeight: 600 }}>- ₹{couponDiscount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                </div>
              )}

              {/* Total discount summary (always show if any discount) */}
              {(slabDiscount > 0 || appliedOfferDiscount > 0 || couponDiscount > 0) && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: '#16a34a', background: '#f0fdf4', padding: '8px 10px', borderRadius: 6, border: '1px solid #bbf7d0' }}>
                  <span style={{ fontWeight: 700 }}>Total Savings</span>
                  <span style={{ fontWeight: 700 }}>- ₹{(slabDiscount + appliedOfferDiscount + couponDiscount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: '#0f172a', paddingTop: 8, borderTop: '1px dashed #e5e7eb' }}>
                <span style={{ fontWeight: 600 }}>Subtotal after discount</span>
                <span style={{ fontWeight: 700 }}>₹{subtotalAfterDiscount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: '#64748b' }}>
                <span>Shipping</span>
                <span style={{ fontWeight: 600, color: '#0f172a' }}>₹{shippingFee.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: '#64748b' }}>
                <span>GST (5%)</span>
                <span style={{ fontWeight: 600, color: '#0f172a' }}>₹{gstAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              <div style={{ fontSize: 11, color: '#9ca3af', fontStyle: 'italic', marginTop: -8, paddingLeft: 0 }}>* GST applied on products only, not on shipping</div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 16, fontWeight: 700, color: '#0f172a', paddingTop: 12, borderTop: '1px solid #e5e7eb', marginTop: 4 }}>
                <span>Total Payable</span>
                <span style={{ fontSize: 18, color: '#3b82f6' }}>₹{totalPayable.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
            </div>

            {/* Place Order Button */}
            <button
              type="button"
              onClick={payAndPlaceOrder}
              disabled={paying}
              style={{
                width: '100%',
                border: 'none',
                borderRadius: 10,
                padding: '16px',
                background: paying ? '#9ca3af' : '#3b82f6',
                color: '#fff',
                fontWeight: 700,
                fontSize: 15,
                cursor: paying ? 'not-allowed' : 'pointer',
                marginTop: 24,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8
              }}
            >
              <span>{paying ? 'Processing...' : 'Place Order'}</span>
              <span style={{ fontSize: 16 }}>→</span>
            </button>

            {/* Terms Text */}
            <div style={{ marginTop: 16, textAlign: 'center', fontSize: 11, color: '#9ca3af' }}>
              By placing this order, you agree to our <a href="#" style={{ color: '#3b82f6', textDecoration: 'none' }}>Terms of Service</a>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  )
}
