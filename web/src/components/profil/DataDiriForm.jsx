/**
 * DataDiriForm — panel data diri (nama, WA utama/cadangan, preferensi jam)
 * (issue #7 Batch 3). Dipisah dari Profil.jsx.
 */

import { useEffect, useState } from 'react'
import { api, ApiError } from '../../lib/api.js'

export default function DataDiriForm({ user, onBerubah, onError, onSuccess }) {
  const [name, setName] = useState('')
  const [phonePrimary, setPhonePrimary] = useState('')
  const [phoneSecondary, setPhoneSecondary] = useState('')
  const [preferredTime, setPreferredTime] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!user) return
    setName(user.name || '')
    setPhonePrimary(user.phone_primary || '')
    setPhoneSecondary(user.phone_secondary || '')
    setPreferredTime(user.preferred_time || '')
  }, [user])

  async function onSubmit(event) {
    event.preventDefault()
    onError('')
    onSuccess('')
    setBusy(true)
    try {
      await api('/me.php', {
        method: 'PATCH',
        body: JSON.stringify({
          name,
          phone_primary: phonePrimary,
          phone_secondary: phoneSecondary,
          preferred_time: preferredTime || null,
        }),
      })
      await onBerubah()
      onSuccess('Data diri tersimpan.')
    } catch (err) {
      onError(err instanceof ApiError ? err.message : 'Gagal menyimpan. Coba lagi ya.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="card mb-6 p-5">
      <h2 className="mb-3 text-lg font-extrabold">Data Diri</h2>
      <form onSubmit={onSubmit} noValidate>
        <div className="mb-4">
          <label htmlFor="nama" className="mb-1 block text-sm font-bold">
            Nama lengkap
          </label>
          <input
            id="nama"
            type="text"
            required
            maxLength={100}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-xl border-2 border-ink px-3 py-2 focus-visible:outline-none"
          />
        </div>
        <div className="mb-4">
          <label htmlFor="wa-utama" className="mb-1 block text-sm font-bold">
            Nomor WhatsApp utama
          </label>
          <input
            id="wa-utama"
            type="tel"
            required
            value={phonePrimary}
            onChange={(e) => setPhonePrimary(e.target.value)}
            className="w-full rounded-xl border-2 border-ink px-3 py-2 focus-visible:outline-none"
            placeholder="081234567890"
          />
        </div>
        <div className="mb-4">
          <label htmlFor="wa-cadangan" className="mb-1 block text-sm font-bold">
            Nomor WhatsApp cadangan <span className="font-normal text-gray-500">(opsional)</span>
          </label>
          <input
            id="wa-cadangan"
            type="tel"
            value={phoneSecondary}
            onChange={(e) => setPhoneSecondary(e.target.value)}
            className="w-full rounded-xl border-2 border-ink px-3 py-2 focus-visible:outline-none"
            placeholder="081234567890"
          />
        </div>
        <div className="mb-5">
          <label htmlFor="preferensi" className="mb-1 block text-sm font-bold">
            Preferensi jam kedatangan teknisi
          </label>
          <select
            id="preferensi"
            value={preferredTime}
            onChange={(e) => setPreferredTime(e.target.value)}
            className="w-full rounded-xl border-2 border-ink px-3 py-2 focus-visible:outline-none"
          >
            <option value="">Belum memilih</option>
            <option value="09.00">09.00 (pagi)</option>
            <option value="13.00">13.00 (siang)</option>
          </select>
        </div>
        <button type="submit" disabled={busy} className="btn btn-cta py-3">
          {busy ? 'Menyimpan…' : 'Simpan Data Diri'}
        </button>
      </form>
    </section>
  )
}
