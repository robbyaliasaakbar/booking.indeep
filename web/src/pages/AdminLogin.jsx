import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, ApiError } from '../lib/api.js'
import { useAuth } from '../lib/auth.jsx'
import PasswordInput from '../components/PasswordInput.jsx'
import Banner from '../components/Banner.jsx'

/**
 * Login admin khusus username + password, tanpa email (PRD Bab 10.2).
 * Halaman terpisah dari login customer.
 */
export default function AdminLogin() {
  const { user, refresh } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    document.title = 'Login Admin | App InDeep Booking'
  }, [])

  useEffect(() => {
    if (user && (user.role === 'admin' || user.role === 'superadmin')) {
      navigate('/admin', { replace: true })
    }
  }, [user, navigate])

  async function onSubmit(event) {
    event.preventDefault()
    setError('')
    setBusy(true)

    try {
      await api('/admin-login.php', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      })
      await refresh()
      navigate('/admin', { replace: true })
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
          <h1 className="text-2xl font-extrabold">Login Admin</h1>
          <p className="mt-1 text-sm text-gray-600">Khusus tim operasional. Customer login lewat halaman lain ya.</p>
        </header>

        <form onSubmit={onSubmit} noValidate>
          <div className="mb-4">
            <label htmlFor="username" className="mb-1 block text-sm font-bold">
              Username
            </label>
            <input
              id="username"
              name="username"
              type="text"
              autoComplete="username"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full rounded-xl border-2 border-ink px-3 py-2 focus-visible:outline-none"
              placeholder="admin indeep"
            />
          </div>

          <div className="mb-5">
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
              placeholder="••••••••"
            />
          </div>

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
