import React, { createContext, useContext, useEffect, useState } from 'react'

const API_BASE = import.meta.env.VITE_API_BASE 
  ? import.meta.env.VITE_API_BASE.replace(/\/$/, '') 
  : (import.meta.env.PROD ? 'https://pepsico-backend.vercel.app' : 'http://localhost:5001')
const WarehouseAuthContext = createContext()

export const useWarehouseAuth = () => {
  const context = useContext(WarehouseAuthContext)
  if (!context) {
    throw new Error('useWarehouseAuth must be used within WarehouseAuthProvider')
  }
  return context
}

export const WarehouseAuthProvider = ({ children }) => {
  const [warehouse, setWarehouse] = useState(null)
  const [authToken, setAuthToken] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    checkWarehouseAuth()
  }, [])

  const clearStoredAuth = () => {
    localStorage.removeItem('warehouse_id')
    localStorage.removeItem('warehouse_auth_token')
  }

  const checkWarehouseAuth = async () => {
    try {
      const warehouseId = localStorage.getItem('warehouse_id')
      const token = localStorage.getItem('warehouse_auth_token')

      if (!warehouseId || !token) {
        setWarehouse(null)
        setAuthToken('')
        return
      }

      const res = await fetch(`${API_BASE}/api/warehouse/me`, {
        headers: {
          'x-warehouse-id': warehouseId,
          'x-warehouse-auth': token
        }
      })

      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.success || !data.warehouse) {
        throw new Error(data.error || 'Warehouse session expired')
      }

      setWarehouse(data.warehouse)
      setAuthToken(token)
    } catch (err) {
      console.error('Warehouse auth check failed:', err)
      clearStoredAuth()
      setWarehouse(null)
      setAuthToken('')
    } finally {
      setLoading(false)
    }
  }

  const login = async (username, password) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API_BASE}/api/warehouse/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      })

      const data = await res.json().catch(() => ({}))

      if (data.requiresPasswordSetup) {
        return {
          success: false,
          requiresPasswordSetup: true,
          warehouse: data.warehouse,
          message: data.message || 'Set a password to activate this warehouse portal.'
        }
      }

      if (!res.ok || !data.success || !data.warehouse || !data.token) {
        throw new Error(data.error || 'Warehouse login failed')
      }

      localStorage.setItem('warehouse_id', data.warehouse.id)
      localStorage.setItem('warehouse_auth_token', data.token)
      setWarehouse(data.warehouse)
      setAuthToken(data.token)

      return { success: true, warehouse: data.warehouse }
    } catch (err) {
      setError(err.message)
      return { success: false, error: err.message }
    } finally {
      setLoading(false)
    }
  }

  const setupPassword = async (warehouseId, password) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API_BASE}/api/warehouse/setup-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ warehouseId, password })
      })

      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.success || !data.warehouse || !data.token) {
        throw new Error(data.error || 'Failed to set warehouse password')
      }

      localStorage.setItem('warehouse_id', data.warehouse.id)
      localStorage.setItem('warehouse_auth_token', data.token)
      setWarehouse(data.warehouse)
      setAuthToken(data.token)

      return { success: true, warehouse: data.warehouse }
    } catch (err) {
      setError(err.message)
      return { success: false, error: err.message }
    } finally {
      setLoading(false)
    }
  }

  const logout = () => {
    clearStoredAuth()
    setWarehouse(null)
    setAuthToken('')
    setError(null)
  }

  return (
    <WarehouseAuthContext.Provider
      value={{
        warehouse,
        authToken,
        loading,
        error,
        login,
        setupPassword,
        logout,
        isAuthenticated: Boolean(warehouse && authToken)
      }}
    >
      {children}
    </WarehouseAuthContext.Provider>
  )
}