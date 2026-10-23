import { useCallback, useEffect, useState } from 'react'
import { api, ApiError } from '../../lib/api.js'
import { formatDateShort } from '../../lib/format.js'
import { useAuth } from '../../lib/auth.jsx'
import Modal from '../../components/Modal.jsx'
import ConfirmDialog from '../../components/ConfirmDialog.jsx'
import Banner from '../../components/Banner.jsx'

/**
 * Daftar customer admin (PRD Bab 16.3): WA, total booking, alamat default, riwayat.
 * Server-side pagination + search (D3).
 * Superadmin: edit profil + hapus permanen (T7-B2, cascade booking+alamat).
 */
export default function AdminCustomers() {
  const { user } = useAuth()
  const isSuper = user?.role === 'superadmin'

  const [rows, setRows] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [q, setQ] = useState('')
  const [sukses, setSukses] = useState('')

  const [edit, setEdit] = useState(null) // { id, name, phone_primary, phone_secondary, preferred_time }
  const [hapus, setHapus] = useState(null) // customer yang mau dihapus
  const [busy, setBusy] = useState(false)

  const muat = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const qs = new URLSearchParams({ page: String(page), limit: '20' })
      if (q) qs.set('search', q)
      const res = await api(`/admin/customers.php?${qs}`)
      setRows(res.data.data)
      setTotal(res.data.total)
      setPage(res.data.page)
      setTotalPages(res.data.totalPages)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal memuat customer.')
    } finally {
      setLoading(false)
    }
  }, [page, q])

  useEffect(() => {
    document.title = 'Customer Admin | App InDeep Booking'
  }, [])

  useEffect(() => {
    muat()
  }, [muat])

  function onCari(e) {
    e.preventDefault()
    setQ(search)
    setPage(1)
  }

  async function simpanEdit() {
    setBusy(true)
    setError('')
    setSukses('')
    try {
      await api('/admin/customers.php', {
        method: 'PATCH',
        body: JSON.stringify(edit),
      })
      setSukses(`Data ${edit.name || 'customer'} tersimpan.`)
      setEdit(null)
      await muat()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal menyimpan.')
    } finally {
      setBusy(false)
    }
  }

  async function konfirmasiHapus() {
    setBusy(true)
    setError('')
    setSukses('')
    try {
      const res = await api(`/admin/customers.php?id=${hapus.id}`, { method: 'DELETE' })
      const d = res.data || {}
      setSukses(`${hapus.name || hapus.email} dihapus. ${d.deleted_bookings ?? 0} booking & ${d.deleted_addresses ?? 0} alamat ikut terhapus.`)
      setHapus(null)
      await muat()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal menghapus.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <h2 className="mb-4 text-2xl font-extrabold">Customer</h2>

      <form onSubmit={onCari} className="card mb-4 flex flex-wrap items-end gap-3 p-4">
        <label className="block min-w-56 flex-1 text-sm font-bold">
          Cari (nama / email / WA)
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-brutal mt-1"
            placeholder="Budi / 0812…"
          />
        </label>
        <button type="submit" className="btn btn-press">Cari</button>
      </form>

      {error ? (
        <Banner variant="error" className="mb-3">{error}</Banner>
      ) : null}
      {sukses ? (
        <Banner variant="success" className="mb-3">{sukses}</Banner>
      ) : null}

      <div className="card hidden overflow-x-auto p-0 lg:block">
        <table className="w-full text-left text-sm">
          <thead className="border-b-2 border-ink bg-paper">
            <tr>
              <th className="p-3 font-extrabold">Nama</th>
              <th className="p-3 font-extrabold">Kontak</th>
              <th className="p-3 font-extrabold">Booking</th>
              <th className="p-3 font-extrabold">Alamat Utama</th>
              <th className="p-3 font-extrabold">Terakhir</th>
              {isSuper ? <th className="p-3 font-extrabold">Aksi</th> : null}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={isSuper ? 6 : 5} className="p-4 text-center text-gray-500">Memuat…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={isSuper ? 6 : 5} className="p-4 text-center text-gray-500">Tidak ada customer.</td></tr>
            ) : rows.map((c) => (
              <tr key={c.id} className="border-b border-gray-200 last:border-0">
                <td className="p-3">
                  <p className="font-bold">{c.name || '—'}</p>
                  <p className="text-xs text-gray-500">{c.email}</p>
                </td>
                <td className="p-3">{c.phone_primary || '—'}</td>
                <td className="p-3 font-bold">{c.total_bookings}</td>
                <td className="p-3">{c.default_address || '—'}</td>
                <td className="p-3">{c.last_booking ? formatDateShort(c.last_booking) : '—'}</td>
                {isSuper ? (
                  <td className="p-3">
                    <div className="flex gap-1">
                      <button
                        type="button"
                        className="rounded-lg border-2 border-ink bg-white px-2 py-0.5 text-xs font-extrabold shadow-brutal-sm transition hover:translate-x-px hover:translate-y-px hover:shadow-[2px_2px_0_0_#000000]"
                        onClick={() => setEdit({ id: c.id, name: c.name || '', phone_primary: c.phone_primary || '', phone_secondary: '', preferred_time: '' })}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="rounded-lg border-2 border-ink bg-red-50 px-2 py-0.5 text-xs font-extrabold text-red-800 hover:bg-red-100"
                        onClick={() => setHapus(c)}
                      >
                        Hapus
                      </button>
                    </div>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Cards mobile (di bawah lg) — pola sama Pricelist customer */}
      <ul className="space-y-3 lg:hidden">
        {loading ? (
          <li className="card p-4 text-center text-gray-500">Memuat…</li>
        ) : rows.length === 0 ? (
          <li className="card p-4 text-center text-gray-500">Tidak ada customer.</li>
        ) : rows.map((c) => (
          <li key={c.id} className="card p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-bold">{c.name || '—'}</p>
                <p className="truncate text-xs text-gray-500">{c.email}</p>
              </div>
              {isSuper ? (
                <div className="flex shrink-0 gap-1">
                  <button
                    type="button"
                    className="rounded-lg border-2 border-ink bg-white px-2 py-0.5 text-xs font-extrabold shadow-brutal-sm transition hover:translate-x-px hover:translate-y-px hover:shadow-[2px_2px_0_0_#000000]"
                    onClick={() => setEdit({ id: c.id, name: c.name || '', phone_primary: c.phone_primary || '', phone_secondary: '', preferred_time: '' })}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    className="rounded-lg border-2 border-ink bg-red-50 px-2 py-0.5 text-xs font-extrabold text-red-800 hover:bg-red-100"
                    onClick={() => setHapus(c)}
                  >
                    Hapus
                  </button>
                </div>
              ) : null}
            </div>
            <p className="mt-2 text-sm">{c.phone_primary || '—'}</p>
            <p className="mt-1 text-sm text-gray-600">{c.default_address || '—'}</p>
            <div className="mt-2 flex items-center justify-between text-sm">
              <span className="font-bold">{c.total_bookings} booking</span>
              <span className="text-gray-500">{c.last_booking ? formatDateShort(c.last_booking) : '—'}</span>
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="text-sm text-gray-600">Total {total} customer · Halaman {page}/{totalPages}</p>
        <div className="flex gap-2">
          <button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)} className="btn btn-press text-sm disabled:opacity-40">
            Sebelumnya
          </button>
          <button type="button" disabled={page >= totalPages} onClick={() => setPage(page + 1)} className="btn btn-press text-sm disabled:opacity-40">
            Berikutnya
          </button>
        </div>
      </div>

      {/* --- Dialog edit (berform) --- */}
      <Modal
        open={edit !== null}
        title={edit ? `Edit Customer #${edit.id}` : ''}
        onClose={() => setEdit(null)}
        busy={busy}
        footer={
          <>
            <button type="button" className="btn btn-ghost btn-press py-2" onClick={() => setEdit(null)}>Batal</button>
            <button type="button" disabled={busy} className="btn btn-cta py-2" onClick={simpanEdit}>{busy ? 'Menyimpan…' : 'Simpan'}</button>
          </>
        }
      >
        {edit ? (
          <>
            <label className="mb-2 block text-sm font-bold">
              Nama
              <input className="input-brutal mt-1" value={edit.name} maxLength={100} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
            </label>
            <label className="mb-2 block text-sm font-bold">
              WA Utama
              <input className="input-brutal mt-1" value={edit.phone_primary} maxLength={30} placeholder="0812…" onChange={(e) => setEdit({ ...edit, phone_primary: e.target.value })} />
            </label>
            <label className="mb-2 block text-sm font-bold">
              WA Cadangan
              <input className="input-brutal mt-1" value={edit.phone_secondary} maxLength={30} placeholder="opsional" onChange={(e) => setEdit({ ...edit, phone_secondary: e.target.value })} />
            </label>
            <label className="mb-4 block text-sm font-bold">
              Preferensi Jam
              <select className="input-brutal mt-1" value={edit.preferred_time} onChange={(e) => setEdit({ ...edit, preferred_time: e.target.value })}>
                <option value="">— pilih —</option>
                <option value="09.00">09.00</option>
                <option value="13.00">13.00</option>
              </select>
            </label>
          </>
        ) : null}
      </Modal>

      {/* --- Dialog hapus (konfirmasi) --- */}
      <ConfirmDialog
        open={hapus !== null}
        title={hapus ? `Hapus ${hapus.name || hapus.email}?` : ''}
        confirmLabel="Ya, Hapus Permanen"
        variant="destructive"
        busy={busy}
        onConfirm={konfirmasiHapus}
        onCancel={() => setHapus(null)}
      >
        {hapus ? (
          <>
            <p className="mb-1 text-sm text-gray-600">
              <b>{hapus.total_bookings}</b> booking dan semua alamat miliknya ikut <b>terhapus permanen</b>. Tidak bisa dibatalkan.
            </p>
            <p className="mb-4 text-sm text-gray-600">Yakin lanjut?</p>
          </>
        ) : null}
      </ConfirmDialog>
    </div>
  )
}
