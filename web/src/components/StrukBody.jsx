import { formatDate, formatRupiah, formatSlotTime, statusLabel } from '../lib/format.js'

/**
 * Konten struk (article) dipakai bersama:
 * - Halaman customer /riwayat/:id/struk
 * - Halaman admin /admin-bookings/:id/struk
 * Tanpa tombol aksi — tombol urusan halaman masing-masing.
 */
export default function StrukBody({ booking }) {
  const a = booking.address

  return (
    <article className="rounded-card border-2 border-ink bg-white p-6 shadow-brutal print:rounded-none print:border-0 print:shadow-none">
      <header className="mb-5 flex items-start justify-between gap-3 border-b-2 border-ink pb-4">
        <div>
          <img
            src={`${import.meta.env.BASE_URL}brand/logo+logo-text.webp`}
            alt="InDeepCleaningID"
            className="mb-2 h-8 w-auto"
          />
          <p className="text-sm text-gray-600">Jasa cuci sofa, kasur, karpet, gordyn, interior mobil</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-600">Nomor booking</p>
          <p className="font-extrabold">{booking.code}</p>
          <p className="mt-1 text-xs text-gray-600">Status</p>
          <p className="font-bold">{statusLabel(booking.status)}</p>
        </div>
      </header>

      <section className="mb-5 grid gap-4 text-sm sm:grid-cols-2">
        <div>
          <p className="font-extrabold">Pelanggan</p>
          <p>{booking.name}</p>
          <p>WA: {booking.phone_primary}</p>
          {booking.phone_secondary && <p>WA cadangan: {booking.phone_secondary}</p>}
        </div>
        <div>
          <p className="font-extrabold">Jadwal layanan</p>
          <p>{formatDate(booking.slot_date)}</p>
          <p>{formatSlotTime(booking.slot_time)} WIB</p>
        </div>
        <div className="sm:col-span-2">
          <p className="font-extrabold">Alamat layanan</p>
          <p>
            {a.street_no}, Kel. {a.village}, Kec. {a.district}
          </p>
          <p>
            {a.city}, {a.province} {a.postal || ''}
          </p>
          {a.note && <p className="text-gray-600 italic">Catatan: {a.note}</p>}
        </div>
      </section>

      <section className="mb-5">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b-2 border-ink text-left">
              <th className="py-2">Barang</th>
              <th className="py-2 text-center">Qty</th>
              <th className="py-2 text-right">Harga</th>
              <th className="py-2 text-right">Jumlah</th>
            </tr>
          </thead>
          <tbody>
            {booking.items.map((it) => (
              <tr key={it.sku_id} className="border-b border-gray-200">
                <td className="py-2">
                  {it.name_snapshot} {it.size_snapshot}
                </td>
                <td className="py-2 text-center">
                  {Number(it.qty)} {it.unit}
                </td>
                <td className="py-2 text-right">{formatRupiah(Number(it.price_snapshot))}</td>
                <td className="py-2 text-right font-bold">{formatRupiah(Number(it.line_total))}</td>
              </tr>
            ))}
            {booking.surcharges.map((sc) => (
              <tr key={sc.code} className="border-b border-gray-200">
                <td className="py-2 italic">+ {sc.title_snapshot}</td>
                <td className="py-2 text-center">{Number(sc.qty_affected)}</td>
                <td className="py-2 text-right">{formatRupiah(Number(sc.amount_snapshot))}</td>
                <td className="py-2 text-right font-bold">{formatRupiah(Number(sc.line_total))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="ml-auto w-full max-w-xs space-y-1 text-sm">
        <div className="flex justify-between">
          <span>Subtotal</span>
          <span className="font-bold">{formatRupiah(booking.subtotal)}</span>
        </div>
        <div className="flex justify-between">
          <span>Biaya tambahan</span>
          <span className="font-bold">{formatRupiah(booking.surchargeTotal)}</span>
        </div>
        <div className="flex justify-between border-t-2 border-ink pt-2 text-base font-extrabold">
          <span>Total estimasi</span>
          <span>{formatRupiah(booking.total)}</span>
        </div>
      </section>

      {booking.cancel_reason && (
        <p className="mt-4 rounded-xl border-2 border-ink bg-danger/40 p-3 text-sm">
          <span className="font-bold">Dibatalkan:</span> {booking.cancel_reason}
        </p>
      )}

      <footer className="mt-6 border-t-2 border-ink pt-4 text-center text-xs text-gray-500 print:text-xs">
        <p>Terima kasih sudah mempercayakan barang kesayangan Anda kepada InDeepCleaningID.</p>
        <p>Struk ini dibuat otomatis — harga final dikonfirmasi tim setelah inspeksi di lokasi.</p>
      </footer>
    </article>
  )
}
