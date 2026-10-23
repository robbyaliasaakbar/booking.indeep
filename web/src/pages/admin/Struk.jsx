import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api, ApiError } from '../../lib/api.js'
import { downloadStrukPdf } from '../../lib/strukPdf.js'
import StrukBody from '../../components/StrukBody.jsx'

/**
 * Struk versi admin (di dalam AdminLayout): klik baris di admin-bookings →
 * lihat struk lengkap → kembali ke daftar booking. Khusus area admin,
 * gak numpang halaman customer.
 */
export default function AdminStruk() {
  const { id } = useParams()
  const [booking, setBooking] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    document.title = 'Struk Booking (Admin) | App InDeep Booking'
    let alive = true
    ;(async () => {
      try {
        const res = await api(`/bookings-detail.php?id=${id}`)
        if (alive) setBooking(res.data)
      } catch (err) {
        if (alive) setError(err instanceof ApiError ? err.message : 'Gagal memuat struk.')
      }
    })()
    return () => {
      alive = false
    }
  }, [id])

  if (error) {
    return (
      <div>
        <div className="rounded-card border-2 border-ink bg-danger p-4 font-bold shadow-brutal-sm">{error}</div>
        <Link to="/admin-bookings" className="btn btn-ghost btn-press mt-4 inline-block px-4 py-2">
          ← Kembali ke Booking
        </Link>
      </div>
    )
  }

  if (!booking) {
    return <p className="py-16 text-center font-bold">Memuat struk…</p>
  }

  return (
    <div className="mx-auto w-full max-w-2xl">
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Link to="/admin-bookings" className="btn btn-ghost btn-press px-4 py-2 text-sm">
          ← Kembali ke Booking
        </Link>
        <button
          type="button"
          className="btn btn-cta px-4 py-2 text-sm"
          onClick={() => downloadStrukPdf(booking).catch(() => {})}
        >
          ⬇ Download PDF
        </button>
      </div>

      <StrukBody booking={booking} />
    </div>
  )
}
