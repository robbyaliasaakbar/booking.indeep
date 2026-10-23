/**
 * BookingItemsList — rincian item + surcharge satu booking (issue #7 Batch 2).
 * Dulu di-copy 2× (tabel desktop + kartu mobile) dengan markup nyaris identik.
 */

import { formatRupiah } from '../../lib/format.js'

export default function BookingItemsList({ booking, className = '' }) {
  const items = booking?.items || []
  const surcharges = booking?.surcharges || []
  if (items.length === 0 && surcharges.length === 0) return null

  return (
    <ul className={`space-y-0.5 text-xs text-gray-600 ${className}`}>
      {items.map((it, i) => (
        <li key={i}>
          {it.name} {it.size ? `(${it.size})` : ''} ×{Number(it.qty)}
          {' — '}
          {formatRupiah(it.total)}
        </li>
      ))}
      {surcharges.map((s, i) => (
        <li key={`s${i}`} className="text-amber-800">
          + {s.title}{Number(s.qty) > 1 ? ` ×${Number(s.qty)}` : ''} — {formatRupiah(s.total)}
        </li>
      ))}
    </ul>
  )
}
