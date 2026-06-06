import React from 'react'
import { Navigate } from 'react-router-dom'
import BrandLoadingOverlay from './BrandLoadingOverlay'
import { useWarehouseAuth } from '../context/WarehouseAuthContext'

export default function WarehouseProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useWarehouseAuth()

  if (loading) return <BrandLoadingOverlay message="Verifying warehouse credentials…" />

  if (!isAuthenticated) {
    return <Navigate to="/warehouse-login" replace />
  }

  return children
}