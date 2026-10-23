import { useCallback, useEffect, useMemo, useState } from 'react'
import { api, ApiError } from '../../lib/api.js'
import { formatRupiah } from '../../lib/format.js'
import Modal from '../../components/Modal.jsx'
import Banner from '../../components/Banner.jsx'

/**
 * Pricelist admin (PRD Bab 16.3): kelola katalog SKU dari dashboard.
 * - Tambah SKU baru (Batch 1): nama, ukuran, harga, satuan, kategori, service
 * - Edit lewat popover absolut di atas sel — tabel tidak reflow, tidak geser
 * - Urutkan kolom (klik header): SKU, Nama, Harga, Status
 * - Toggle aktif/nonaktif. Hapus permanen dilarang (PRD Bab 8) — hanya nonaktifkan.
 */
const UNITS = [
  { value: 'pcs', label: 'pcs' },
  { value: 'm2', label: 'm2' },
  { value: 'anak tangga', label: 'anak tangga' },
]

const FORM_KOSONG = { name: '', size: '', price: '', unit: 'pcs', category: '', service: 'wet clean' }

const COLUMNS = [
  // Persen dari lebar tabel — total 100%, tabel full, gak ada space kosong di kanan
  // (pembagian diminta Bang Rob: SKU 10%, Nama 40%, Harga 25%, Status 25%)
  { key: 'sku_id', label: 'SKU', cls: 'w-[10%]' },
  { key: 'name', label: 'Nama / Ukuran', cls: 'w-[40%]' },
  { key: 'price', label: 'Harga', cls: 'w-[25%]' },
  { key: 'status', label: 'Status', cls: 'w-[25%]' },
]

