import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { api, ApiError } from '../lib/api.js'
import { useAuth } from '../lib/auth.jsx'
import PasswordInput from '../components/PasswordInput.jsx'
import Banner from '../components/Banner.jsx'

/**
 * Login customer (PRD Bab 10.1):
 * - Pintu utama Google OAuth (klik -> /api/google-login.php -> Google -> callback).
 * - Pintu kedua: email + password manual (issue #30) — buat customer yang
 *   sudah menyetel password lewat alur "Lupa password" (OTP).
 */
export default function Login() {
  const { user, refresh } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    document.title = 'Login | App InDeep Booking'
  }, [])

  // Hasil callback Google OAuth (?google=ok / cancelled / token_failed / dst)
  useEffect(() => {
    const g = searchParams.get('google')
    if (!g) return
    if (g === 'ok') {
      refresh() // session sudah dibuat callback — refresh akan arahkan ke booking/profil
    } else if (g === 'cancelled') {
      setError('Login Google dibatalkan. Coba lagi ya.')
    } else if (g === 'invalid_state') {
      setError('Sesi login Google kedaluwarsa. Coba lagi ya.')
    } else {
      setError('Login Google gagal. Coba lagi atau pakai email di bawah ya.')
    }
  }, [searchParams, refresh])

  useEffect(() => {
    if (user) {
      navigate(user.profile_complete ? '/booking' : '/lengkapi-profil', { replace: true })
    }
  }, [user, navigate])

  async function onSubmit(event) {
    event.preventDefault()
    setError('')
    setBusy(true)

    try {
      await api('/login.php', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      })
      await refresh()
      // refresh akan memicu useEffect di atas buat arahkan
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Server sedang tidak bisa dihubungi. Coba lagi ya.')
      setBusy(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-paper px-4">
      <section className="card w-full max-w-md p-6">
        <header className="mb-6">
          <p className="text-sm font-bold uppercase tracking-wide text-brand">InDeepCleaningID</p>
          <h1 className="text-2xl font-extrabold">Masuk Buat Booking</h1>
          <p className="mt-1 text-sm text-gray-600">
            Login biar alamat dan riwayat booking kamu tersimpan rapi.
          </p>
        </header>

        <a
          href={`${import.meta.env.BASE_URL}api/google-login.php`}
          className="mb-2 flex w-full items-center justify-center gap-2 rounded-xl border-2 border-ink bg-white px-4 py-3 text-base font-extrabold shadow-brutal-sm transition hover:translate-x-px hover:translate-y-px hover:shadow-[2px_2px_0_0_#000000]"
        >
          <svg aria-hidden="true" width="18" height="18" viewBox="0 0 48 48">
            <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.1 8 3l5.7-5.7C34.3 6.1 29.4 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.7-.4-3.9z"/>
            <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.1 8 3l5.7-5.7C34.3 6.1 29.4 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
            <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/>
            <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C41 35.5 44 30.2 44 24c0-1.3-.1-2.7-.4-3.9z"/>
          </svg>
          Lanjut dengan Google
        </a>
        <p className="mb-6 text-xs text-gray-500">
          Login Google memakai akun Gmail kamu — email dan nama otomatis terisi.
        </p>

        <hr className="mb-6 border-ink" />

        <form onSubmit={onSubmit} noValidate>
          <div className="mb-4">
            <label htmlFor="email" className="mb-1 block text-sm font-bold">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border-2 border-ink px-3 py-2 focus-visible:outline-none"
              placeholder="nama@email.com"
            />
          </div>

          <div className="mb-3">
            <label htmlFor="password" className="mb-1 block text-sm font-bold">
              Password
            </label>
            <PasswordInput
              id="password"
              name="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password kamu"
            />
          </div>

          <p className="mb-5 text-right text-sm text-gray-600">
            Lupa password?{' '}
            <Link to="/lupa-password" className="font-bold text-brand underline">
              Reset di sini
            </Link>
          </p>

          {error ? (
            <Banner variant="error" className="mb-4">
              {error}
            </Banner>
          ) : null}

          <button
            type="submit"
            disabled={busy}
            className="btn btn-cta w-full py-3 text-base"
          >
            {busy ? 'Memeriksa…' : 'Masuk'}
          </button>
        </form>
      </section>
    </main>
  )
}
