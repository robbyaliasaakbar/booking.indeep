import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth.jsx'

/**
 * Layout customer: header tipis + footer ringkas (PRD Bab 13).
 * Mobile first: nav jadi hamburger menu (Bang Rob, sesi responsiveness).
 */
export default function CustomerLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)

  // tutup menu tiap pindah halaman
  useEffect(() => {
    setMenuOpen(false)
  }, [location.pathname])

  async function onLogout() {
    setMenuOpen(false)
    await logout()
    navigate('/login', { replace: true })
  }

  const linkClass = ({ isActive }) =>
    [
      'block rounded-full border-2 px-4 py-2 text-left font-bold transition',
      isActive ? 'border-ink bg-brand text-white' : 'border-transparent hover:border-ink',
    ].join(' ')

  const linkDesktop = ({ isActive }) =>
    [
      'rounded-full border-2 px-3 py-1 font-bold transition',
      isActive ? 'border-ink bg-brand text-white' : 'border-transparent hover:border-ink',
    ].join(' ')

  return (
    <div className="flex min-h-screen flex-col bg-paper text-ink">
      {/* print:hidden — navbar/footer gak boleh ikut tercetak di struk PDF */}
      <header className="sticky top-0 z-20 border-b-2 border-ink bg-white print:hidden">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <Link to="/" className="flex items-center">
            {/* h-10 di mobile: biar logo text gak gepeng/kekecilan di layar sempit */}
            <img
              src={`${import.meta.env.BASE_URL}brand/logo+logo-text.webp`}
              alt="InDeepCleaningID"
              className="h-10 w-auto sm:h-8"
            />
          </Link>

          {/* --- Desktop: nav inline --- */}
          <nav aria-label="Navigasi utama" className="hidden items-center gap-2 text-sm sm:flex">
            <NavLink to="/pricelist" className={linkDesktop}>
              Pricelist
            </NavLink>
            {user ? (
              <>
                <NavLink to="/riwayat" className={linkDesktop}>
                  Riwayat
                </NavLink>
                <NavLink to="/profil" className={linkDesktop}>
                  Profil
                </NavLink>
                <button
                  type="button"
                  onClick={onLogout}
                  className="rounded-full border-2 border-transparent px-3 py-1 font-bold transition hover:border-ink hover:text-red-600"
                >
                  Logout
                </button>
              </>
            ) : (
              <NavLink to="/login" className="btn btn-cta px-3 py-1 text-sm">
                Login
              </NavLink>
            )}
          </nav>

          {/* --- Mobile: tombol hamburger --- */}
          <button
            type="button"
            aria-label={menuOpen ? 'Tutup menu' : 'Buka menu'}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
            className="flex h-10 w-10 items-center justify-center rounded-xl border-2 border-ink bg-white shadow-brutal-sm transition hover:translate-x-px hover:translate-y-px sm:hidden"
          >
            {menuOpen ? (
              /* ikon X */
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            ) : (
              /* ikon hamburger */
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden="true">
                <path d="M4 7h16M4 12h16M4 17h16" />
              </svg>
            )}
          </button>
        </div>

        {/* --- Panel dropdown hamburger (mobile only) --- */}
        {menuOpen ? (
          <nav aria-label="Menu mobile" className="border-t-2 border-ink bg-white px-4 py-3 sm:hidden">
            <div className="flex flex-col gap-1">
              <NavLink to="/pricelist" className={linkClass}>
                Pricelist
              </NavLink>
              {user ? (
                <>
                  <NavLink to="/riwayat" className={linkClass}>
                    Riwayat
                  </NavLink>
                  <NavLink to="/profil" className={linkClass}>
                    Profil
                  </NavLink>
                  <button
                    type="button"
                    onClick={onLogout}
                    className="block rounded-full border-2 border-transparent px-4 py-2 text-left font-bold transition hover:border-ink hover:text-red-600"
                  >
                    Logout
                  </button>
                </>
              ) : (
                <NavLink to="/login" className="btn btn-cta block px-4 py-2 text-left text-sm">
                  Login
                </NavLink>
              )}
            </div>
          </nav>
        ) : null}
      </header>

      <Outlet />

      <footer className="mt-auto border-t-2 border-ink bg-white px-6 py-6 text-center text-sm text-gray-600 print:hidden sm:px-4 sm:py-4">
        <p>© 2026 InDeepCleaningID — hak cipta dilindungi.</p>
        <p className="mt-1.5">Jasa cuci sofa, kasur, karpet, gordyn, dan interior mobil.</p>
        <p className="mt-1.5">Booking online — admin kami konfirmasi via WhatsApp.</p>
      </footer>
    </div>
  )
}
