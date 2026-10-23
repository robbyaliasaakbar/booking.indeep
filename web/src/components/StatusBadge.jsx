/**
 * StatusBadge — badge status booking tunggal (issue #8).
 *
 * Dulu ada 2 bentuk badge yang beda antar halaman (admin vs customer).
 * Sekarang satu komponen pakai statusBadgeClass() + statusLabel() dari lib/format.
 *
 * Props:
 *   status : status booking (pending/confirmed/…)
 *   className : kelas tambahan (mis. shrink-0)
 */

import { statusBadgeClass, statusLabel } from '../lib/format.js'

export default function StatusBadge({ status, className = '' }) {
  return (
    <span
      className={`inline-block rounded-lg border-2 border-ink px-2 py-0.5 text-xs font-extrabold ${statusBadgeClass(status)} ${className}`}
    >
      {statusLabel(status)}
    </span>
  )
}
