import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../lib/auth.jsx'
import FotoProfil from '../components/profil/FotoProfil.jsx'
import DataDiriForm from '../components/profil/DataDiriForm.jsx'
import AlamatPanel from '../components/profil/AlamatPanel.jsx'
import GantiPassword from '../components/profil/GantiPassword.jsx'
import GantiEmail from '../components/profil/GantiEmail.jsx'
import Banner from '../components/Banner.jsx'

/**
 * Halaman Profil (PRD Bab 10.3 + 16.2) — tipis: header + banner + susun panel.
 * Panel-panel dipisah ke components/profil/* (issue #7 Batch 3):
 *   FotoProfil (upload/hapus), DataDiriForm, AlamatPanel, GantiPassword, GantiEmail.
 * Banner error/success halaman dipakai bareng antar panel (dikirim lewat props).
 */
export default function Profil() {
  const { user, loading, refresh } = useAuth()

  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    document.title = 'Profil | App InDeep Booking'
  }, [])

  // Sesi habis = arahkan ke login, jangan layar kosong (issue #6)
  if (loading) {
    return <main className="mx-auto max-w-3xl px-4 py-16 text-center font-bold">Memuat…</main>
  }
  if (!user) return <Navigate to="/login" replace />
  if (user.role !== 'customer') return <Navigate to="/admin" replace />

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
      <header className="mb-6">
        <h1 className="text-3xl font-extrabold">Profil Saya</h1>
        <p className="mt-1 text-sm text-gray-600">
          Data diri, foto, alamat, dan keamanan akun kamu.
        </p>
        <p
          className={
            'mt-3 inline-block rounded-xl border-2 border-ink px-3 py-1 text-sm font-bold ' +
            (user.profile_complete ? 'bg-green-200' : 'bg-yellow-200')
          }
        >
          {user.profile_complete
            ? 'Profil lengkap — siap booking.'
            : 'Profil belum lengkap — isi nama, WA utama, dan alamat default.'}
        </p>
      </header>

      {error ? (
        <Banner variant="error" className="mb-4">
          {error}
        </Banner>
      ) : null}
      {success ? (
        <Banner variant="success" className="mb-4">
          {success}
        </Banner>
      ) : null}

      <FotoProfil user={user} onBerubah={refresh} onError={setError} onSuccess={setSuccess} />
      <DataDiriForm user={user} onBerubah={refresh} onError={setError} onSuccess={setSuccess} />
      <AlamatPanel user={user} onBerubah={refresh} />
      <GantiPassword email={user.email} />
      <GantiEmail email={user.email} onBerubah={refresh} />
    </main>
  )
}
