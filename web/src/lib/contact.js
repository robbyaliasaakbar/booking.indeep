/**
 * Kontak admin WhatsApp — tombol "Hubungi Admin" (worst case booking pending).
 *
 * Nomor diisi lewat env build: VITE_WA_ADMIN, format internasional tanpa "+"
 * (contoh: 6281234567890). Kalau belum diset, tombol disembunyikan otomatis —
 * gak bakal nunjukkin nomor rusak ke customer.
 */

const RAW = String(import.meta.env.VITE_WA_ADMIN || '').replace(/[^0-9]/g, '')

export const waAdminReady = RAW.length >= 8

/** Link WA ke admin dengan prefill booking ID. null kalau nomor belum diset. */
export function waAdminLink(bookingCode) {
  if (!waAdminReady || !bookingCode) return null
  const text = encodeURIComponent(
    `Halo MinDi, aku sudah melakukan pembookingan dengan booking ID ${bookingCode}, ` +
    `tolong di cek ya, terima kasih`
  )
  return `https://wa.me/${RAW}?text=${text}`
}
