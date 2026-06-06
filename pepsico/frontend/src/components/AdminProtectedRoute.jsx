import React from 'react'
import { Navigate } from 'react-router-dom'
import { useAdminAuth } from '../context/AdminAuthContext'
import BrandLoadingOverlay from './BrandLoadingOverlay'

export default function AdminProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAdminAuth()

  if (loading) return <BrandLoadingOverlay message="Checking admin access…" />
  if (!isAuthenticated) return <Navigate to="/admin/login" replace />
  return children
}
