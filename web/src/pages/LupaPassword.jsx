import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, ApiError } from '../lib/api.js'
import PasswordInput from '../components/PasswordInput.jsx'
import Banner from '../components/Banner.jsx'

/**
 * Lupa password (PRD Bab 10.4, 16.2) — halaman publik.
 * Alur: email → OTP (purpose lupa_password) → password baru.
 * Respons backend selalu generik — tidak membocorkan email terdaftar atau tidak.
 */
export default function LupaPassword() {
  const [fase, setFase] = useState('email') // email | kode
  const [email, setEmail] = useState('')
  const [kode, setKode] = useState('')
  const [passwordBaru, setPasswordBaru] = useState('')
  const [error, setError] = useState('')
  const [sukses, setSukses] = useState('')
  const [busy, setBusy] = useState(false)
  const [info, setInfo] = useState(null)

  useEffect(() => {
    document.title = 'Lupa Password | App InDeep Booking'
  }, [])

  async function mintaKode(event) {
    event.preventDefault()
    setError('')
    setSukses('')
    setBusy(true)
    try {
      const res = await api('/otp-request.php', {
        method: 'POST',
        body: JSON.stringify({ purpose: 'lupa_password', email }),
      })
      setInfo(res.data)
      setFase('kode')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Server sedang tidak bisa dihubungi. Coba lagi ya.')
    } finally {
      setBusy(false)
    }
  }

  async function reset(event) {
    event.preventDefault()
    setError('')
    setBusy(true)
    try {
      await api('/otp-verify.php', {
        method: 'POST',
        body: JSON.stringify({
          purpose: 'lupa_password',
          email,
          code: kode,
          newPassword: passwordBaru,
        }),
      })
      setSukses('Password baru sudah aktif. Silakan login ya.')
      setFase('email')
      setKode('')
      setPasswordBaru('')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal memverifikasi. Coba lagi ya.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-paper px-4">
      <section className="card w-full max-w-md p-6">
        <header className="mb-6">
          <p className="text-sm font-bold uppercase tracking-wide text-brand">InDeepCleaningID</p>
          <h1 className="text-2xl font-extrabold">Lupa Password</h1>
          <p className="mt-1 text-sm text-gray-600">
            Masukkan email akun kamu. Kami kirim kode 6 digit buat reset password.
          </p>
        </header>

        {error ? (
          <Banner variant="error" className="mb-4">
            {error}
          </Banner>
        ) : null}
        {sukses ? (
          <Banner variant="success" className="mb-4">
            {sukses}
          </Banner>
        ) : null}

        {fase === 'email' ? (
          <form onSubmit={mintaKode} noValidate>
            <div className="mb-4">
              <label htmlFor="email-lupa" className="mb-1 block text-sm font-bold">
                Email
              </label>
              <input
                id="email-lupa"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-brutal"
                placeholder="nama@email.com"
              />
            </div>
            <button type="submit" disabled={busy} className="btn btn-cta w-full py-3 text-base">
              {busy ? 'Mengirim…' : 'Kirim kode OTP'}
            </button>
          </form>
        ) : (
          <form onSubmit={reset} noValidate>
            {info ? (
              <p className="mb-3 text-sm text-gray-600">
                Kode dikirim ke <strong>{info.email_masked}</strong>, berlaku{' '}
                {Math.round(info.expires_in / 60)} menit.
                {info.dev_note ? (
                  <span className="mt-2 block rounded-xl border-2 border-amber-700 bg-amber-50 p-2 text-sm font-bold text-amber-900">
                    {info.dev_note}
                  </span>
                ) : null}
              </p>
            ) : null}
            <div className="mb-3">
              <label htmlFor="kode-lupa" className="mb-1 block text-sm font-bold">
                Kode 6 digit
              </label>
              <input
                id="kode-lupa"
                type="text"
                inputMode="numeric"
                pattern="\d{6}"
                maxLength={6}
                required
                value={kode}
                onChange={(e) => setKode(e.target.value.replace(/\D/g, ''))}
                className="input-brutal text-center text-lg font-extrabold tracking-widest"
              />
            </div>
            <div className="mb-5">
              <label htmlFor="pw-lupa" className="mb-1 block text-sm font-bold">
                Password baru
              </label>
              <PasswordInput
                id="pw-lupa"
                name="pw-lupa"
                minLength={8}
                required
                autoComplete="new-password"
                value={passwordBaru}
                onChange={(e) => setPasswordBaru(e.target.value)}
                className="input-brutal"
                placeholder="Minimal 8 karakter"
              />
            </div>
            <button type="submit" disabled={busy} className="btn btn-cta w-full py-3 text-base">
              {busy ? 'Memeriksa…' : 'Simpan password baru'}
            </button>
            <button
              type="button"
              onClick={() => setFase('email')}
              className="btn btn-ghost mt-2 w-full py-2"
            >
              Ganti email dulu
            </button>
          </form>
        )}

        <p className="mt-6 text-center text-sm text-gray-600">
          Ingat password lagi?{' '}
          <Link to="/login" className="font-bold text-brand underline">
            Masuk di sini
          </Link>
        </p>
      </section>
    </main>
  )
}
