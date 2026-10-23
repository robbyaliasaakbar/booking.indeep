/**
 * GantiPassword — panel ganti password via OTP email (issue #7 Batch 3).
 * Dipisah dari Profil.jsx. Terima `onError`/`onSuccess` untuk banner halaman
 * (pesan sukses tetap lokal karena alur 2 fase).
 */

import { useState } from 'react'
import { api, ApiError } from '../../lib/api.js'
import PasswordInput from '../PasswordInput.jsx'
import Banner from '../Banner.jsx'

export default function GantiPassword({ email }) {
  const [fase, setFase] = useState('mintakode') // mintakode | isikode
  const [kode, setKode] = useState('')
  const [passwordBaru, setPasswordBaru] = useState('')
  const [error, setError] = useState('')
  const [sukses, setSukses] = useState('')
  const [busy, setBusy] = useState(false)
  const [info, setInfo] = useState(null)

  async function mintaKode() {
    setError('')
    setSukses('')
    setBusy(true)
    try {
      const res = await api('/otp-request.php', {
        method: 'POST',
        body: JSON.stringify({ purpose: 'ganti_password' }),
      })
      setInfo(res.data)
      setFase('isikode')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal minta kode. Coba lagi ya.')
    } finally {
      setBusy(false)
    }
  }

  async function verifikasi(event) {
    event.preventDefault()
    setError('')
    setBusy(true)
    try {
      await api('/otp-verify.php', {
        method: 'POST',
        body: JSON.stringify({
          purpose: 'ganti_password',
          code: kode,
          newPassword: passwordBaru,
        }),
      })
      setSukses('Password baru sudah aktif. Pakai password itu di login berikutnya ya.')
      setFase('mintakode')
      setKode('')
      setPasswordBaru('')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal memverifikasi. Coba lagi ya.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="card mb-6 p-5">
      <h2 className="mb-1 text-lg font-extrabold">Ganti Password</h2>
      <p className="mb-3 text-sm text-gray-600">
        Kami kirim kode 6 digit ke <strong>{email}</strong>. Password baru aktif setelah kode cocok.
      </p>

      {error ? (
        <Banner variant="error" className="mb-3">
          {error}
        </Banner>
      ) : null}
      {sukses ? (
        <Banner variant="success" className="mb-3">
          {sukses}
        </Banner>
      ) : null}

      {fase === 'mintakode' ? (
        <button type="button" disabled={busy} onClick={mintaKode} className="btn btn-press">
          {busy ? 'Mengirim…' : 'Kirim kode ke email'}
        </button>
      ) : (
        <form onSubmit={verifikasi} noValidate>
          {info ? (
            <p className="mb-3 text-sm text-gray-600">
              Kode dikirim ke <strong>{info.email_masked}</strong>, berlaku {Math.round(info.expires_in / 60)} menit.
              {info.dev_note ? (
                <span className="mt-2 block rounded-xl border-2 border-amber-700 bg-amber-50 p-2 text-sm font-bold text-amber-900">
                  {info.dev_note}
                </span>
              ) : null}
            </p>
          ) : null}
          <div className="mb-3 max-w-48">
            <label htmlFor="kode-gpw" className="mb-1 block text-sm font-bold">
              Kode 6 digit
            </label>
            <input
              id="kode-gpw"
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
          <div className="mb-4 max-w-sm">
            <label htmlFor="pw-baru" className="mb-1 block text-sm font-bold">
              Password baru
            </label>
            <PasswordInput
              id="pw-baru"
              name="pw-baru"
              minLength={8}
              required
              autoComplete="new-password"
              value={passwordBaru}
              onChange={(e) => setPasswordBaru(e.target.value)}
              className="input-brutal"
              placeholder="Minimal 8 karakter"
            />
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={busy} className="btn btn-cta py-2">
              {busy ? 'Memeriksa…' : 'Simpan password baru'}
            </button>
            <button type="button" onClick={() => setFase('mintakode')} className="btn btn-ghost py-2">
              Batal
            </button>
          </div>
        </form>
      )}
    </section>
  )
}
