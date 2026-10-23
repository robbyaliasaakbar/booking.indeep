/**
 * BookingRow — satu baris booking, dua tampilan (table row / card) dalam
 * SATU komponen (issue #7 Batch 2). Sebelumnya markup tabel & kartu ditulis
 * terpisah + selalu ter-mount dua-duanya; `waLink()` pun dihitung 4× per baris.
 *
 * Parent (Bookings.jsx) memutuskan mana yang dirender via `variant`, jadi
 * tidak ada lagi render ganda. waLink() dihitung SEKALI di sini.
 *
 * Props:
 *   booking     : objek booking
 *   variant     : 'table' | 'card'
 *   isSuper     : bool
 *   transitions : array aksi transisi status
 *   onOpen      : (booking) => void  (navigate ke struk)
 *   onAction    : (booking, action) => void
 *   onMove      : (booking) => void
 *   onDelete    : (booking) => void
 */

import { formatRupiah, formatDateShort, formatSlotTime, statusBadgeClass, statusLabel } from '../../lib/format.js'
import BookingItemsList from './BookingItemsList.jsx'
import BookingRowActions from './BookingRowActions.jsx'

function waLink(phone, booking) {
  let n = String(phone || '').replace(/[^0-9]/g, '')
  if (n.startsWith('0')) n = '62' + n.slice(1)
  if (!n) return null

  const cap = (s) => String(s || '').charAt(0).toUpperCase() + String(s || '').slice(1)
  const rupiahPlain = (v) => 'Rp ' + Number(v).toLocaleString('id-ID')
  const sizeLabel = (size) => {
    const s = String(size || '').trim()
    return /^\d+$/.test(s) ? ` uk.${s}` : ` ${s}`
  }

  const lines = (booking.items || []).map((it) =>
    `- Wet Cleaning ${cap(it.name)}${sizeLabel(it.size)} : ${rupiahPlain(it.total)}`
  )
  for (const s of (booking.surcharges || [])) {
    lines.push(`- Tambahan ${s.title} : ${rupiahPlain(s.total)}`)
  }

  const pray = '\u{1F64F}'
  const text =
    `Halo kak *${booking.name}*, kami menerima pembookingan dengan booking *ID ${booking.code}* ` +
    `tanggal ${formatDateShort(booking.slot_date)} jam ${formatSlotTime(booking.slot_time)} ` +
    `dengan rincian sebagai berikut:\n` +
    lines.join('\n') +
    `\n\n*Total: ${rupiahPlain(booking.total)},-*\n\n` +
    `Mohon konfirmasi terlebih dahulu untuk kebenaran datanya ya kak agar dapat kami keep jadwal bookingnya. Terima kasih ${pray}`

  return `https://wa.me/${n}?text=${encodeURIComponent(text)}`
}

export function buildWaLink(phone, booking) {
  return waLink(phone, booking)
}

export default function BookingRow({ booking: b, variant, isSuper, transitions, onOpen, onAction, onMove, onDelete }) {
  const waHref = waLink(b.phone, b) // dihitung SEKALI per baris

  const openProps = {
    role: 'link',
    tabIndex: 0,
    'aria-label': `Lihat struk booking ${b.code}`,
    onClick: () => onOpen(b),
    onKeyDown: (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        onOpen(b)
      }
    },
  }

  if (variant === 'table') {
    return (
      <tr
        {...openProps}
        className="cursor-pointer border-b border-gray-200 transition last:border-0 hover:bg-paper focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
      >
        <td className="p-3 font-bold">{b.code}</td>
        <td className="p-3">
          <p className="font-bold">{b.name}</p>
          <p className="text-xs text-gray-500">{b.phone} · {b.city}</p>
        </td>
        <td className="p-3">
          {formatDateShort(b.slot_date)}
          <br />
          <span className="text-xs text-gray-500">{formatSlotTime(b.slot_time)}</span>
        </td>
        <td className="p-3 font-bold">
          {formatRupiah(b.total)}
          <BookingItemsList booking={b} className="mt-1 font-normal" />
        </td>
        <td className="p-3">
          <span className={`inline-block rounded-lg border-2 border-ink px-2 py-0.5 text-xs font-extrabold ${statusBadgeClass(b.status)}`}>
            {statusLabel(b.status)}
          </span>
        </td>
        <td className="p-3">
          <BookingRowActions
            booking={b}
            waHref={waHref}
            transitions={transitions}
            isSuper={isSuper}
            onAction={onAction}
            onMove={onMove}
            onDelete={onDelete}
          />
        </td>
      </tr>
    )
  }

  // variant === 'card'
  return (
    <div
      {...openProps}
      className="card cursor-pointer p-4 transition hover:bg-paper focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-extrabold">{b.code}</p>
          <p className="text-sm">{b.name} · {b.phone}</p>
          <p className="text-sm text-gray-600">{formatDateShort(b.slot_date)} · {formatSlotTime(b.slot_time)}</p>
          <p className="mt-1 font-bold">{formatRupiah(b.total)}</p>
          <BookingItemsList booking={b} className="mt-1" />
        </div>
        <span className={`shrink-0 rounded-lg border-2 border-ink px-2 py-0.5 text-xs font-extrabold ${statusBadgeClass(b.status)}`}>
          {statusLabel(b.status)}
        </span>
      </div>
      {transitions.length > 0 || isSuper ? (
        <BookingRowActions
          booking={b}
          waHref={waHref}
          transitions={transitions}
          isSuper={isSuper}
          onAction={onAction}
          onMove={onMove}
          onDelete={onDelete}
          className="mt-3"
        />
      ) : null}
    </div>
  )
}
