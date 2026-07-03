import React, { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import BrandLoadingOverlay from './BrandLoadingOverlay'

export default function ProtectedRoute({ children }) {
  const [checking, setChecking] = useState(true)
  const [user, setUser] = useState(null)

  useEffect(() => {
    let mounted = true
    supabase.auth.getUser().then(({ data }) => {
      if (!mounted) return
      setUser(data.user ?? null)
      setChecking(false)
    })
    return () => { mounted = false }
  }, [])

  if (checking) return <BrandLoadingOverlay message="Authenticating…" />
  if (!user) return <Navigate to="/login" replace />
  return children
}
