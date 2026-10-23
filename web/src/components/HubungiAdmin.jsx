import { waAdminLink } from '../lib/contact.js'

/**
 * Tombol "Hubungi Admin" — jaring pengaman worst case: booking menunggu
 * konfirmasi tapi status belum berubah >15 menit. Chat dibuka ke admin
 * (MinDi) dengan prefill booking ID.
 * Tidak dirender sama sekali kalau nomor admin belum diset (VITE_WA_ADMIN).
 */
export default function HubungiAdmin({ bookingCode, className = '' }) {
  const href = waAdminLink(bookingCode)
  if (!href) return null

  return (
    <div className={`rounded-card border-2 border-dashed border-ink bg-paper p-3 ${className}`}>
      <p className="text-sm text-gray-700">
        Jika status belum berubah dalam waktu 15 menit setelah pemesanan, segera hubungi MinDi
        untuk mendapatkan konfirmasi.
      </p>
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className="btn mt-2 inline-block border-emerald-700 bg-emerald-50 px-3 py-1.5 text-sm font-bold text-emerald-900 hover:bg-emerald-100"
      >
        Hubungi Admin
      </a>
    </div>
  )
}
