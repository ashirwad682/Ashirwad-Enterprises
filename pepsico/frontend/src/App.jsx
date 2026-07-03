import Profile from './pages/Profile';
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { CartProvider } from './context/CartContext'
import { AdminAuthProvider } from './context/AdminAuthContext'
import { DeliveryPartnerAuthProvider } from './context/DeliveryPartnerAuthContext'
import { WarehouseAuthProvider } from './context/WarehouseAuthContext'
import Navbar from './components/Navbar'
import ScrollToTop from './components/ScrollToTop'
import { ThemeProvider } from './theme/ThemeContext'
import Footer from './components/Footer'
import PatrioticGlow from './components/PatrioticGlow'
import ProtectedRoute from './components/ProtectedRoute'
import AdminProtectedRoute from './components/AdminProtectedRoute'
import DeliveryPartnerProtectedRoute from './components/DeliveryPartnerProtectedRoute'
import WarehouseProtectedRoute from './components/WarehouseProtectedRoute'
import Landing from './pages/Landing'
import Login from './pages/Login'
import Register from './pages/Register'
import UserDashboard from './pages/UserDashboard'
import ResetPassword from './pages/ResetPassword'
import AdminLogin from './pages/AdminLogin'
import AdminDashboard from './pages/AdminDashboard'
import DeliveryPartnerLogin from './pages/DeliveryPartnerLogin'
import DeliveryPartnerDashboard from './pages/DeliveryPartnerDashboard'
import DeliveryPartnerResetPassword from './pages/DeliveryPartnerResetPassword'
import WarehouseLogin from './pages/WarehouseLogin'
import WarehouseDashboard from './pages/WarehouseDashboard'
import AboutPage from './pages/AboutPage'
import ContactPage from './pages/ContactPage'
import AuthDebug from './pages/AuthDebug'
import ManagerLogin from './pages/ManagerLogin'
import ManagerDashboard from './pages/ManagerDashboard'
import ManagerPasswordReset from './pages/ManagerPasswordReset'
import ManagerPersonalEmailVerify from './pages/ManagerPersonalEmailVerify'
import AccessDenied from './pages/AccessDenied'
import PrivacyPolicy from './pages/PrivacyPolicy'
import TermsConditions from './pages/TermsConditions'
import SupportTicket from './pages/SupportTicket'
import ChatAssistance from './pages/ChatAssistance'

function hasManagerSession() {
  return Boolean(localStorage.getItem('manager_token'))
}

export default function App() {
  const hasManagerAccess = hasManagerSession()

  return (
    <ThemeProvider>
      <AdminAuthProvider>
        <DeliveryPartnerAuthProvider>
          <WarehouseAuthProvider>
            <CartProvider>
              <BrowserRouter>
                <PatrioticGlow />
                <ScrollToTop />
                <Navbar />
                <Routes>
                  <Route path="/" element={<Landing />} />
                  <Route path="/about" element={<AboutPage />} />
                  <Route path="/contact" element={<ContactPage />} />
                  <Route path="/privacy-policy" element={<PrivacyPolicy />} />
                  <Route path="/terms-conditions" element={<TermsConditions />} />
                  <Route path="/support/ticket" element={<SupportTicket />} />
                  <Route path="/support/chat" element={<ChatAssistance />} />
                  <Route path="/auth-debug" element={<AuthDebug />} />
                  <Route path="/login" element={<Login />} />
                  <Route path="/register" element={<Register />} />
                  <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
                  <Route path="/reset-password" element={<ResetPassword />} />
                  <Route
                    path="/dashboard/*"
                    element={
                      <ProtectedRoute>
                        <UserDashboard />
                      </ProtectedRoute>
                    }
                  />
                  <Route path="/admin/login" element={<AdminLogin />} />
                  <Route path="/admin" element={<AdminLogin />} />
                  <Route
                    path="/admin/dashboard"
                    element={
                      <AdminProtectedRoute>
                        <AdminDashboard />
                      </AdminProtectedRoute>
                    }
                  />
                  <Route path="/delivery-login" element={<DeliveryPartnerLogin />} />
                  <Route path="/delivery-reset-password" element={<DeliveryPartnerResetPassword />} />
                  <Route
                    path="/delivery-dashboard"
                    element={
                      <DeliveryPartnerProtectedRoute>
                        <DeliveryPartnerDashboard />
                      </DeliveryPartnerProtectedRoute>
                    }
                  />
                  <Route
                    path="/delevery"
                    element={
                      <DeliveryPartnerProtectedRoute>
                        <DeliveryPartnerDashboard />
                      </DeliveryPartnerProtectedRoute>
                    }
                  />
                  <Route path="/warehouse-login" element={<WarehouseLogin />} />
                  <Route
                    path="/warehouse"
                    element={
                      <WarehouseProtectedRoute>
                        <WarehouseDashboard />
                      </WarehouseProtectedRoute>
                    }
                  />
                  <Route
                    path="/warehouse-dashboard"
                    element={
                      <WarehouseProtectedRoute>
                        <WarehouseDashboard />
                      </WarehouseProtectedRoute>
                    }
                  />
                  <Route path="/manager-login" element={<ManagerLogin />} />
                  <Route path="/manager-password-reset" element={<ManagerPasswordReset />} />
                  <Route path="/manager-personal-email-verify" element={<ManagerPersonalEmailVerify />} />
                  <Route path="/manager-dashboard" element={
                    hasManagerAccess
                      ? <ManagerDashboard />
                      : <AccessDenied />
                  } />
                </Routes>
                <Footer />
              </BrowserRouter>
            </CartProvider>
          </WarehouseAuthProvider>
        </DeliveryPartnerAuthProvider>
      </AdminAuthProvider>
    </ThemeProvider>
  )
}
