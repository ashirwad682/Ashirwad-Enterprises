import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import { resolveApplicableSlab, calculateSlabDiscountAmount, formatSlabRuleText } from '../lib/slab-utils.js'

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

function getUnitPriceFromItem(item) {
  return item.unit_price ?? item.rate ?? item.price ?? item.unitPrice ?? 0
}

async function fetchProductSlabs(productId) {
  const { data, error } = await supabase
    .from('product_slabs')
    .select('*')
    .eq('product_id', productId)
  if (error) {
    console.error('Error fetching slabs for', productId, error.message)
    return []
  }
  return data || []
}

async function updateOrder(orderId, items, slabSum) {
  const { error } = await supabase
    .from('orders')
    .update({ items, Slab_discount: slabSum })
    .eq('id', orderId)

  if (error) {
    console.error('Failed updating order', orderId, error.message)
    return false
  }
  return true
}

async function processOrders(batchSize = 200) {
  console.log('Scanning orders with Slab_discount > 0')
  let offset = 0
  while (true) {
    const { data: orders, error } = await supabase
      .from('orders')
      .select('id, items, Slab_discount')
      .gt('Slab_discount', 0)
      .range(offset, offset + batchSize - 1)

    if (error) {
      console.error('Error fetching orders:', error.message)
      return
    }
    if (!orders || orders.length === 0) break

    for (const order of orders) {
      try {
        const items = Array.isArray(order.items) ? JSON.parse(JSON.stringify(order.items)) : []
        let slabSum = 0
        let changed = false

        for (const item of items) {
          const qty = Number(item.quantity || item.qty || 0)
          const storedDiscount = Number(item.slab_discount || 0)

          if ((!item.slab || Object.keys(item.slab).length === 0) && storedDiscount > 0 && qty > 0) {
            const slabs = await fetchProductSlabs(item.product_id || item.productId)
            const applicable = resolveApplicableSlab(slabs, qty)
            if (applicable) {
              item.slab = applicable
              const unitPrice = Number(getUnitPriceFromItem(item) || 0)
              const recomputed = calculateSlabDiscountAmount({ price: unitPrice, quantity: qty, slab: applicable })
              // keep stored value if it differs, but prefer recomputed if stored is zero
              if (!storedDiscount) {
                item.slab_discount = recomputed
              }
              changed = true
            } else {
              // no slab row found; ensure we still have slab_discount field
              if (!('slab_discount' in item) && storedDiscount > 0) {
                item.slab_discount = storedDiscount
                changed = true
              }
            }
          }
          slabSum += Number(item.slab_discount || 0)
        }

        if (changed) {
          const ok = await updateOrder(order.id, items, slabSum)
          if (ok) console.log('Updated order', order.id, 'new Slab_discount:', slabSum)
        } else if (Number(order.Slab_discount || 0) !== slabSum) {
          // ensure order-level Slab_discount is consistent
          const ok = await updateOrder(order.id, items, slabSum)
          if (ok) console.log('Normalized Slab_discount for', order.id, 'to', slabSum)
        }
      } catch (err) {
        console.error('Error processing order', order.id, err.message)
      }
    }

    if (orders.length < batchSize) break
    offset += batchSize
  }
  console.log('Backfill complete')
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1] && process.argv[1].endsWith('backfill_slabs.mjs')) {
  const limit = Number(process.env.BATCH_SIZE || 200)
  processOrders(limit).catch((err) => {
    console.error('Fatal error', err)
    process.exit(1)
  })
}
