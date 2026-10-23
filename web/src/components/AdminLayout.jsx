import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth.jsx'

/**
 * Layout admin: sidebar kiri + topbar (PRD Bab 13).
 * Mobile: sidebar jadi drawer slide dari kiri (hamburger di topbar) — Bang Rob.
 * Desktop (lg:): sidebar tampil permanen seperti biasa.
 */

const NAV_ITEMS = [
  { to: '/admin', label: 'Dashboard', end: true },
  { to: '/admin-bookings', label: 'Booking' },
  { to: '/admin-slots', label: 'Slot' },
  { to: '/admin-customers', label: 'Customer' },
  { to: '/admin-pricelist', label: 'Pricelist' },
  { to: '/admin-reports', label: 'Laporan' },
  { to: '/admin-logs', label: 'Log' },
]

export default function AdminLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // tutup drawer tiap pindah halaman
  useEffect(() => {
    setSidebarOpen(false)
  }, [location.pathname])

  async function onLogout() {
    await logout()
    navigate('/admin/login', { replace: true })
  }

  const linkClass = ({ isActive }) =>
    [
      'flex items-center gap-2 rounded-xl border-2 px-3 py-2 text-sm font-bold transition',
      isActive
        ? 'border-ink bg-brand text-white shadow-brutal-sm'
        : 'border-transparent hover:border-ink hover:bg-paper',
    ].join(' ')

  return (
    <div className="flex min-h-screen bg-paper text-ink">
      {/* Backdrop (mobile only) */}
      {sidebarOpen ? (
        <div
          aria-hidden="true"
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      ) : null}

      {/* Sidebar: drawer slide di mobile, permanen di lg+ */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r-2 border-ink bg-white transition-transform duration-300 lg:static lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="border-b-2 border-ink p-4">
          <img
            src={`${import.meta.env.BASE_URL}brand/Logo.webp`}
            alt="Logo InDeepCleaningID"
            className="h-10 w-auto"
          />
          <p className="mt-2 text-xs font-bold uppercase tracking-wide text-brand">
            Panel Admin
          </p>
        </div>

        <nav aria-label="Navigasi admin" className="flex flex-1 flex-col gap-1 overflow-y-auto p-2">
          {NAV_ITEMS.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className={linkClass} title={item.label}>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t-2 border-ink p-2">
          <button type="button" onClick={onLogout} className="btn btn-ghost w-full justify-center text-sm">
            Keluar
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-3 border-b-2 border-ink bg-white px-4 py-3">
          <div className="flex min-w-0 items-center gap-3">
            {/* Tombol hamburger (mobile only) */}
            <button
              type="button"
              aria-label={sidebarOpen ? 'Tutup menu' : 'Buka menu'}
              aria-expanded={sidebarOpen}
              onClick={() => setSidebarOpen((v) => !v)}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border-2 border-ink bg-white shadow-brutal-sm transition hover:translate-x-px hover:translate-y-px lg:hidden"
            >
              {sidebarOpen ? (
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden="true">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden="true">
                  <path d="M4 7h16M4 12h16M4 17h16" />
                </svg>
              )}
            </button>
            <h1 className="truncate text-base font-extrabold sm:text-lg">Panel Admin InDeep</h1>
          </div>
          <p className="shrink-0 text-sm font-bold text-gray-600">
            {user?.name}
            {user?.role === 'superadmin' ? (
              <span className="ml-2 rounded-full border-2 border-ink bg-cta px-2 py-0.5 text-xs">Super</span>
            ) : null}
          </p>
        </header>

        <main className="flex-1 p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
