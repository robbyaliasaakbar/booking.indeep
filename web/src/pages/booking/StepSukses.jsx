import { Link } from 'react-router-dom'
import { formatDate, formatRupiah, formatSlotTime } from '../../lib/format.js'
import HubungiAdmin from '../../components/HubungiAdmin.jsx'

/**
 * Langkah 5 — Sukses (PRD Bab 9.2):
 * nomor booking, tanggal jam, total, tombol riwayat dan unduh struk.
 */
export default function StepSukses({ booking, onNew }) {
  return (
    <section className="rounded-card border-2 border-ink bg-white p-6 text-center shadow-brutal sm:p-8">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border-2 border-ink bg-success text-3xl">
        ✓
      </div>
      <h2 className="mb-1 text-2xl font-extrabold">Pesanan masuk!</h2>
      <p className="mb-6 text-sm text-gray-600">
        Terima kasih. Tim kami konfirmasi lewat WhatsApp biasanya maksimal 1×24 jam.
      </p>

      <div className="mx-auto mb-6 max-w-sm rounded-card border-2 border-ink bg-paper p-4 text-left shadow-brutal-sm">
        <p className="text-sm text-gray-600">Nomor booking</p>
        <p className="mb-3 text-xl font-extrabold tracking-wide">{booking.code}</p>
        <p className="text-sm text-gray-600">Jadwal</p>
        <p className="mb-3 font-bold">
          {formatDate(booking.slot_date)} — {formatSlotTime(booking.slot_time)}
        </p>
        <p className="text-sm text-gray-600">Total estimasi</p>
        <p className="text-lg font-extrabold">{formatRupiah(booking.total)}</p>
      </div>

      <HubungiAdmin bookingCode={booking.code} className="mx-auto mb-6 max-w-sm text-left" />

      <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
        <Link to="/riwayat" className="btn btn-ghost btn-press py-3">
          Lihat Riwayat
        </Link>
        <Link to={`/riwayat/${booking.id}/struk`} className="btn btn-cta py-3">
          Unduh Struk
        </Link>
      </div>

      <p className="mt-6 text-sm text-gray-600">
        Mau pesan lagi?{' '}
        <button type="button" className="font-bold underline" onClick={onNew}>
          Mulai booking baru
        </button>
      </p>
    </section>
  )
}
