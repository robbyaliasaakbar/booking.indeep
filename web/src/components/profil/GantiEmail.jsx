/**
 * GantiEmail — panel ganti email via dua OTP (email lama + baru) (issue #7 Batch 3).
 * Dipisah dari Profil.jsx.
 */

import { useState } from 'react'
import { api, ApiError } from '../../lib/api.js'
import Banner from '../Banner.jsx'

export default function GantiEmail({ email, onBerubah }) {
  const [fase, setFase] = useState('awal') // awal | konfirmasi
  const [emailBaru, setEmailBaru] = useState('')
  const [kodeLama, setKodeLama] = useState('')
  const [kodeBaru, setKodeBaru] = useState('')
  const [error, setError] = useState('')
  const [sukses, setSukses] = useState('')
  const [busy, setBusy] = useState(false)
  const [devNote, setDevNote] = useState('')

  async function mulai(event) {
    event.preventDefault()
    setError('')
    setSukses('')
    // Validasi di FE dulu (form noValidate, browser gak nge-block) — biar user
    // gak kena error backend pas klik tanpa isi / format aneh. Backend tetap
    // jadi penjaga terakhir (cek bentrok, sama dgn email lama, dll).
    const isi = emailBaru.trim()
    if (isi === '') {
      setError('Isi dulu email barunya ya.')
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(isi)) {
      setError('Format email belum benar ya. Contoh: nama@email.com')
      return
    }
    setBusy(true)
    try {
      // 1. OTP ke email LAMA
      await api('/otp-email-request-old.php', { method: 'POST' })
      // 2. OTP ke email BARU
      const res = await api('/otp-request.php', {
        method: 'POST',
        body: JSON.stringify({ purpose: 'ganti_email', newEmail: isi }),
      })
      setDevNote(res.data?.dev_note || '')
      setFase('konfirmasi')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal mengirim kode. Coba lagi ya.')
    } finally {
      setBusy(false)
    }
  }

  async function konfirmasi(event) {
    event.preventDefault()
    setError('')
    setBusy(true)
    try {
      await api('/otp-email-confirm.php', {
        method: 'POST',
        body: JSON.stringify({
          newEmail: emailBaru,
          oldCode: kodeLama,
          newCode: kodeBaru,
        }),
      })
      await onBerubah()
      setSukses(`Email berhasil diganti ke ${emailBaru}.`)
      setFase('awal')
      setEmailBaru('')
      setKodeLama('')
      setKodeBaru('')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal mengonfirmasi. Coba lagi ya.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="card p-5">
      <h2 className="mb-1 text-lg font-extrabold">Ganti Email</h2>
      <p className="mb-3 text-sm text-gray-600">
        Email sekarang: <strong>{email}</strong>. Butuh kode dari email lama <em>dan</em> email baru.
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

      {fase === 'awal' ? (
        <form onSubmit={mulai} noValidate>
          <div className="mb-3 max-w-sm">
            <label htmlFor="email-baru" className="mb-1 block text-sm font-bold">
              Email baru
            </label>
            <input
              id="email-baru"
              type="email"
              required
              value={emailBaru}
              onChange={(e) => setEmailBaru(e.target.value)}
              className="input-brutal"
              placeholder="nama@email.com"
            />
          </div>
          <button type="submit" disabled={busy} className="btn btn-press">
            {busy ? 'Mengirim…' : 'Kirim dua kode OTP'}
          </button>
        </form>
      ) : (
        <form onSubmit={konfirmasi} noValidate>
          {devNote ? (
            <p className="mb-3 rounded-xl border-2 border-amber-700 bg-amber-50 p-2 text-sm font-bold text-amber-900">
              {devNote}
            </p>
          ) : null}
          <div className="mb-3 max-w-48">
            <label htmlFor="kode-lama" className="mb-1 block text-sm font-bold">
              Kode dari email lama
            </label>
            <input
              id="kode-lama"
              type="text"
              inputMode="numeric"
              pattern="\d{6}"
              maxLength={6}
              required
              value={kodeLama}
              onChange={(e) => setKodeLama(e.target.value.replace(/\D/g, ''))}
              className="input-brutal text-center font-extrabold tracking-widest"
            />
          </div>
          <div className="mb-4 max-w-48">
            <label htmlFor="kode-baru" className="mb-1 block text-sm font-bold">
              Kode dari email baru
            </label>
            <input
              id="kode-baru"
              type="text"
              inputMode="numeric"
              pattern="\d{6}"
              maxLength={6}
              required
              value={kodeBaru}
              onChange={(e) => setKodeBaru(e.target.value.replace(/\D/g, ''))}
              className="input-brutal text-center font-extrabold tracking-widest"
            />
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={busy} className="btn btn-cta py-2">
              {busy ? 'Memeriksa…' : 'Konfirmasi ganti email'}
            </button>
            <button type="button" onClick={() => setFase('awal')} className="btn btn-ghost py-2">
              Batal
            </button>
          </div>
        </form>
      )}
    </section>
  )
}
