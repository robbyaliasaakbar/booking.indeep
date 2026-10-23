import { useEffect, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { api } from '../lib/api.js'
import { useAuth } from '../lib/auth.jsx'
import { downloadStrukPdf } from '../lib/strukPdf.js'
import StrukBody from '../components/StrukBody.jsx'

/**
 * Halaman struk print-ready (keputusan Bang Rob, T2-B1):
 * tombol Download PDF → jsPDF text-based (bukan print dialog browser).
 * Hasil PDF: tulisan selectable/copy-paste, tanpa header/footer browser.
 */
export default function Struk() {
  const { id } = useParams()
  const { user, loading } = useAuth()
  const [booking, setBooking] = useState(null)
  const [error, setError] = useState('')

  // Judul tab & header print Chrome — tanpa set, title lama ("Login | …")
  // ikut tercetak di struk. Saat print, title dikosongkan dulu biar header
  // browser bersih, lalu dikembalikan.
  useEffect(() => {
    const before = document.title
    document.title = 'Struk Booking | App InDeep Booking'
    const onBeforePrint = () => { document.title = '' }
    const onAfterPrint = () => { document.title = 'Struk Booking | App InDeep Booking' }
    window.addEventListener('beforeprint', onBeforePrint)
    window.addEventListener('afterprint', onAfterPrint)
    return () => {
      window.removeEventListener('beforeprint', onBeforePrint)
      window.removeEventListener('afterprint', onAfterPrint)
      document.title = before
    }
  }, [])

  useEffect(() => {
    if (!user) return
    let alive = true
    ;(async () => {
      try {
        const res = await api(`/bookings-detail.php?id=${id}`)
        if (alive) setBooking(res.data)
      } catch (err) {
        if (alive) setError(err.message || 'Gagal memuat struk.')
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
        <div className="rounded-card border-2 border-ink bg-danger p-4 font-bold shadow-brutal-sm">
          {error}
        </div>
        <Link to="/riwayat" className="btn btn-ghost btn-press mt-4 inline-block px-4 py-2">
          ← Kembali ke Riwayat
        </Link>
      </main>
    )
  }

  if (!booking) {
    return <main className="mx-auto max-w-2xl px-4 py-16 text-center font-bold">Memuat struk…</main>
  }

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-8 print:max-w-none print:p-0">
      {/* Tombol — hilang saat print */}
      <div className="mb-6 flex flex-wrap items-center gap-3 print:hidden">
        <Link to="/riwayat" className="btn btn-ghost btn-press px-4 py-2 text-sm">
          ← Riwayat
        </Link>
        <button
          type="button"
          className="btn btn-cta px-4 py-2 text-sm"
          onClick={() => downloadStrukPdf(booking).catch(() => {})}
        >
          ⬇ Download PDF
        </button>
        <p className="basis-full text-xs text-gray-500">
          PDF dihasilkan langsung — tulisan bisa di-copy paste, tanpa header browser.
        </p>
      </div>

      <StrukBody booking={booking} />
    </main>
  )
}
