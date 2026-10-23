/**
 * Download struk PDF text-based (jsPDF, tanpa print dialog browser).
 *
 * jsPDF di-load DINAMIS (`import('jspdf')`) di dalam buildStrukPdf(), bukan
 * import statis di atas file. Alasannya (issue #15): import statis menyeret
 * jsPDF (~343 KB) ke bundle utama, padahal jsPDF cuma dipakai 2 halaman struk.
 * Dengan dynamic import, chunk jsPDF baru diunduh saat user benar-benar klik
 * "Download PDF".
 *
 * Keputusan Bang Rob: hasil PDF WAJIB text-based — tulisan bisa di-copy-paste
 * customer. html2pdf.js sempat dipertimbangkan tapi hasilnya raster (gambar),
 * jadi ditolak. Semua tulisan di sini pakai doc.text() → selectable.
 * Logo ditambahkan sebagai gambar PNG (boleh, yang penting tulisannya text).
 *
 * Format tanggal/jam/angka/status SEMUA import dari lib/format.js — satu
 * sumber sama dengan tampilan HTML (issue #3). Dulu ada 4 helper lokal yang
 * output-nya beda ("Rp 300.000" vs "Rp300.000").
 */
import { formatDateShort, formatRupiah, formatSlotTime, statusLabel } from './format.js'

const FONT = 'helvetica'

