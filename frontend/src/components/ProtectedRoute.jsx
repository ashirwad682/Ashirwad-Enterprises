import React, { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import BrandLoadingOverlay from './BrandLoadingOverlay'

let cachedUser = null
let cachedSessionChecked = false

export default function ProtectedRoute({ children }) {
  const [checking, setChecking] = useState(!cachedSessionChecked)
  const [user, setUser] = useState(cachedUser)

  useEffect(() => {
    let mounted = true

    const verifyAuth = async () => {
      if (cachedSessionChecked) {
        setChecking(false)
        return
      }

      try {
        // Try getting session first - resolves instantly if cached and valid
        const { data: { session } } = await supabase.auth.getSession()
        if (mounted) {
          cachedUser = session?.user ?? null
          setUser(cachedUser)
          cachedSessionChecked = true
          setChecking(false)
        }
      } catch (err) {
        console.error('Error fetching session, falling back to getUser:', err)
        try {
          const { data: { user } } = await supabase.auth.getUser()
          if (mounted) {
            cachedUser = user
            setUser(user)
            cachedSessionChecked = true
            setChecking(false)
          }
        } catch (innerErr) {
          if (mounted) {
            cachedUser = null
            setUser(null)
            cachedSessionChecked = true
            setChecking(false)
          }
        }
      }
    }

    verifyAuth()

    // Also subscribe to changes to keep cachedUser / user updated in real-time
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      cachedUser = session?.user ?? null
      if (mounted) {
        setUser(cachedUser)
      }
      if (event === 'SIGNED_OUT') {
        localStorage.removeItem('user_profile')
      }
    })

    return () => {
      mounted = false
      subscription?.unsubscribe()
    }
  }, [])

  if (checking) return <BrandLoadingOverlay message="Authenticating…" />
  if (!user) return <Navigate to="/login" replace />
  return children
}

