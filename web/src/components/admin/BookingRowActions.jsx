/**
 * BookingRowActions — blok aksi satu baris booking (issue #7 Batch 2).
 * Dulu diduplikasi antara tabel desktop & kartu mobile, dan waLink() dihitung
 * berkali-kali per baris. Sekarang `waHref` dihitung SEKALI di parent
 * (BookingRow) lalu dikirim ke sini.
 *
 * Props:
 *   booking     : objek booking
 *   waHref      : string|null — hasil waLink() (sudah dihitung parent)
 *   transitions : array aksi transisi untuk status ini
 *   isSuper     : bool
 *   onAction    : (booking, action) => void
 *   onMove      : (booking) => void
 *   onDelete    : (booking) => void
 *   className   : kelas tambahan wrapper (mis. mt-3)
 */

// Aksi butuh alasan (tolak/batalkan) = destruktif — hover merah muda biar
// jelas kelihatan, bukan ghost putih-krem yang nyaris tak terlihat
const BTN_CTA = 'btn text-xs btn-cta'
const BTN_NEED_REASON = 'btn text-xs border-red-700 bg-red-50 text-red-800 hover:bg-red-100 hover:translate-x-px hover:translate-y-px'
const BTN_PLAIN = 'btn text-xs btn-press'

export default function BookingRowActions({
  booking,
  waHref,
  transitions = [],
  isSuper = false,
  onAction,
  onMove,
  onDelete,
  className = '',
}) {
  return (
    // stopPropagation: klik tombol aksi jangan ikut buka struk
    <div className={`flex flex-wrap gap-1 ${className}`} onClick={(e) => e.stopPropagation()}>
      {waHref ? (
        <a
          href={waHref}
          target="_blank"
          rel="noreferrer"
          className="btn border-emerald-700 bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-900 hover:bg-emerald-100"
          title={`Chat WhatsApp ${booking.name}`}
        >
          WA
        </a>
      ) : null}
      {transitions.map((a) => (
        <button
          key={a.to}
          type="button"
          onClick={() => onAction(booking, a)}
          className={a.cta ? BTN_CTA : a.needReason ? BTN_NEED_REASON : BTN_PLAIN}
        >
          {a.label}
        </button>
      ))}
      {isSuper && ['pending', 'confirmed'].includes(booking.status) ? (
        <button type="button" onClick={() => onMove(booking)} className="btn btn-press text-xs">
          Pindah
        </button>
      ) : null}
      {isSuper ? (
        <button
          type="button"
          onClick={() => onDelete(booking)}
          className="btn border-red-700 bg-red-50 px-2 py-1 text-xs text-red-800 hover:bg-red-100"
        >
          Hapus
        </button>
      ) : null}
    </div>
  )
}
