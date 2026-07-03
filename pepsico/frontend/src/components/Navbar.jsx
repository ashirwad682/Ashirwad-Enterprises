import React, { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { supabase } from '../lib/supabaseClient'
import BrandVideoLogo from './BrandVideoLogo'
import LogoColorSync from './LogoColorSync'
import { useMediaQuery } from '../lib/useMediaQuery'

const NAV_LINKS = [
  { to: '/', label: 'Home' },
  { to: '/about', label: 'About' },
  { to: '/contact', label: 'Contact' },
  { to: '/dashboard', label: 'Dashboard' }
]

const MENU_ID = 'primary-navigation'

export default function Navbar() {
  // Use the static logo image for color extraction
  const logoPoster = '/images/logo.png';
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [profileData, setProfileData] = useState(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [profileMenuOpen, setProfileMenuOpen] = useState(false)
  const isMobile = useMediaQuery('(max-width: 768px)')
  const profileMenuRef = useRef(null)

  useEffect(() => {
    let mounted = true
    supabase.auth.getUser().then(({ data }) => {
      if (!mounted) return
      setUser(data?.user || null)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        setUser(session?.user || null)
      }
      if (event === 'SIGNED_OUT') {
        setUser(null)
      }
    })

    return () => {
      mounted = false
      listener?.subscription?.unsubscribe()
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    async function loadProfileData() {
      if (!user?.id) {
        setProfileData(null)
        return
      }

      try {
        const { data, error } = await supabase
          .from('users')
          .select('full_name, profile_photo_url')
          .eq('id', user.id)
          .maybeSingle()

        if (error) {
          throw error
        }

        if (!cancelled) {
          setProfileData(data || null)
        }
      } catch (err) {
        if (!cancelled) {
          setProfileData(null)
        }
        console.warn('Failed to load navbar profile data:', err)
      }
    }

    loadProfileData()

    return () => {
      cancelled = true
    }
  }, [user?.id, pathname])

  useEffect(() => {
    if (!isMobile) {
      setMenuOpen(false)
    }
  }, [isMobile])

  useEffect(() => {
    setMenuOpen(false)
    setProfileMenuOpen(false)
  }, [pathname])

  useEffect(() => {
    if (!profileMenuOpen) return

    const handleClickOutside = (event) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target)) {
        setProfileMenuOpen(false)
      }
    }

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setProfileMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [profileMenuOpen])

  const handleProfileNavigate = () => {
    setProfileMenuOpen(false)
    setMenuOpen(false)
    navigate('/dashboard/profile')
  }

  const handleLogout = async () => {
    setProfileMenuOpen(false)
    setMenuOpen(false)
    try {
      await supabase.auth.signOut()
      navigate('/login', { replace: true })
    } catch (err) {
      console.error('Failed to sign out', err)
    }
  }

  const hideNavbar = pathname.startsWith('/admin/dashboard')
    || pathname.startsWith('/delivery-dashboard')
    || pathname.startsWith('/delevery')
    || pathname.startsWith('/manager-dashboard')
    || pathname.startsWith('/warehouse-dashboard')
    || pathname === '/warehouse'
    || pathname === '/warehouse-login'
    || pathname === '/login'
    || pathname === '/delivery-login'
    || pathname === '/register'
    || pathname === '/manager-login'
    || pathname === '/ManagerPasswordReset'

  if (hideNavbar) return null;

  const displayName = profileData?.full_name || user?.user_metadata?.full_name || 'User'
  const profilePhotoUrl = profileData?.profile_photo_url || ''
  const profileInitial = (displayName || user?.email || 'U').charAt(0).toUpperCase()

  return (
    <header className="site-header">
      {/* Sync theme with logo */}
      <LogoColorSync logoUrl={logoPoster} />
      <div className="site-header__inner">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <Link to="/" className="site-header__brand">
            <BrandVideoLogo size={60} style={{ borderRadius: 16, boxShadow: '0 18px 40px rgba(10,29,83,0.18)' }} />
            <div className="site-header__brand-text">
              <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--brand-saffron)', letterSpacing: 0.5 }}>ASHIRWAD</div>
              <div style={{ fontWeight: 700, fontSize: 11, letterSpacing: 2.5, textTransform: 'uppercase', lineHeight: 1.1, opacity: 0.92 ,color: 'var(--brand-saffron)'}}>ENTERPRISES</div>

              {/* Diamond divider — matches logo style */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, margin: '3px 0' }}>
                    <div style={{ flex: 1, height: 1, background: 'var(--brand-saffron)' }} />
                    <span style={{ fontSize: 7, lineHeight: 1, color: 'var(--brand-saffron)' }}>◆</span>
                    <div style={{ flex: 1, height: 1, background: 'var(--brand-saffron)' }} />
                  </div>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.2, color: 'var(--text-muted)', textTransform: 'uppercase' }}>PepsiCo Distributor</div>
            </div>
          </Link>
        </motion.div>

        {isMobile && (
          <button
            type="button"
            className="site-header__toggle"
            aria-expanded={menuOpen}
            aria-controls={MENU_ID}
            onClick={() => setMenuOpen((prev) => !prev)}
          >
            <span className="sr-only">Toggle navigation</span>
            {menuOpen ? 'Close' : 'Menu'}
          </button>
        )}

        <AnimatePresence>
          {(!isMobile || menuOpen) && (
            <motion.div
              key="primary-menu"
              id={MENU_ID}
              className="site-header__menu"
              initial={isMobile ? { opacity: 0, y: -12 } : false}
              animate={isMobile ? { opacity: 1, y: 0 } : false}
              exit={isMobile ? { opacity: 0, y: -12 } : undefined}
              transition={{ duration: 0.2 }}
            >
              <nav className="site-nav">
                <div className="site-nav__list">
                  {NAV_LINKS.map((link) => (
                    <NavItem
                      key={link.to}
                      to={link.to}
                      isActive={isRouteActive(pathname, link.to)}
                      onNavigate={isMobile ? () => setMenuOpen(false) : undefined}
                    >
                      {link.label}
                    </NavItem>
                  ))}

                  {!user && (
                    <NavItem
                      to="/login"
                      isActive={isRouteActive(pathname, '/login')}
                      onNavigate={isMobile ? () => setMenuOpen(false) : undefined}
                    >
                      Login
                    </NavItem>
                  )}
                </div>

                {!user ? (
                  <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} className="site-nav__cta">
                    <Link
                      to="/register"
                      className="btn"
                      style={{
                        padding: '10px 24px',
                        fontSize: 14,
                        background: 'linear-gradient(135deg, var(--brand-saffron) 0%, var(--brand-amber) 100%)',
                        boxShadow: '0 14px 32px rgba(255,103,31,0.24)'
                      }}
                      onClick={isMobile ? () => setMenuOpen(false) : undefined}
                    >
                      Get Started
                    </Link>
                  </motion.div>
                ) : (
                  <motion.div
                    ref={profileMenuRef}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="site-header__profile"
                    style={{ position: 'relative' }}
                  >
                    <button
                      type="button"
                      onClick={() => setProfileMenuOpen((prev) => !prev)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: '8px 12px',
                        borderRadius: 12,
                        border: '1px solid #e2e8f0',
                        background: profileMenuOpen ? '#eef2ff' : '#f8fafc',
                        cursor: 'pointer'
                      }}
                    >
                      <div
                        className="site-header__profile-initial"
                        style={profilePhotoUrl ? { background: `url(${profilePhotoUrl}) center/cover no-repeat` } : undefined}
                      >
                        {!profilePhotoUrl ? profileInitial : null}
                      </div>
                      <div className="site-header__profile-meta">
                        <span style={{ fontWeight: 700, fontSize: 14, color: '#0f172a' }}>{displayName}</span>
                        <span style={{ fontSize: 12, color: '#64748b' }}>{truncateEmail(user.email)}</span>
                      </div>
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 20 20"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        style={{ transform: profileMenuOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease' }}
                      >
                        <path d="M5 7l5 6 5-6" stroke="#1f2937" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                    {profileMenuOpen && (
                      <div
                        style={{
                          position: 'absolute',
                          top: 'calc(100% + 8px)',
                          right: 0,
                          background: '#fff',
                          borderRadius: 12,
                          border: '1px solid #e2e8f0',
                          boxShadow: '0 12px 30px rgba(15,23,42,0.12)',
                          padding: '8px 0',
                          minWidth: 200,
                          zIndex: 40
                        }}
                      >
                        <button
                          type="button"
                          onClick={handleProfileNavigate}
                          style={{
                            width: '100%',
                            textAlign: 'left',
                            padding: '10px 16px',
                            background: 'transparent',
                            border: 'none',
                            fontSize: 13,
                            fontWeight: 600,
                            color: '#1f2937',
                            cursor: 'pointer'
                          }}
                        >
                          View profile
                        </button>
                        <button
                          type="button"
                          onClick={handleLogout}
                          style={{
                            width: '100%',
                            textAlign: 'left',
                            padding: '10px 16px',
                            background: 'transparent',
                            border: 'none',
                            fontSize: 13,
                            fontWeight: 600,
                            color: '#b91c1c',
                            cursor: 'pointer'
                          }}
                        >
                          Sign out
                        </button>
                      </div>
                    )}
                  </motion.div>
                )}
              </nav>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </header>
  )
}

function NavItem({ to, children, isActive, onNavigate, special }) {
  return (
    <motion.div whileHover={{ y: -2 }} whileTap={{ scale: 0.95 }}>
      <Link
        to={to}
        onClick={onNavigate}
        className={classNames('site-nav__link', special && 'site-nav__link--special', isActive && 'site-nav__link--active')}
      >
        {children}
      </Link>
    </motion.div>
  )
}

function isRouteActive(currentPath, targetPath) {
  if (targetPath === '/') {
    return currentPath === '/'
  }
  return currentPath.startsWith(targetPath)
}

function truncateEmail(value) {
  if (!value) return ''
  if (value.length <= 22) return value
  const [local, domain = ''] = value.split('@')
  return `${local.slice(0, 10)}…@${domain}`
}

function classNames(...values) {
  return values.filter(Boolean).join(' ')
}
