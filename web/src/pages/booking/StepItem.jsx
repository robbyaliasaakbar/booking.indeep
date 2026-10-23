import { useMemo, useState } from 'react'
import { formatRupiah } from '../../lib/format.js'

/**
 * Langkah 2 — Item (PRD Bab 5.3, 5.6, 5.7):
 * cari + filter kategori + stepper qty + centang surcharge + total realtime.
 */
export default function StepItem({
  pricelist,
  surcharges,
  items,
  surChecked,
  onSetQty,
  onToggleSurcharge,
  quote,
  quoteLoading,
  quoteError,
  onRetryQuote,
  onBack,
  onNext,
}) {
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')

  // Kategori di-derive dari pricelist API (satu sumber sama Home/Pricelist) —
  // dulu hardcode 9 kategori di file ini (issue #3), bisa miss kalau SKU baru
  // nambah kategori. Urutan mengikuti urutan SKU (kelompok PRD Bab 6).
  const categories = useMemo(() => {
    const seen = []
    for (const item of pricelist) {
      if (!seen.includes(item.category)) seen.push(item.category)
    }
    return seen
  }, [pricelist])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return pricelist.filter((s) => {
      if (category && s.category !== category) return false
      if (!q) return true
      return (
        s.name.toLowerCase().includes(q) ||
        s.size.toLowerCase().includes(q) ||
        s.category.toLowerCase().includes(q)
      )
    })
  }, [pricelist, search, category])

  const itemCount = Object.values(items).filter((q) => q > 0).length
  const total = quote?.total ?? 0
  const minOrder = quote?.minOrder ?? 250000
  const gap = quote?.gapToMinimum ?? minOrder
  const below = quote ? quote.isBelowMinimum : true
  const progress = Math.min(100, Math.round((total / minOrder) * 100))

  return (
    <section className="rounded-card border-2 border-ink bg-white p-5 shadow-brutal sm:p-6">
      <h2 className="mb-1 text-xl font-extrabold">Langkah 2 — Pilih Item</h2>
      <p className="mb-5 text-sm text-gray-600">
        Harga otomatis dari daftar resmi kami. Minimal belanja {formatRupiah(minOrder)}.
      </p>

      {/* Cari + filter */}
      <div className="mb-3 flex flex-col gap-2 sm:flex-row">
        <input
          type="search"
          className="input-brutal"
          placeholder="Cari barang, ukuran…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Cari barang"
        />
        <select
          className="input-brutal font-bold"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          aria-label="Filter kategori"
        >
          <option value="">Semua kategori</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      {/* Daftar item */}
      <ul className="mb-6 divide-y-2 divide-gray-100 rounded-xl border-2 border-ink">
        {filtered.length === 0 && (
          <li className="p-4 text-center font-bold text-gray-500">
            Tidak ada barang yang cocok. Coba kata kunci lain ya.
          </li>
        )}
        {filtered.map((s) => {
          const qty = items[s.sku_id] || 0
          return (
            <li
              key={s.sku_id}
              className={[
                'flex flex-wrap items-center justify-between gap-2 p-3',
                qty > 0 ? 'bg-cta/25' : '',
              ].join(' ')}
            >
              <div className="min-w-0 flex-1">
                <p className="font-bold">
                  {s.name} <span className="font-normal text-gray-600">· {s.size}</span>
                </p>
                <p className="text-sm text-gray-600">
                  {formatRupiah(s.price)} / {s.unit}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-ink bg-white text-lg font-extrabold disabled:opacity-30"
                  onClick={() => onSetQty(s.sku_id, qty - 1)}
                  disabled={qty <= 0}
                  aria-label={`Kurangi ${s.name}`}
                >
                  −
                </button>
                <span className="w-8 text-center font-extrabold" aria-live="polite">
                  {qty}
                </span>
                <button
                  type="button"
                  className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-ink bg-cta text-lg font-extrabold disabled:opacity-30"
                  onClick={() => onSetQty(s.sku_id, Math.min(100, qty + 1))}
                  disabled={qty >= 100}
                  aria-label={`Tambah ${s.name}`}
                >
                  +
                </button>
              </div>
            </li>
          )
        })}
      </ul>

      {/* Biaya tambahan (PRD Bab 5.7, 7) */}
      <h3 className="mb-1 font-extrabold">Biaya tambahan</h3>
      <p className="mb-3 text-sm text-gray-600">
        Centang kalau relevan. Admin bisa koreksi saat konfirmasi.
      </p>
      <div className="mb-6 space-y-2">
        {surcharges.map((sc) => {
          const on = Boolean(surChecked[sc.code])
          return (
            <label
              key={sc.code}
              className={[
                'flex cursor-pointer items-start gap-3 rounded-xl border-2 border-ink p-3',
                on ? 'bg-cta/30 shadow-brutal-sm' : 'bg-white',
              ].join(' ')}
            >
              <input
                type="checkbox"
                className="mt-1 h-5 w-5 accent-[#062b3d]"
                checked={on}
                onChange={() => onToggleSurcharge(sc.code)}
              />
              <span className="text-sm">
                <span className="block font-bold">
                  {sc.title} — {formatRupiah(sc.amount)} / {sc.per}
                </span>
                {on && sc.per === 'seat' ? (
                  <span className="block font-bold text-brand">
                    {surChecked[sc.code]} seat × {formatRupiah(sc.amount)} = {formatRupiah(surChecked[sc.code] * sc.amount)}
                  </span>
                ) : null}
                <span className="text-gray-600">{sc.note}</span>
              </span>
            </label>
          )
        })}
      </div>

      {/* Ringkasan total */}
      <div className="sticky bottom-2 rounded-card border-2 border-ink bg-paper p-4 shadow-brutal" aria-live="polite">
        {quoteError ? (
          <div role="alert">
            <p className="font-extrabold text-red-700">Gagal memuat harga.</p>
            <p className="mt-1 text-sm text-gray-600">
              Jaringan atau server sedang gangguan — total di bawah belum bisa dihitung.
            </p>
            <button
              type="button"
              className="btn btn-press mt-2 py-2 text-sm"
              onClick={onRetryQuote}
            >
              Coba lagi
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between font-bold">
            <span>Total estimasi</span>
            <span className="text-xl font-extrabold">
              {quoteLoading ? 'Menghitung…' : formatRupiah(total)}
            </span>
          </div>
        )}

        {quote && (
          <>
            <div className="mt-2 h-3 overflow-hidden rounded-full border-2 border-ink bg-white">
              <div className="h-full bg-cta transition-all" style={{ width: `${progress}%` }} />
            </div>
            <p className="mt-1 text-sm font-bold">
              {below
                ? `Kurang ${formatRupiah(gap)} lagi biar bisa checkout.`
                : `Sudah tembus minimum order ✓ (${itemCount} jenis barang)`}
            </p>
          </>
        )}
      </div>

      <div className="mt-6 flex gap-3">
        <button type="button" className="btn btn-ghost btn-press flex-1 py-3" onClick={onBack}>
          Kembali
        </button>
        <button
          type="button"
          className="btn btn-cta flex-1 py-3"
          onClick={onNext}
          disabled={itemCount === 0 || below || quoteLoading || quoteError || !quote}
        >
          Lanjut — Pilih Jadwal
        </button>
      </div>
      {quoteError && itemCount > 0 ? (
        <p className="mt-2 text-center text-sm font-bold text-red-700">
          Tombol lanjut menyala lagi setelah harga berhasil dimuat.
        </p>
      ) : below && itemCount > 0 ? (
        <p className="mt-2 text-center text-sm font-bold text-red-700">
          Minimum order {formatRupiah(minOrder)}. Tambah item dulu biar tim jalan worth it.
        </p>
      ) : null}
    </section>
  )
}
