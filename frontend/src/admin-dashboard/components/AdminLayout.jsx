import Sidebar from './Sidebar'
import Topbar from './Topbar'
import AllModals from './AllModals'
import DashboardPage from '../pages/DashboardPage'
import PlotsPage from '../pages/PlotsPage'
import ReservationsPage from '../pages/ReservationsPage'
import { UsersPage, MemorialsPage, ReportsPage, NotificationsPage, SettingsPage } from '../pages/OtherPages'
import { useAdmin } from '../context/AdminContext'
import { ENV } from '../config/constants'

const pages = {
  dashboard: DashboardPage,
  plots: PlotsPage,
  reservations: ReservationsPage,
  users: UsersPage,
  memorials: MemorialsPage,
  reports: ReportsPage,
  notifications: NotificationsPage,
  settings: SettingsPage,
}

export default function AdminLayout() {
  const { activePage, setActivePage, toast } = useAdmin()

  const PageComponent = pages[activePage] || DashboardPage

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar />
      <Topbar />

      <main className="admin-main" style={{
        marginLeft: 'var(--sidebar)',
        marginTop: 'var(--topbar)',
        padding: 28,
        minHeight: 'calc(100vh - var(--topbar))',
        flex: 1
      }}>
        <PageComponent onNavigate={setActivePage} />
      </main>

      <AllModals />

      {toast && (
        <div key={toast.id} className={`admin-toast ${toast.type}`} role="status" aria-live="polite">
          {toast.message}
        </div>
      )}
    </div>
  )
}