import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, ApiError } from '../lib/api.js'
import { formatRupiah } from '../lib/format.js'

/**
 * Landing publik (PRD Bab 13 halaman `/`):
 * hero + CTA Pesan, info aturan booking, cara kerja 3 langkah,
 * katalog pricelist live dari database (BR07: harga selalu dari DB).
 */
export default function Home() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [category, setCategory] = useState('semua')

  useEffect(() => {
    document.title = 'App InDeep Booking — Pesan Cuci Sofa, Kasur, Karpet InDeepCleaningID'
  }, [])

  const muat = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await api('/pricelist.php')
      setItems(res.data)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Pricelist belum bisa dimuat. Coba lagi ya.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    muat()
  }, [muat])

  // Urutan kategori mengikuti urutan sku (sesuai kelompok PRD Bab 6)
  const categories = useMemo(() => {
    const seen = []
    for (const item of items) {
      if (!seen.includes(item.category)) seen.push(item.category)
    }
    return seen
  }, [items])

  const filtered = useMemo(
    () => (category === 'semua' ? items : items.filter((item) => item.category === category)),
    [items, category],
  )

  return (
    <>
      {/* --- Hero --- */}
      <section className="border-b-2 border-ink bg-brand text-white" aria-labelledby="judul-hero">
        <div className="mx-auto max-w-5xl px-4 py-14 sm:py-20">
          <p className="mb-3 inline-block rounded-full border-2 border-white px-3 py-1 text-sm font-bold">
            InDeepCleaningID
          </p>
          <h1 id="judul-hero" className="max-w-2xl text-3xl font-extrabold leading-tight sm:text-5xl">
            Booking cuci soft furniture, tinggal klik tanpa chat panjang.
          </h1>
          <p className="mt-4 max-w-xl text-base text-white/90 sm:text-lg">
          Pilih barangnya, sesuaikan ukurannya, dan pilih jadwalnya. Admin kami akan langsung mengonfirmasi.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/login" className="btn btn-cta py-3 text-base">
              Pesan Sekarang
            </Link>
            <a href="#katalog" className="btn btn-press bg-white py-3 text-base text-brand">
              Lihat Pricelist
            </a>
          </div>
        </div>
      </section>

      {/* --- Info aturan booking --- */}
      <section aria-label="Aturan booking" className="border-b-2 border-ink bg-white">
        <ul className="mx-auto grid max-w-5xl gap-4 px-4 py-8 sm:grid-cols-3">
          <li className="card p-5">
            <h2 className="text-lg font-extrabold">Available dari Rabu hingga Senin</h2>
            <p className="mt-1 text-sm text-gray-600">Selasa petugasnya libur dulu. Tapi booking tetep bisa dilakuin. Booking bisa sampai H+30.</p>
          </li>
          <li className="card p-5">
            <h2 className="text-lg font-extrabold">1 slot per Customer</h2>
            <p className="mt-1 text-sm text-gray-600">Jadwal pencucian cuma ada di jam 09.00 dan 13.00. Booking minimal H-7 jam.</p>
          </li>
          <li className="card p-5">
            <h2 className="text-lg font-extrabold">Minimum order Rp250.000</h2>
            <p className="mt-1 text-sm text-gray-600">Booking tanpa DP. Dibawah minimum order tidak bisa melakukan pembookingan.</p>
          </li>
        </ul>
      </section>

      {/* --- Cara kerja --- */}
      <section aria-labelledby="judul-cara" className="border-b-2 border-ink bg-paper">
        <div className="mx-auto max-w-5xl px-4 py-12">
          <h2 id="judul-cara" className="text-2xl font-extrabold sm:text-3xl">
            Pesan dalam 3 langkah
          </h2>
          <ol className="mt-6 grid gap-4 sm:grid-cols-3">
            <li className="card p-5">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border-2 border-ink bg-cta text-lg font-extrabold">
                1
              </span>
              <h3 className="mt-3 text-lg font-extrabold">Pilih barang yang mau dicuci</h3>
              <p className="mt-1 text-sm text-gray-600">Cari kategori barang dari pricelist resmi. Total estimasi jalan realtime.</p>
            </li>
            <li className="card p-5">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border-2 border-ink bg-cta text-lg font-extrabold">
                2
              </span>
              <h3 className="mt-3 text-lg font-extrabold">Pilih ukurannya</h3>
              <p className="mt-1 text-sm text-gray-600">Ukuran mempengaruhi harga, pastikan ukurannya sesuai</p>
            </li>
            <li className="card p-5">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border-2 border-ink bg-cta text-lg font-extrabold">
                3
              </span>
              <h3 className="mt-3 text-lg font-extrabold">Pilih slot jadwalnya</h3>
              <p className="mt-1 text-sm text-gray-600">Pastikan hari dan jam sudah sesuai.</p>
            </li>
          </ol>
        </div>
      </section>

      {/* --- Katalog pricelist --- */}
      <section id="katalog" aria-labelledby="judul-katalog" className="bg-white scroll-mt-16">
        <div className="mx-auto max-w-5xl px-4 py-12">
          <h2 id="judul-katalog" className="text-2xl font-extrabold sm:text-3xl">
            Pricelist Resmi
          </h2>
          <p className="mt-1 text-sm text-gray-600">Layanan wet cleaning dengan metode QDWC. Harga selalu dari database resmi.</p>

          {/* Filter kategori */}
          <div className="mt-6 flex flex-wrap gap-2" role="group" aria-label="Filter kategori">
            {['semua', ...categories].map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategory(cat)}
                aria-pressed={category === cat}
                className={[
                  'rounded-full border-2 border-ink px-3 py-1 text-sm font-bold capitalize transition',
                  category === cat ? 'bg-brand text-white shadow-brutal-sm' : 'bg-white hover:bg-paper',
                ].join(' ')}
              >
                {cat === 'semua' ? 'Semua' : cat}
              </button>
            ))}
          </div>

          {/* Hitungan hasil */}
          {!loading && !error ? (
            <p className="mt-4 text-sm font-bold text-gray-600" role="status">
              Menampilkan {filtered.length} dari {items.length} layanan
              {category !== 'semua' ? ` — kategori ${category}` : ''}.
            </p>
          ) : null}

          {/* Skeleton loading (kartu abu berkedip, PRD Bab 13 komponen wajib) */}
          {loading ? (
            <ul aria-hidden="true" className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <li key={i} className="card animate-pulse p-5">
                  <div className="h-6 w-2/3 rounded bg-gray-200" />
                  <div className="mt-3 h-4 w-1/2 rounded bg-gray-100" />
                  <div className="mt-6 h-7 w-1/3 rounded bg-gray-200" />
                </li>
              ))}
            </ul>
          ) : null}

          {/* Error + refetch tanpa reload halaman */}
          {error ? (
            <div className="card mt-8 p-6">
              <p role="alert" className="font-bold">
                {error}
              </p>
              <button type="button" onClick={muat} className="btn btn-cta mt-4">
                Coba Muat Ulang
              </button>
            </div>
          ) : null}

          {/* Grid kartu */}
          {!loading && !error && filtered.length > 0 ? (
            <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((item) => (
                <li
                  key={item.sku_id}
                  className="card flex flex-col p-5 transition hover:translate-x-px hover:translate-y-px hover:shadow-brutal-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-lg font-extrabold capitalize">{item.name}</h3>
                    <span className="shrink-0 rounded-full border-2 border-ink bg-paper px-2 py-0.5 text-xs font-bold capitalize">
                      {item.unit}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-gray-600 capitalize">Ukuran: {item.size}</p>
                  <p className="mt-auto pt-4 text-xl font-extrabold text-brand">{formatRupiah(item.price)}</p>
                </li>
              ))}
            </ul>
          ) : null}

          {!loading && !error && filtered.length === 0 ? (
            <p className="mt-8 text-gray-600">Belum ada layanan di kategori ini.</p>
          ) : null}
        </div>
      </section>

      {/* --- CTA penutup --- */}
      <section aria-label="Pesan sekarang" className="border-t-2 border-ink bg-paper">
        <div className="mx-auto max-w-5xl px-4 py-12 text-center">
          <h2 className="text-2xl font-extrabold sm:text-3xl">Jangan sampai niat mau bersihin, malah bikin furniture rusak 🥰</h2>
          <p className="mx-auto mt-2 max-w-md text-gray-600">
            Booking sendiri kurang dari 5 menit. Cuci Kasur Mulai dari Rp150.000,- dengan minimum order Rp250.000,- tanpa drama tawar-menawar.
          </p>
          <Link to="/login" className="btn btn-cta mt-6 py-3 text-base">
            Pesan Sekarang
          </Link>
        </div>
      </section>
    </>
  )
}
