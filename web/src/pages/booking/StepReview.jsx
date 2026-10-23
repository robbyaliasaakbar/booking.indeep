import { useMemo, useState } from 'react'
import { formatDate, formatRupiah, formatSlotTime } from '../../lib/format.js'

/**
 * Langkah 4 — Review (PRD Bab 9.2):
 * cek alamat, item, surcharge, total, centang setuju info latex & sofa,
 * lalu submit (harga final dicek ulang oleh server).
 */
export default function StepReview({
  me,
  items,
  pricelist,
  surChecked,
  surcharges,
  quote,
  quoteError,
  onRetryQuote,
  date,
  time,
  newAddress,
  selectedAddressId,
  submitting,
  onSubmit,
  onBack,
}) {
  const [agreed, setAgreed] = useState(false)
  const [agreeError, setAgreeError] = useState(false)

  // Klik Kirim tanpa centang = blokir + tanda jelas (customer kudet butuh
  // informasi, bukan cuma tombol diam-diam mati)
  function handleKirim() {
    if (!agreed) {
      setAgreeError(true)
      return
    }
    onSubmit()
  }

  const itemLines = useMemo(
    () =>
      Object.entries(items)
        .filter(([, qty]) => qty > 0)
        .map(([skuId, qty]) => {
          const sku = pricelist.find((p) => p.sku_id === Number(skuId))
          if (!sku) return null
          return { ...sku, qty, lineTotal: sku.price * qty }
        })
        .filter(Boolean),
    [items, pricelist]
  )

  const address = useMemo(() => {
    if (newAddress) return newAddress
    return (me?.addresses || []).find((a) => a.id === selectedAddressId) || null
  }, [newAddress, me, selectedAddressId])

  const surLines = surcharges.filter((sc) => surChecked[sc.code])

  return (
    <section className="rounded-card border-2 border-ink bg-white p-5 shadow-brutal sm:p-6">
      <h2 className="mb-1 text-xl font-extrabold">Langkah 4 — Review</h2>
      <p className="mb-5 text-sm text-gray-600">
        Cek dulu semuanya. Setelah dikirim, tim kami konfirmasi lewat WhatsApp.
      </p>

      {/* Identitas & alamat */}
      <div className="mb-5 rounded-xl border-2 border-ink p-4">
        <h3 className="mb-2 font-extrabold">Dikerjakan di</h3>
        <p className="font-bold">{me?.name}</p>
        <p className="text-sm text-gray-600">WA: {me?.phone_primary}</p>
        {me?.phone_secondary && (
          <p className="text-sm text-gray-600">WA cadangan: {me.phone_secondary}</p>
        )}
        {address && (
          <p className="mt-2 text-sm">
            {address.street_no || address.streetNo}, Kel. {address.village || address.village}, Kec.{' '}
            {address.district || address.district}, {address.city || address.city},{' '}
            {address.province || address.province}
            {(address.postal || address.postal) ? ` ${(address.postal || address.postal)}` : ''}
            {(address.note || address.note) && (
              <span className="block text-gray-600 italic">Catatan: {address.note || address.note}</span>
            )}
          </p>
        )}
      </div>

      {/* Jadwal */}
      <div className="mb-5 rounded-xl border-2 border-ink bg-cta/25 p-4">
        <h3 className="mb-1 font-extrabold">Jadwal</h3>
        <p className="font-bold">
          {formatDate(date)} — {formatSlotTime(time)}
        </p>
      </div>

      {/* Item */}
      <div className="mb-5 rounded-xl border-2 border-ink p-4">
        <h3 className="mb-2 font-extrabold">Item</h3>
        <ul className="divide-y divide-gray-100">
          {itemLines.map((it) => (
            <li key={it.sku_id} className="flex justify-between gap-3 py-2 text-sm">
              <span>
                {it.name} {it.size} × {it.qty} {it.unit}
              </span>
              <span className="font-bold">{formatRupiah(it.lineTotal)}</span>
            </li>
          ))}
        </ul>
        {surLines.length > 0 && (
          <>
            <h4 className="mt-3 font-bold">Biaya tambahan</h4>
            <ul className="divide-y divide-gray-100">
              {surLines.map((sc) => {
                // Baris WAJIB ikut qty (per-seat): satuan × qtyAffected = lineTotal.
                // Dulu cuma tampil `amount` satuan → beda dengan total di bawah (issue #6).
                const qty = surChecked[sc.code] || 1
                const lineTotal = sc.amount * qty
                return (
                  <li key={sc.code} className="flex justify-between gap-3 py-2 text-sm">
                    <span>
                      {sc.title}
                      {qty > 1 ? ` × ${qty} ` : ' '}
                      <span className="text-gray-500">
                        {qty > 1 ? `(${formatRupiah(sc.amount)} / ${sc.per})` : `/ ${sc.per}`}
                      </span>
                    </span>
                    <span className="font-bold">{formatRupiah(lineTotal)}</span>
                  </li>
                )
              })}
            </ul>
          </>
        )}
      </div>

      {/* Total */}
      <div className="mb-5 rounded-card border-2 border-ink bg-paper p-4 shadow-brutal-sm">
        {quote ? (
          <>
            <div className="flex justify-between text-sm">
              <span>Subtotal item</span>
              <span className="font-bold">{formatRupiah(quote.subtotal)}</span>
            </div>
            {quote.surchargeTotal > 0 && (
              <div className="flex justify-between text-sm">
                <span>Biaya tambahan</span>
                <span className="font-bold">{formatRupiah(quote.surchargeTotal)}</span>
              </div>
            )}
            <div className="mt-2 flex justify-between border-t-2 border-ink pt-2 text-lg font-extrabold">
              <span>Total estimasi</span>
              <span>{formatRupiah(quote.total)}</span>
            </div>
          </>
        ) : quoteError ? (
          <div role="alert">
            <p className="font-extrabold text-red-700">Gagal memuat harga.</p>
            <p className="mt-1 text-sm text-gray-600">
              Total belum bisa dihitung. Coba lagi sebentar ya.
            </p>
            <button type="button" className="btn btn-press mt-2 py-2 text-sm" onClick={onRetryQuote}>
              Coba lagi
            </button>
          </div>
        ) : (
          <p className="font-bold">Menghitung total…</p>
        )}
      </div>

      {/* Centang setuju (PRD Bab 9.2 langkah 4) — wajib, error terlihat kalau belum dicentang */}
      <div className="mb-6">
        <label
          className={`flex cursor-pointer items-start gap-3 rounded-xl border-2 bg-warning/30 p-4 ${
            agreeError ? 'border-red-700 ring-2 ring-red-400' : 'border-ink'
          }`}
        >
          <input
            type="checkbox"
            className="mt-1 h-5 w-5 accent-[#062b3d]"
            checked={agreed}
            onChange={(e) => {
              setAgreed(e.target.checked)
              if (e.target.checked) setAgreeError(false)
            }}
          />
          <span className="text-sm font-bold">
            Saya sudah paham info biaya tambahan (kasur latex, sofa lebar, sofa lepas pasang) di atas, dan
            total bisa dikoreksi tim jika temuan di lapangan berbeda.{' '}
            <span className="text-red-700">*) Wajib dicentang</span>
          </span>
        </label>
        {agreeError && (
          <p role="alert" className="mt-2 text-sm font-bold text-red-700">
            Centang dulu ya kalau sudah paham info biaya tambahan — baru pesanannya bisa dikirim.
          </p>
        )}
      </div>

      <div className="flex gap-3">
        <button type="button" className="btn btn-ghost btn-press flex-1 py-3" onClick={onBack} disabled={submitting}>
          Kembali
        </button>
        <button
          type="button"
          className="btn btn-cta flex-1 py-3"
          onClick={handleKirim}
          disabled={submitting || !quote}
        >
          {submitting ? 'Memesan…' : 'Kirim Pesanan'}
        </button>
      </div>
    </section>
  )
}
