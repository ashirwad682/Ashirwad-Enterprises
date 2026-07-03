import React, { createContext, useContext, useReducer, useMemo, useEffect } from 'react'

const CartContext = createContext(null)

function calculateItemTotal(item) {
  const price = Number(item?.product?.price || 0)
  const qty = Number(item?.qty || 0)

  if (item?.slab && qty >= Number(item.slab.min_quantity || 0)) {
    let discount = 0
    if (item.slab.discount_type === 'percent') {
      discount = (price * qty) * (Number(item.slab.discount_value || 0) / 100)
    } else {
      discount = Number(item.slab.discount_value || 0) * qty
    }

    return (price * qty) - discount
  }

  return price * qty
}

function calculateCartTotal(items) {
  return Object.values(items).reduce((sum, item) => sum + calculateItemTotal(item), 0)
}

function cartReducer(state, action) {
  switch (action.type) {
    case 'add': {
      const { product, maxQty, qty = 1, slab = null } = action;
      const existing = state.items[product.id];
      const currentQty = existing ? existing.qty : 0;
      let newQty = currentQty + qty;
      if (newQty > (maxQty || product.stock || 0)) {
        return state;
      }
      // If slab is provided and eligible, attach slab info
      let itemSlab = null;
      if (slab && newQty >= slab.min_quantity) {
        itemSlab = slab;
      } else if (existing && existing.slab && newQty < existing.slab.min_quantity) {
        itemSlab = null; // Auto-remove slab if qty drops below min
      } else if (existing && existing.slab) {
        itemSlab = existing.slab;
      }
      const items = { ...state.items, [product.id]: { product, qty: newQty, slab: itemSlab } };
      const total = calculateCartTotal(items)
      return { items, total };
    }
    case 'remove': {
      const { id } = action;
      const items = { ...state.items };
      if (!items[id]) return state;
      let newQty = items[id].qty - 1;
      let itemSlab = items[id].slab;
      if (itemSlab && newQty < itemSlab.min_quantity) {
        itemSlab = null; // Auto-remove slab if qty drops below min
      }
      if (newQty > 0) {
        items[id] = { ...items[id], qty: newQty, slab: itemSlab };
      } else {
        delete items[id];
      }
      const total = calculateCartTotal(items)
      return { items, total };
    }
    case 'remove_product': {
      const { id } = action;
      const items = { ...state.items };
      if (!items[id]) return state;
      delete items[id];
      const total = calculateCartTotal(items)
      return { items, total };
    }
    case 'set_qty': {
      const { id, qty: setQty, product: setProduct, slab: setSlab } = action;
      const items = { ...state.items };
      const existing = items[id]

      if (!existing && !setProduct) {
        return state
      }

      if (setQty <= 0) {
        delete items[id]
      } else {
        let resolvedSlab = typeof setSlab !== 'undefined' ? setSlab : (existing?.slab || null)
        if (resolvedSlab && setQty < Number(resolvedSlab.min_quantity || 0)) {
          resolvedSlab = null
        }

        items[id] = {
          product: setProduct || existing?.product,
          qty: setQty,
          slab: resolvedSlab
        }
      }

      const total = calculateCartTotal(items)
      return { items, total }
    }
    case 'clear':
      return { items: {}, total: 0 };
    default:
      return state;
  }
}

export function CartProvider({ children }) {
  // Load cart from localStorage if available
  const getInitialCart = () => {
    try {
      const stored = localStorage.getItem('cart-state-v1');
      if (stored) return JSON.parse(stored);
    } catch {}
    return { items: {}, total: 0 };
  };
  const [state, dispatch] = useReducer(cartReducer, undefined, getInitialCart);

  // Persist cart to localStorage on change
  useEffect(() => {
    localStorage.setItem('cart-state-v1', JSON.stringify(state));
  }, [state]);

  const value = useMemo(() => ({ state, dispatch }), [state])
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart must be used within CartProvider')
  return ctx
}
