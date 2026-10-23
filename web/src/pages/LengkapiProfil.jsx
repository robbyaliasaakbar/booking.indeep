import { useEffect, useState } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { api, ApiError } from '../lib/api.js'
import { useAuth } from '../lib/auth.jsx'
import AddressFields from '../components/AddressFields.jsx'
import Banner from '../components/Banner.jsx'
import { EMPTY_ADDRESS, normalizeAddress, validateAddress } from '../lib/addressForm.js'

/**
 * Lengkapi Profil (PRD Bab 10.1, Bab 19.4):
 * Customer baru (Google) wajib isi nama + WA utama + alamat default
 * sebelum bisa booking. profile_complete dihitung ulang server-side.
 */
export default function LengkapiProfil() {
  const { user, loading, refresh } = useAuth()
  const navigate = useNavigate()

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [alamat, setAlamat] = useState({ ...EMPTY_ADDRESS, label: 'Rumah' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    document.title = 'Lengkapi Profil | App InDeep Booking'
  }, [])

  useEffect(() => {
    if (user?.profile_complete) {
      navigate('/booking', { replace: true })
    }
  }, [user, navigate])

  async function onSubmit(e) {
    e.preventDefault()
    setError('')

    const addrErr = validateAddress(alamat)
    if (addrErr) {
      setError(addrErr)
      return
    }

    setBusy(true)
    try {
      // 1. Nama + WA utama dulu
      await api('/me.php', {
        method: 'PATCH',
        body: JSON.stringify({ name: name.trim(), phone_primary: phone.trim() }),
      })
      // 2. Alamat default (kontrak snake_case seragam — lib/addressForm.js)
      await api('/addresses.php', {
        method: 'POST',
        body: JSON.stringify({ ...normalizeAddress(alamat), is_default: true }),
      })
      await refresh()
      navigate('/booking', { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal menyimpan. Coba lagi ya.')
      setBusy(false)
    }
  }

  if (loading) {
    return <main className="mx-auto max-w-2xl px-4 py-16 text-center font-bold">Memuat…</main>
  }
  if (!user) {
    // Guard saat render — pakai <Navigate/> seperti Riwayat.jsx (issue #3),
    // bukan navigate() di body render (anti double-invoke StrictMode).
    return <Navigate to="/login" replace />
  }

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8">
      <header className="mb-6">
        <p className="text-sm font-bold uppercase tracking-wide text-brand">InDeepCleaningID</p>
        <h1 className="text-3xl font-extrabold">Lengkapi Profil</h1>
        <p className="mt-1 text-sm text-gray-600">
          Sebelum booking, isi nama, nomor WhatsApp, dan alamat dulu ya — biar tim kami mudah menghubungi.
        </p>
      </header>

      {error ? (
        <Banner variant="error" className="mb-4">
          {error}
        </Banner>
      ) : null}

      <form onSubmit={onSubmit} className="card space-y-4 p-5">
        <h2 className="text-lg font-extrabold">Data Diri</h2>
        <label className="block text-sm font-bold">
          Nama lengkap <span className="text-red-600">*</span>
          <input
            required
            maxLength={100}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="input-brutal mt-1"
            placeholder="Budi Santoso"
          />
        </label>
        <label className="block text-sm font-bold">
          Nomor WhatsApp <span className="text-red-600">*</span>
          <input
            required
            maxLength={30}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="input-brutal mt-1"
            placeholder="081234567890"
          />
        </label>

        <hr className="border-ink" />
        <h2 className="text-lg font-extrabold">Alamat Utama</h2>
        <AddressFields
          value={alamat}
          onChange={(k, val) => setAlamat((a) => ({ ...a, [k]: val }))}
          idPrefix="lengkapi-ad"
          variant="plain"
          showNote={false}
          showMaps={false}
        />

        <button type="submit" disabled={busy} className="btn btn-cta w-full py-3 text-base">
          {busy ? 'Menyimpan…' : 'Simpan & Lanjut Booking'}
        </button>
      </form>
    </main>
  )
}
