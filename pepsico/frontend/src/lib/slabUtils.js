const round2 = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100

function normalizeDate(value) {
  if (!value) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

export function isSlabActive(slab, refDate = new Date()) {
  if (!slab) return false
  const reference = refDate instanceof Date ? refDate : new Date(refDate)
  if (Number.isNaN(reference.getTime())) return false

  const starts = normalizeDate(slab.start_date)
  const ends = normalizeDate(slab.end_date)

  if (starts && reference < starts) return false
  if (ends && reference > ends) return false
  return true
}

export function resolveApplicableSlab(slabs, quantity, refDate = new Date()) {
  const qty = Number(quantity || 0)
  if (!Array.isArray(slabs) || qty <= 0) return null

  return slabs
    .filter((slab) => slab && qty >= Number(slab.min_quantity || 0))
    .sort((left, right) => Number(right.min_quantity || 0) - Number(left.min_quantity || 0))[0] || null
}

export function calculateSlabDiscountAmount({ price, quantity, slab }) {
  const qty = Number(quantity || 0)
  const unitPrice = Number(price || 0)
  if (!slab || qty <= 0) return 0

  const minQty = Number(slab.min_quantity || 0)
  if (!minQty || qty < minQty) return 0

  if (slab.discount_type === 'percent') {
    return round2((unitPrice * qty) * (Number(slab.discount_value || 0) / 100))
  }

  return round2(Number(slab.discount_value || 0) * qty)
}

export function formatSlabRuleText(slab) {
  if (!slab) return ''
  const discountValue = Number(slab.discount_value || 0)
  const minQty = Number(slab.min_quantity || 0)

  return slab.discount_type === 'percent'
    ? `${discountValue}% off on ${minQty}+ Qty`
    : `₹${discountValue.toFixed(2)} off per unit on ${minQty}+ Qty`
}