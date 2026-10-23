import { useEffect, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { api, ApiError } from '../lib/api.js'
import { useAuth } from '../lib/auth.jsx'
import { statusBadgeClass, statusLabel } from '../lib/format.js'
import HubungiAdmin from '../components/HubungiAdmin.jsx'
import Banner from '../components/Banner.jsx'
import StrukBody from '../components/StrukBody.jsx'

/**
 * Detail booking customer (klik card di Riwayat).
 * Konten utama = StrukBody (satu sumber sama halaman struk — issue #3);
 * halaman ini cuma nambah navigasi, badge status, dan aksi (HubungiAdmin,
 * tombol ke struk).
 */
export default function RiwayatDetail() {
  const { id } = useParams()
  const { user, loading } = useAuth()
  const [b, setB] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    document.title = 'Detail Booking | App InDeep Booking'
  }, [])

  useEffect(() => {
    if (!user) return
    let alive = true
    ;(async () => {
      try {
        const res = await api(`/bookings-detail.php?id=${id}`)
        if (alive) setB(res.data)
      } catch (err) {
        if (alive) setError(err instanceof ApiError ? err.message : 'Gagal memuat detail booking.')
      }
    })()
    return () => {
      alive = false
    }
  }, [user, id])

  if (loading) {
    return <main className="mx-auto max-w-2xl px-4 py-16 text-center font-bold">Memuat…</main>
  }
  if (!user) return <Navigate to="/login" replace />

  if (error) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-8">
        <Banner variant="error">
          {error}
        </Banner>
        <Link to="/riwayat" className="btn btn-ghost btn-press mt-4 inline-block px-4 py-2">
          ← Kembali ke Riwayat
        </Link>
      </main>
    )
  }

  if (!b) {
    return <main className="mx-auto max-w-2xl px-4 py-16 text-center font-bold">Memuat detail…</main>
  }

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8">
      <Link to="/riwayat" className="btn btn-ghost btn-press mb-4 inline-block px-4 py-2 text-sm">
        ← Riwayat
      </Link>

      <div className="mb-3 flex items-center justify-between gap-3">
        <span className={`rounded-full border-2 border-ink px-3 py-1 text-xs font-bold ${statusBadgeClass(b.status)}`}>
          {statusLabel(b.status)}
        </span>
        <Link to={`/riwayat/${b.id}/struk`} className="btn btn-cta px-4 py-2 text-sm">
          Unduh Struk
        </Link>
      </div>

      {/* Konten = StrukBody (satu sumber dgn halaman struk) */}
      <StrukBody booking={b} />

      {b.status === 'pending' && <HubungiAdmin bookingCode={b.code} className="mt-4" />}
    </main>
  )
}