/** webp -> png data URL di browser (jsPDF tidak menerima webp) */
async function logoPngDataUrl() {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}brand/logo+logo-text.webp`)
    const blob = await res.blob()
    const bmp = await createImageBitmap(blob)
    const canvas = document.createElement('canvas')
    canvas.width = bmp.width
    canvas.height = bmp.height
    canvas.getContext('2d').drawImage(bmp, 0, 0)
    return canvas.toDataURL('image/png')
  } catch {
    return null
  }
}

/** Bangun dokumen jsPDF (tanpa save) — dipakai downloadStrukPdf & uji otomatis. */
export async function buildStrukPdf(booking) {
  // Dynamic import — jsPDF masuk chunk terpisah (issue #15).
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const pageW = 210
  const margin = 18
  const contentW = pageW - margin * 2
  let y = margin

  // ---------- Header ----------
  const logo = await logoPngDataUrl()
  if (logo) {
    doc.addImage(logo, 'PNG', margin, y, 55, 14)
    y += 18
  } else {
    doc.setFont(FONT, 'bold')
    doc.setFontSize(16)
    doc.text('InDeepCleaningID', margin, y + 4)
    y += 12
  }

  doc.setFont(FONT, 'normal')
  doc.setFontSize(9)
  doc.setTextColor(90)
  doc.text('Jasa cuci sofa, kasur, karpet, gordyn, interior mobil', margin, y)
  y += 6
  doc.text(`Nomor booking: ${booking.code}`, margin, y)
  y += 5
  doc.text(`Status: ${statusLabel(booking.status)}`, margin, y)
  y += 4

  // garis pemisah
  doc.setDrawColor(0)
  doc.setLineWidth(0.5)
  doc.line(margin, y, pageW - margin, y)
  y += 8

  // ---------- Pelanggan & Jadwal ----------
  doc.setTextColor(0)
  doc.setFont(FONT, 'bold')
  doc.setFontSize(10)
  doc.text('Pelanggan', margin, y)
  doc.text('Jadwal Layanan', pageW / 2, y)
  y += 5

  doc.setFont(FONT, 'normal')
  doc.setFontSize(9)
  const kiri = [
    booking.name,
    `WA: ${booking.phone_primary}`,
    booking.phone_secondary ? `WA cadangan: ${booking.phone_secondary}` : null,
  ].filter(Boolean)
  const kanan = [
    formatDateShort(booking.slot_date),
    `${formatSlotTime(booking.slot_time)} WIB`,
  ]
  let yk = y
  for (const t of kiri) {
    doc.text(t, margin, yk)
    yk += 4.5
  }
  let yb = y
  for (const t of kanan) {
    doc.text(t, pageW / 2, yb)
    yb += 4.5
  }
  y = Math.max(yk, yb) + 4

  doc.setFont(FONT, 'bold')
  doc.setFontSize(10)
  doc.text('Alamat Layanan', margin, y)
  y += 5
  doc.setFont(FONT, 'normal')
  doc.setFontSize(9)
  const a = booking.address
  for (const t of [
    `${a.street_no}, Kel. ${a.village}, Kec. ${a.district}`,
    `${a.city}, ${a.province} ${a.postal || ''}`,
    a.note ? `Catatan: ${a.note}` : null,
  ].filter(Boolean)) {
    doc.text(t, margin, y)
    y += 4.5
  }
  y += 4

  // ---------- Tabel item ----------
  const colBarang = margin
  const colQty = margin + 95
  const colHarga = margin + 120
  const colJumlah = pageW - margin
  const rata = (x, txt) => doc.text(txt, x, y, { align: 'right' })

  doc.setFont(FONT, 'bold')
  doc.setFontSize(10)
  doc.text('Barang', colBarang, y)
  doc.text('Qty', colQty, y)
  rata(colHarga, 'Harga')
  rata(colJumlah, 'Jumlah')
  y += 2
  doc.line(margin, y, pageW - margin, y)
  y += 5

  doc.setFont(FONT, 'normal')
  doc.setFontSize(9)
  const baris = [
    ...(booking.items || []).map((it) => ({
      nama: `${it.name_snapshot} ${it.size_snapshot}`.trim(),
      qty: `${Number(it.qty)} ${it.unit}`,
      harga:       formatRupiah(it.price_snapshot),
      jumlah:       formatRupiah(it.line_total),
    })),
    ...(booking.surcharges || []).map((sc) => ({
      nama: `+ ${sc.title_snapshot}`,
      qty: `${Number(sc.qty_affected)}`,
      harga:       formatRupiah(sc.amount_snapshot),
      jumlah:       formatRupiah(sc.line_total),
    })),
  ]
  for (const b of baris) {
    const namaLines = doc.splitTextToSize(b.nama, 90)
    for (let i = 0; i < namaLines.length; i++) {
      doc.text(namaLines[i], colBarang, y)
      if (i === 0) {
        doc.text(b.qty, colQty, y)
        rata(colHarga, b.harga)
        rata(colJumlah, b.jumlah)
      }
      y += 4.5
    }
  }
  doc.line(margin, y, pageW - margin, y)
  y += 8

  // ---------- Total ----------
  const totalX = pageW - margin
  doc.setFont(FONT, 'normal')
  doc.setFontSize(9)
  doc.text('Subtotal', totalX - 45, y, { align: 'left' })
  doc.text(      formatRupiah(booking.subtotal), totalX, y, { align: 'right' })
  y += 5
  doc.text('Biaya tambahan', totalX - 45, y, { align: 'left' })
  doc.text(      formatRupiah(booking.surchargeTotal), totalX, y, { align: 'right' })
  y += 7
  // garis pemisah — jarak aman dari baseline teks total (badan huruf ~4mm)
  doc.setLineWidth(0.4)
  doc.line(totalX - 55, y - 4.5, totalX, y - 4.5)
  doc.setFont(FONT, 'bold')
  doc.setFontSize(11)
  doc.text('Total estimasi', totalX - 78, y, { align: 'left' })
  doc.text(      formatRupiah(booking.total), totalX, y, { align: 'right' })
  y += 10

  // ---------- Catatan pembatalan ----------
  if (booking.cancel_reason) {
    doc.setFont(FONT, 'bold')
    doc.setFontSize(9)
    doc.text(`Dibatalkan: ${booking.cancel_reason}`, margin, y, { maxWidth: contentW })
    y += 8
  }

  // ---------- Footer ----------
  doc.setFont(FONT, 'normal')
  doc.setFontSize(8)
  doc.setTextColor(110)
  doc.text('Terima kasih sudah mempercayakan barang kesayangan Anda kepada InDeepCleaningID.', pageW / 2, 275, { align: 'center' })
  doc.text('Struk ini dibuat otomatis — harga final dikonfirmasi tim setelah inspeksi di lokasi.', pageW / 2, 280, { align: 'center' })

  return doc
}

export async function downloadStrukPdf(booking) {
  const doc = await buildStrukPdf(booking)
  doc.save(`struk-${booking.code}.pdf`)
}
