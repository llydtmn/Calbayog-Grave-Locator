import './App.css'
import { AdminProvider, useAdmin } from './context/AdminContext'
import LoginScreen from './components/LoginScreen'
import AdminLayout from './components/AdminLayout'

function Root() {
  const { isAuthenticated, authLoading } = useAdmin()
  // Wait for the saved session to be restored instead of flashing the login screen.
  if (authLoading) {
    return (
      <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--cream)', color: 'var(--sage)', fontSize: 14, fontWeight: 600 }}>
        Restoring your session…
      </div>
    )
  }
  return isAuthenticated ? <AdminLayout /> : <LoginScreen />
}

export default function App() {
  return (
    <AdminProvider>
      <Root />
    </AdminProvider>
  )
}