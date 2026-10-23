/** Format angka jadi Rupiah Indonesia. Contoh: 300000 -> "Rp300.000" (PRD Bab 5.6). */
export function formatRupiah(amount) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

/** Format tanggal ISO "2026-10-14" -> "Rabu, 14 Oktober 2026". */
export function formatDate(isoDate) {
  if (!isoDate) return ''
  const [y, m, d] = isoDate.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  return new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date)
}

/** Format tanggal pendek: "14 Okt 2026". */
export function formatDateShort(isoDate) {
  if (!isoDate) return ''
  const [y, m, d] = isoDate.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date)
}

/** Label jam ramah: "09.00" -> "Pagi 09.00". */
export function formatSlotTime(time) {
  if (time === '09.00') return 'Pagi 09.00'
  if (time === '13.00') return 'Siang 13.00'
  return time
}

/** Warna badge status booking (neobrutalism pastel). */
export function statusBadgeClass(status) {
  switch (status) {
    case 'pending':
      return 'bg-warning'
    case 'confirmed':
      return 'bg-blue-200'
    case 'in_progress':
      return 'bg-brand text-white'
    case 'completed':
      return 'bg-success'
    case 'cancelled':
    case 'rejected':
      return 'bg-danger'
    case 'expired':
      return 'bg-gray-200'
    default:
      return 'bg-gray-100'
  }
}

/** Label status ramah bahasa warung. */
export function statusLabel(status) {
  switch (status) {
    case 'pending':
      return 'Menunggu Konfirmasi'
    case 'confirmed':
      return 'Dikonfirmasi'
    case 'in_progress':
      return 'Sedang Dikerjakan'
    case 'completed':
      return 'Selesai'
    case 'cancelled':
      return 'Dibatalkan'
    case 'rejected':
      return 'Ditolak'
    case 'expired':
      return 'Kedaluwarsa'
    default:
      return status
  }
}
