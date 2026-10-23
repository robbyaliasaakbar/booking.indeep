import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './lib/auth.jsx'
import AdminRoute from './components/AdminRoute.jsx'
import CustomerLayout from './components/CustomerLayout.jsx'
import AdminLayout from './components/AdminLayout.jsx'

// --- Shell statis: layout + guard + auth selalu di bundle awal ---
// Halaman (pages) di-lazy supaya tiap route jadi chunk sendiri (issue #15):
// pengunjung Home gak lagi mengunduh seluruh route admin/booking sekaligus.

// Publik & customer
const Placeholder = lazy(() => import('./pages/Placeholder.jsx'))
const Home = lazy(() => import('./pages/Home.jsx'))
const Pricelist = lazy(() => import('./pages/Pricelist.jsx'))
const Login = lazy(() => import('./pages/Login.jsx'))
const Booking = lazy(() => import('./pages/Booking.jsx'))
const Riwayat = lazy(() => import('./pages/Riwayat.jsx'))
const RiwayatDetail = lazy(() => import('./pages/RiwayatDetail.jsx'))
const Struk = lazy(() => import('./pages/Struk.jsx'))
const Profil = lazy(() => import('./pages/Profil.jsx'))
const LengkapiProfil = lazy(() => import('./pages/LengkapiProfil.jsx'))
const LupaPassword = lazy(() => import('./pages/LupaPassword.jsx'))

// Admin
const AdminLogin = lazy(() => import('./pages/AdminLogin.jsx'))
const AdminDashboard = lazy(() => import('./pages/admin/Dashboard.jsx'))
const AdminBookings = lazy(() => import('./pages/admin/Bookings.jsx'))
const AdminSlots = lazy(() => import('./pages/admin/Slots.jsx'))
const AdminCustomers = lazy(() => import('./pages/admin/Customers.jsx'))
const AdminPricelist = lazy(() => import('./pages/admin/Pricelist.jsx'))
const AdminStruk = lazy(() => import('./pages/admin/Struk.jsx'))
const AdminReports = lazy(() => import('./pages/admin/Reports.jsx'))
const AdminLogs = lazy(() => import('./pages/admin/Logs.jsx'))

/** Fallback saat chunk route sedang diunduh (gaya selaras AdminRoute). */
function RouteFallback() {
  return (
    <main className="flex min-h-screen items-center justify-center">
      <p role="status" className="text-gray-600">
        Memuat…
      </p>
    </main>
  )
}

/**
 * Daftar rute lengkap sesuai PRD Bab 13.
 * - Customer/publik dibungkus CustomerLayout (header tipis + footer).
 * - Login customer & admin full screen sendiri.
 * - Rute admin dijaga AdminRoute + AdminLayout (sidebar).
 * Semua halaman di-lazy → tiap route jadi chunk terpisah (issue #15).
 */
export default function App() {
  return (
    <AuthProvider>
      {/* Basename buat deploy sub-path. Subdomain booking.indeepcleaningid.site: '/' */}
      <BrowserRouter basename={import.meta.env.VITE_BASENAME || '/'}>
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            {/* --- Publik & customer (ada layout) --- */}
            <Route element={<CustomerLayout />}>
              <Route path="/" element={<Home />} />
              <Route path="/pricelist" element={<Pricelist />} />
              <Route path="/lengkapi-profil" element={<LengkapiProfil />} />
              <Route path="/booking" element={<Booking />} />
              <Route path="/riwayat" element={<Riwayat />} />
              <Route path="/riwayat/:id" element={<RiwayatDetail />} />
              <Route path="/riwayat/:id/struk" element={<Struk />} />
              <Route path="/profil" element={<Profil />} />
            </Route>

            {/* --- Login (full screen) --- */}
            <Route path="/login" element={<Login />} />
            <Route path="/lupa-password" element={<LupaPassword />} />

            {/* --- Admin --- */}
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route element={<AdminRoute />}>
              <Route element={<AdminLayout />}>
                <Route path="/admin" element={<AdminDashboard />} />
                <Route path="/admin-bookings" element={<AdminBookings />} />
                <Route path="/admin-bookings/:id/struk" element={<AdminStruk />} />
                <Route path="/admin-slots" element={<AdminSlots />} />
                <Route path="/admin-customers" element={<AdminCustomers />} />
                <Route path="/admin-pricelist" element={<AdminPricelist />} />
                <Route path="/admin-reports" element={<AdminReports />} />
                <Route path="/admin-logs" element={<AdminLogs />} />
              </Route>
            </Route>

            {/* --- Rute tidak dikenal --- */}
            <Route
              path="*"
              element={<Placeholder title="Halaman Tidak Ditemukan" desc="Alamat yang kamu buka tidak ada. Kembali ke beranda." />}
            />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
  )
}
