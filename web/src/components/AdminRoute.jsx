import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../lib/auth.jsx'

/**
 * Guard semua halaman admin (PRD Bab 4.3 dan 4.4).
 * Belum login atau role bukan admin/superadmin -> lempar ke /admin/login.
 * Dipakai sebagai layout route: <Route element={<AdminRoute />}>...</Route>
 */
export default function AdminRoute() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p role="status" className="text-gray-600">
          Memuat…
        </p>
      </main>
    )
  }

  if (!user || (user.role !== 'admin' && user.role !== 'superadmin')) {
    return <Navigate to="/admin/login" replace />
  }

  return <Outlet />
}
