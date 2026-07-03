import React, { createContext, useContext, useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'

const API_BASE = import.meta.env.VITE_API_BASE
  ? import.meta.env.VITE_API_BASE.replace(/\/$/, '')
  : (import.meta.env.PROD ? 'https://pepsico-backend.vercel.app' : 'http://localhost:5001');

const DeliveryPartnerAuthContext = createContext()

export const useDeliveryPartnerAuth = () => {
  const context = useContext(DeliveryPartnerAuthContext)
  if (!context) {
    throw new Error('useDeliveryPartnerAuth must be used within DeliveryPartnerAuthProvider')
  }
  return context
}

export const DeliveryPartnerAuthProvider = ({ children }) => {
  const [deliveryPartner, setDeliveryPartner] = useState(() => {
    const dpId = String(localStorage.getItem('delivery_partner_id') || '').trim()
    if (dpId) {
      return {
        id: dpId,
        name: localStorage.getItem('delivery_partner_name') || 'Partner',
        assigned_area: localStorage.getItem('delivery_partner_assigned_area') || '',
        delivery_partner_id: localStorage.getItem('delivery_partner_display_id') || ''
      }
    }
    return null
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const login = async (email, password) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API_BASE}/api/delivery/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      })

      const contentType = res.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error("Backend connection failed. Cannot connect to backend.");
      }

      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Login failed')
      }
      // Only allow active partners
      if (data.deliveryPartner && data.deliveryPartner.status && data.deliveryPartner.status !== 'active') {
        throw new Error('Account inactive. Contact admin.')
      }
      localStorage.setItem('delivery_partner_id', data.deliveryPartner.id)
      localStorage.setItem('delivery_partner_name', data.deliveryPartner.name || '')
      localStorage.setItem('delivery_partner_assigned_area', data.deliveryPartner.assigned_area || '')
      localStorage.setItem('delivery_partner_display_id', data.deliveryPartner.delivery_partner_id || '')
      setDeliveryPartner(data.deliveryPartner)
      return { success: true }
    } catch (err) {
      console.error(err);
      const errorMsg = err.message === 'Failed to fetch' ? 'Network error: Cannot connect to backend.' : err.message;
      setError(errorMsg)
      return { success: false, error: errorMsg }
    } finally {
      setLoading(false)
    }
  }

  const logout = () => {
    localStorage.removeItem('delivery_partner_id')
    localStorage.removeItem('delivery_partner_name')
    localStorage.removeItem('delivery_partner_assigned_area')
    localStorage.removeItem('delivery_partner_display_id')
    setDeliveryPartner(null)
  }

  // Removed verifyPassword; password is now checked by backend only

  return (
    <DeliveryPartnerAuthContext.Provider
      value={{
        deliveryPartner,
        loading,
        error,
        login,
        logout,
        isAuthenticated: !!deliveryPartner
      }}
    >
      {children}
    </DeliveryPartnerAuthContext.Provider>
  )
}
