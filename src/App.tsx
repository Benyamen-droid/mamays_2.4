import { useEffect, type ReactNode } from 'react'
import { HashRouter, MemoryRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AppProvider, useAuth } from './context/AppContext'
import type { Role } from './lib/types'
import { Loading } from './components/ui'
import { AuthChoice, ForgotPassword, Login, Register, Welcome } from './pages/auth/AuthPages'
import { ComensalHome, DishDetail, MamitaPublicPage } from './pages/comensal/Catalog'
import { CartPage, ConfirmedPage, PayPage } from './pages/comensal/Checkout'
import { ComensalProfile, MyOrders, OrderDetail } from './pages/comensal/Account'
import { NotificationsPage } from './pages/Notifications'
import { DishForm, MamitaHome, MamitaOrders, MamitaProfile, MamitaSales, MyDishes } from './pages/mamita/MamitaPages'
import { MamitaGuide, MamitaWelcome } from './pages/mamita/MamitaHelp'

/** Solo deja pasar a usuarios con sesión y el rol correcto */
function Guard({ role, children }: { role: Role; children: ReactNode }) {
  const { profile, loading } = useAuth()
  if (loading) return <Loading text="Abriendo tu espacio…" />
  if (!profile) return <Navigate to={`/acceso/${role}`} replace />
  if (profile.role !== role) return <Navigate to={profile.role === 'mamita' ? '/mamita' : '/comensal'} replace />
  return <>{children}</>
}

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])
  return null
}

function Root() {
  const { loading } = useAuth()
  if (loading) return <div className="grid min-h-full place-items-center bg-guinda"><Loading text="" /></div>
  return (
    <>
    <ScrollToTop />
    <Routes>
      <Route path="/" element={<Welcome />} />
      <Route path="/acceso/:rol" element={<AuthChoice />} />
      <Route path="/ingresar/:rol" element={<Login />} />
      <Route path="/registro/:rol" element={<Register />} />
      <Route path="/recuperar" element={<ForgotPassword />} />

      <Route path="/comensal" element={<Guard role="comensal"><ComensalHome /></Guard>} />
      <Route path="/comensal/plato/:id" element={<Guard role="comensal"><DishDetail /></Guard>} />
      <Route path="/comensal/mamita/:id" element={<Guard role="comensal"><MamitaPublicPage /></Guard>} />
      <Route path="/comensal/carrito" element={<Guard role="comensal"><CartPage /></Guard>} />
      <Route path="/comensal/pago/:id" element={<Guard role="comensal"><PayPage /></Guard>} />
      <Route path="/comensal/confirmado/:id" element={<Guard role="comensal"><ConfirmedPage /></Guard>} />
      <Route path="/comensal/pedidos" element={<Guard role="comensal"><MyOrders /></Guard>} />
      <Route path="/comensal/pedidos/:id" element={<Guard role="comensal"><OrderDetail /></Guard>} />
      <Route path="/comensal/avisos" element={<Guard role="comensal"><NotificationsPage /></Guard>} />
      <Route path="/comensal/perfil" element={<Guard role="comensal"><ComensalProfile /></Guard>} />

      <Route path="/mamita" element={<Guard role="mamita"><MamitaHome /></Guard>} />
      <Route path="/mamita/platos" element={<Guard role="mamita"><MyDishes /></Guard>} />
      <Route path="/mamita/platos/nuevo" element={<Guard role="mamita"><DishForm /></Guard>} />
      <Route path="/mamita/platos/:id" element={<Guard role="mamita"><DishForm /></Guard>} />
      <Route path="/mamita/pedidos" element={<Guard role="mamita"><MamitaOrders /></Guard>} />
      <Route path="/mamita/ventas" element={<Guard role="mamita"><MamitaSales /></Guard>} />
      <Route path="/mamita/perfil" element={<Guard role="mamita"><MamitaProfile /></Guard>} />
      <Route path="/mamita/avisos" element={<Guard role="mamita"><NotificationsPage /></Guard>} />
      <Route path="/mamita/bienvenida" element={<Guard role="mamita"><MamitaWelcome /></Guard>} />
      <Route path="/mamita/guia" element={<Guard role="mamita"><MamitaGuide /></Guard>} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </>
  )
}

// En la demo embebida (una sola página) la navegación vive en memoria
const Router = import.meta.env.VITE_MEMORY_ROUTER ? MemoryRouter : HashRouter

export default function App() {
  return (
    <Router>
      <AppProvider>
        <div className="app-shell"><Root /></div>
      </AppProvider>
    </Router>
  )
}
