import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, ApiError } from '../lib/api.js'
import { formatRupiah } from '../lib/format.js'
import Banner from '../components/Banner.jsx'

/**
 * Pricelist customer (PRD Bab 10.5): katalog SKU aktif, harga dari database.
 * Publik — tidak perlu login. Search + filter kategori, tabel desktop / cards mobile.
 */
export default function Pricelist() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [kategori, setKategori] = useState('')

  const muat = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await api('/pricelist.php')
      setRows(res.data)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal memuat pricelist.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    document.title = 'Pricelist | App InDeep Booking'
    muat()
  }, [muat])

  const kategoriList = useMemo(() => [...new Set(rows.map((r) => r.category))].sort(), [rows])

  const terlihat = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter((r) => {
      const cocokKategori = !kategori || r.category === kategori
      const cocokCari =
        !q ||
        r.name.toLowerCase().includes(q) ||
        r.size.toLowerCase().includes(q) ||
        r.service.toLowerCase().includes(q)
      return cocokKategori && cocokCari
    })
  }, [rows, search, kategori])

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-8">
      <header className="mb-6">
        <p className="text-sm font-bold uppercase tracking-wide text-brand">InDeepCleaningID</p>
        <h1 className="text-3xl font-extrabold">Pricelist</h1>
        <p className="mt-1 text-sm text-gray-600">
          {rows.length} layanan pencucian. Harga berdasarkan pricelist resmi InDeepCleaningID 2026.
        </p>
      </header>

      {/* --- Filter: cari (baris penuh) + kategori (baris bawah) ---
          Dulu flex-row: chips menelan lebar, input search menyusut jadi 28px
          (kelihatan kayak kotak kosong tanpa fungsi). */}
      <div className="mb-4 space-y-3">
        <label className="block">
          <span className="sr-only">Cari layanan</span>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari layanan, ukuran, contoh: sofa…"
            className="input-brutal w-full"
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setKategori('')}
            className={
              'rounded-xl border-2 border-ink px-3 py-1.5 text-sm font-extrabold shadow-[2px_2px_0_0_#000000] ' +
              (kategori === '' ? 'bg-cta' : 'bg-white')
            }
          >
            Semua
          </button>
          {kategoriList.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setKategori(k)}
              className={
                'rounded-xl border-2 border-ink px-3 py-1.5 text-sm font-extrabold shadow-[2px_2px_0_0_#000000] ' +
                (kategori === k ? 'bg-cta' : 'bg-white')
              }
            >
              {k}
            </button>
          ))}
        </div>
      </div>

      {error ? (
        <Banner
          variant="error"
          className="mb-4"
          action={
            <button type="button" className="btn btn-press mt-2 py-1.5 text-sm" onClick={muat}>
              Coba lagi
            </button>
          }
        >
          {error}
        </Banner>
      ) : null}

      {/* --- Tabel (desktop) --- */}
      <div className="card hidden overflow-x-auto p-0 lg:block">
        <table className="w-full text-left text-sm">
          <thead className="border-b-2 border-ink bg-paper">
            <tr>
              <th className="p-3 font-extrabold">Layanan</th>
              <th className="p-3 font-extrabold">Ukuran / Satuan</th>
              <th className="p-3 font-extrabold">Kategori</th>
              <th className="p-3 text-right font-extrabold">Harga</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={4} className="p-6 text-center text-gray-500">
                  Memuat katalog…
                </td>
              </tr>
            ) : terlihat.length === 0 ? (
              <tr>
                <td colSpan={4} className="p-6 text-center text-gray-500">
                  Tidak ada layanan yang cocok. Coba kata kunci lain ya.
                </td>
              </tr>
            ) : (
              terlihat.map((r) => (
                <tr key={r.sku_id} className="border-b border-gray-200 last:border-0">
                  <td className="p-3">
                    <p className="font-bold">{r.name}</p>
                    <p className="text-xs text-gray-500">{r.service}</p>
                  </td>
                  <td className="p-3">
                    {r.size} <span className="text-gray-500">/ {r.unit}</span>
                  </td>
                  <td className="p-3">
                    <span className="rounded-lg border-2 border-ink bg-paper px-2 py-0.5 text-xs font-extrabold">
                      {r.category}
                    </span>
                  </td>
                  <td className="p-3 text-right font-extrabold">{formatRupiah(r.price)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* --- Cards (mobile) --- */}
      <ul className="space-y-3 lg:hidden">
        {loading ? (
          <li className="card p-4 text-center text-gray-500">Memuat katalog…</li>
        ) : terlihat.length === 0 ? (
          <li className="card p-4 text-center text-gray-500">
            Tidak ada layanan yang cocok. Coba kata kunci lain ya.
          </li>
        ) : (
          terlihat.map((r) => (
            <li key={r.sku_id} className="card p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-extrabold">{r.name}</p>
                  <p className="text-xs text-gray-500">
                    {r.service} · {r.size} / {r.unit}
                  </p>
                  <span className="mt-1 inline-block rounded-lg border-2 border-ink bg-paper px-2 py-0.5 text-xs font-extrabold">
                    {r.category}
                  </span>
                </div>
                <p className="whitespace-nowrap text-lg font-extrabold">{formatRupiah(r.price)}</p>
              </div>
            </li>
          ))
        )}
      </ul>

      <footer className="mt-8 text-center">
        <Link to="/booking" className="btn btn-cta inline-block">
          Booking sekarang
        </Link>
        <p className="mt-2 text-xs text-gray-500">
          Harga bisa berubah sewaktu-waktu sesuai kebijakan InDeepCleaningID.
        </p>
      </footer>
    </main>
  )
}