export default function AdminPricelist() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [edit, setEdit] = useState(null) // { id, price } | { id, info: true, name, size, unit, category }
  const [tambah, setTambah] = useState(null) // { name, size, price, unit, category, service }
  const [busy, setBusy] = useState(false)
  const [kategori, setKategori] = useState('')
  const [sort, setSort] = useState({ key: null, dir: 1 }) // dir: 1 asc, -1 desc

  const muat = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await api('/admin/pricelist.php')
      setRows(res.data.data)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal memuat pricelist.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    document.title = 'Pricelist Admin | App InDeep Booking'
    muat()
  }, [muat])

  const kategoriList = useMemo(() => [...new Set(rows.map((r) => r.category))].sort(), [rows])

  const terlihat = useMemo(() => {
    let list = kategori ? rows.filter((r) => r.category === kategori) : rows
    if (sort.key) {
      const { key, dir } = sort
      list = [...list].sort((a, b) => {
        let cmp = 0
        if (key === 'status') cmp = Number(a.is_active) - Number(b.is_active)
        else if (key === 'name') cmp = a.name.localeCompare(b.name, 'id')
        else cmp = Number(a[key]) - Number(b[key])
        return cmp * dir
      })
    }
    return list
  }, [rows, kategori, sort])

  function toggleSort(key) {
    setSort((s) => (s.key === key ? { key, dir: -s.dir } : { key, dir: 1 }))
  }

  async function kirim(method, body, pesanSukes) {
    setBusy(true)
    setError('')
    setSuccess('')
    try {
      await api('/admin/pricelist.php', { method, body: JSON.stringify(body) })
      setSuccess(pesanSukes)
      setEdit(null)
      setTambah(null)
      await muat()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal menyimpan perubahan.')
    } finally {
      setBusy(false)
    }
  }

  function simpanHarga(id, price) {
    return kirim('PATCH', { id, price: Number(price) }, 'Harga tersimpan.')
  }

  function simpanInfo(row) {
    return kirim(
      'PATCH',
      { id: row.id, name: row.name, size: row.size, unit: row.unit, category: row.category },
      'Info SKU tersimpan.'
    )
  }

  function tambahSku() {
    return kirim('POST', tambah, `SKU "${tambah.name}" ditambahkan.`)
  }

  function toggleAktif(row) {
    // Optimistic: langsung toggle di layar (smooth, tanpa reload penuh) — server disusul.
    // Kalo PATCH gagal, state balik ke semula + muncul error.
    const sebelum = rows
    setRows(rows.map((r) => (r.id === row.id ? { ...r, is_active: !r.is_active } : r)))
    setError('')
    setSuccess(row.is_active ? `${row.name} dinonaktifkan.` : `${row.name} diaktifkan.`)
    api('/admin/pricelist.php', {
      method: 'PATCH',
      body: JSON.stringify({ id: row.id, is_active: !row.is_active }),
    }).catch((err) => {
      setRows(sebelum)
      setSuccess('')
      setError(err instanceof ApiError ? err.message : 'Gagal mengubah status SKU.')
    })
  }

  // popover edit di atas sel — sel tetap selebar konten asli, tabel tidak geser
  const popoverCls =
    'absolute left-0 top-full z-20 mt-1 w-72 rounded-card border-2 border-ink bg-white p-3 shadow-brutal'

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-extrabold">Pricelist</h2>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm font-bold">
            Kategori
            <select value={kategori} onChange={(e) => setKategori(e.target.value)} className="input-brutal ml-2 mt-1 sm:mt-0">
              <option value="">Semua ({rows.length})</option>
              {kategoriList.map((k) => (
                <option key={k} value={k}>{k}</option>
              ))}
            </select>
          </label>
          <button type="button" className="btn btn-cta text-sm" onClick={() => setTambah({ ...FORM_KOSONG })}>
            + Tambah SKU
          </button>
        </div>
      </div>
      <p className="mb-4 text-sm text-gray-600">
        Hapus permanen dilarang (PRD Bab 8). Nonaktifkan saja kalau SKU mau disembunyikan dari customer.
        Klik harga atau "Edit info" buat ubah langsung, klik header kolom buat ngurutkan.
      </p>

      {error ? (
        <Banner variant="error" className="mb-3">{error}</Banner>
      ) : null}
      {success ? (
        <Banner variant="success" className="mb-3">{success}</Banner>
      ) : null}

      <div className="card hidden overflow-x-auto p-0 lg:block">
        <table className="w-full table-fixed text-left text-base">
          <thead className="border-b-2 border-ink bg-paper">
            <tr>
              {COLUMNS.map((c) => (
                <th key={c.key} className={`p-4 ${c.cls || ''}`} aria-sort={sort.key === c.key ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'}>
                  <button
                    type="button"
                    onClick={() => toggleSort(c.key)}
                    className="font-extrabold transition hover:text-brand"
                    title={`Urutkan menurut ${c.label}`}
                  >
                    {c.label}
                    <span aria-hidden="true" className="ml-1 text-xs">
                      {sort.key === c.key ? (sort.dir === 1 ? '▲' : '▼') : '↕'}
                    </span>
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} className="p-4 text-center text-gray-500">Memuat…</td></tr>
            ) : terlihat.map((r) => (
              <tr key={r.id} className={`border-b border-gray-200 transition-opacity duration-300 last:border-0 ${r.is_active ? '' : 'opacity-60'}`}>
                <td className="p-4 font-bold">{r.sku_id}</td>
                <td className="relative p-4">
                  <p className="font-bold">{r.name}</p>
                  <p className="text-sm text-gray-500">{r.size} · {r.unit} · {r.category}</p>
                  <button
                    type="button"
                    onClick={() => setEdit({ id: r.id, info: true, name: r.name, size: r.size, unit: r.unit, category: r.category })}
                    className="mt-1 text-sm font-bold underline decoration-dotted hover:text-brand"
                    title="Klik buat edit nama, ukuran, satuan, kategori"
                  >
                    Edit info
                  </button>
                  {edit?.id === r.id && edit.info ? (
                    <div className={popoverCls} role="dialog" aria-label={`Edit info ${r.name}`}>
                      <label className="mb-2 block text-sm font-bold">
                        Nama
                        <input
                          className="input-brutal mt-1 w-full"
                          value={edit.name}
                          maxLength={100}
                          onChange={(e) => setEdit({ ...edit, name: e.target.value })}
                        />
                      </label>
                      <label className="mb-2 block text-sm font-bold">
                        Ukuran
                        <input
                          className="input-brutal mt-1 w-full"
                          value={edit.size}
                          maxLength={50}
                          onChange={(e) => setEdit({ ...edit, size: e.target.value })}
                        />
                      </label>
                      <div className="mb-2 flex gap-2">
                        <label className="block flex-1 text-sm font-bold">
                          Satuan
                          <select
                            className="input-brutal mt-1 w-full"
                            value={edit.unit}
                            onChange={(e) => setEdit({ ...edit, unit: e.target.value })}
                          >
                            {UNITS.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
                          </select>
                        </label>
                        <label className="block flex-1 text-sm font-bold">
                          Kategori
                          <input
                            className="input-brutal mt-1 w-full"
                            value={edit.category}
                            maxLength={50}
                            list="kategori-datalist"
                            onChange={(e) => setEdit({ ...edit, category: e.target.value })}
                          />
                        </label>
                      </div>
                      <div className="flex gap-2">
                        <button type="button" disabled={busy} className="btn btn-cta flex-1 text-sm" onClick={() => simpanInfo(edit)}>
                          {busy ? 'Menyimpan…' : 'Simpan'}
                        </button>
                        <button type="button" className="btn btn-ghost text-sm" onClick={() => setEdit(null)}>Batal</button>
                      </div>
                    </div>
                  ) : null}
                </td>
                <td className="relative p-4">
                  <button
                    type="button"
                    onClick={() => setEdit({ id: r.id, price: String(r.price) })}
                    className="font-bold underline decoration-dotted"
                    title="Klik buat edit harga"
                  >
                    {formatRupiah(r.price)}
                  </button>
                  {edit?.id === r.id && !edit.info ? (
                    <div className={popoverCls} role="dialog" aria-label={`Edit harga ${r.name}`}>
                      <label className="mb-2 block text-sm font-bold">
                        Harga (Rp)
                        <input
                          type="number"
                          min="0"
                          className="input-brutal mt-1 w-full"
                          value={edit.price}
                          onChange={(e) => setEdit({ id: r.id, price: e.target.value })}
                        />
                      </label>
                      <div className="flex gap-2">
                        <button type="button" disabled={busy} className="btn btn-cta flex-1 text-sm" onClick={() => simpanHarga(r.id, edit.price)}>
                          {busy ? 'Menyimpan…' : 'Simpan'}
                        </button>
                        <button type="button" className="btn btn-ghost text-sm" onClick={() => setEdit(null)}>Batal</button>
                      </div>
                    </div>
                  ) : null}
                </td>
                <td className="p-4">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => toggleAktif(r)}
                    className={
                      'rounded-lg border-2 border-ink px-3 py-1 text-sm font-extrabold transition-all duration-200 hover:translate-x-px hover:translate-y-px ' +
                      (r.is_active ? 'bg-green-200' : 'bg-gray-200')
                    }
                  >
                    {r.is_active ? 'Aktif' : 'Nonaktif'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Cards mobile (di bawah lg) — read-only + toggle aktif; edit detail
          (nama/harga/kategori) tetap via tabel desktop (popover inline di sel). */}
      <ul className="space-y-3 lg:hidden">
        {loading ? (
          <li className="card p-4 text-center text-gray-500">Memuat…</li>
        ) : terlihat.map((r) => (
          <li key={r.id} className={`card p-4 ${r.is_active ? '' : 'opacity-60'}`}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-bold">{r.name}</p>
                <p className="text-sm text-gray-500">{r.sku_id} · {r.size} · {r.unit} · {r.category}</p>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => toggleAktif(r)}
                className={
                  'shrink-0 rounded-lg border-2 border-ink px-3 py-1 text-sm font-extrabold transition-all duration-200 hover:translate-x-px hover:translate-y-px ' +
                  (r.is_active ? 'bg-green-200' : 'bg-gray-200')
                }
              >
                {r.is_active ? 'Aktif' : 'Nonaktif'}
              </button>
            </div>
            <p className="mt-2 font-bold">{formatRupiah(r.price)}</p>
          </li>
        ))}
      </ul>

      <datalist id="kategori-datalist">
        {kategoriList.map((k) => <option key={k} value={k} />)}
      </datalist>

      {/* --- Dialog tambah SKU (berform) --- */}
      <Modal
        open={tambah !== null}
        title="+ Tambah SKU Baru"
        ariaLabel="Tambah SKU baru"
        onClose={() => setTambah(null)}
        busy={busy}
        footer={
          <>
            <button type="button" className="btn btn-ghost btn-press py-2" onClick={() => setTambah(null)}>Batal</button>
            <button type="button" disabled={busy} className="btn btn-cta py-2" onClick={tambahSku}>
              {busy ? 'Menyimpan…' : 'Tambah SKU'}
            </button>
          </>
        }
      >
        {tambah ? (
          <>
            <label className="mb-2 block text-sm font-bold">
              Nama Layanan *
              <input
                className="input-brutal mt-1"
                value={tambah.name}
                maxLength={100}
                placeholder="Cuci Sofa"
                onChange={(e) => setTambah({ ...tambah, name: e.target.value })}
              />
            </label>
            <label className="mb-2 block text-sm font-bold">
              Ukuran *
              <input
                className="input-brutal mt-1"
                value={tambah.size}
                maxLength={50}
                placeholder="Per Kursi / 2×3 m"
                onChange={(e) => setTambah({ ...tambah, size: e.target.value })}
              />
            </label>
            <div className="mb-2 flex gap-2">
              <label className="block flex-1 text-sm font-bold">
                Harga (Rp) *
                <input
                  type="number"
                  min="0"
                  className="input-brutal mt-1"
                  value={tambah.price}
                  placeholder="45000"
                  onChange={(e) => setTambah({ ...tambah, price: e.target.value })}
                />
              </label>
              <label className="block flex-1 text-sm font-bold">
                Satuan *
                <select
                  className="input-brutal mt-1"
                  value={tambah.unit}
                  onChange={(e) => setTambah({ ...tambah, unit: e.target.value })}
                >
                  {UNITS.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
                </select>
              </label>
            </div>
            <label className="mb-2 block text-sm font-bold">
              Kategori *
              <input
                className="input-brutal mt-1"
                value={tambah.category}
                maxLength={50}
                placeholder="Sofa / Karpet / Sprei…"
                list="kategori-datalist"
                onChange={(e) => setTambah({ ...tambah, category: e.target.value })}
              />
            </label>
            <label className="mb-4 block text-sm font-bold">
              Service
              <input
                className="input-brutal mt-1"
                value={tambah.service}
                maxLength={50}
                onChange={(e) => setTambah({ ...tambah, service: e.target.value })}
              />
            </label>
          </>
        ) : null}
      </Modal>
    </div>
  )
}
