import React, { createContext, useContext, useState, useEffect } from 'react'

export const AdminAuthContext = createContext(null)

const STORAGE_KEY = 'admin_access_key'

export function AdminAuthProvider({ children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [adminKey, setAdminKey] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const storedKey = sessionStorage.getItem(STORAGE_KEY)
    if (storedKey) {
      setAdminKey(storedKey)
      setIsAuthenticated(true)
    }
    setLoading(false)
  }, [])

  const login = (key) => {
    const trimmed = (key || '').trim()
    if (trimmed.length < 12) {
      return false
    }
    setAdminKey(trimmed)
    setIsAuthenticated(true)
    sessionStorage.setItem(STORAGE_KEY, trimmed)
    return true
  }

  const logout = () => {
    setIsAuthenticated(false)
    setAdminKey('')
    sessionStorage.removeItem(STORAGE_KEY)
  }

  return (
    <AdminAuthContext.Provider value={{ isAuthenticated, loading, login, logout, adminKey }}>
      {children}
    </AdminAuthContext.Provider>
  )
}

export function useAdminAuth() {
  const ctx = useContext(AdminAuthContext)
  if (!ctx) throw new Error('useAdminAuth must be used within AdminAuthProvider')
  return ctx
}
