import React from 'react'
import { Navigate } from 'react-router-dom'
import { useDeliveryPartnerAuth } from '../context/DeliveryPartnerAuthContext'
import BrandLoadingOverlay from './BrandLoadingOverlay'

export default function DeliveryPartnerProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useDeliveryPartnerAuth()

  if (loading) return <BrandLoadingOverlay message="Verifying partner credentials…" />

  if (!isAuthenticated) {
    return <Navigate to="/delivery-login" replace />
  }

  return children
}
