import { useCallback, useEffect, useState } from 'react'
import { api, ApiError } from '../../lib/api.js'
import { formatRupiah, formatDateShort, statusLabel } from '../../lib/format.js'
import Banner from '../../components/Banner.jsx'

/**
 * Laporan omzet estimasi (PRD Bab 16.3) — HAK SUPERADMIN.
 * Omzet = SUM(total) booking completed (D2: stat + tabel, tanpa chart).
 */
export default function AdminReports() {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const muat = useCallback(async (f, t) => {
    setLoading(true)
    setError('')
    try {
      const qs = new URLSearchParams()
      if (f) qs.set('from', f)
      if (t) qs.set('to', t)
      const res = await api(`/admin/reports.php?${qs}`)
      setData(res.data)
      setFrom(res.data.from)
      setTo(res.data.to)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal memuat laporan.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    document.title = 'Laporan Admin | App InDeep Booking'
    muat()
  }, [muat])

  function onFilter(e) {
    e.preventDefault()
    muat(from, to)
  }

  if (error) {
    return (
      <div>
        <h2 className="mb-4 text-2xl font-extrabold">Laporan Omzet</h2>
        <Banner variant="error">{error}</Banner>
        <button type="button" className="btn btn-press mt-3 py-2 text-sm" onClick={() => muat(from, to)}>
          Coba lagi
        </button>
      </div>
    )
  }

  return (
    <div>
      <h2 className="mb-4 text-2xl font-extrabold">Laporan Omzet Estimasi</h2>
      <p className="mb-4 text-sm text-gray-600">
        Omzet dihitung dari booking berstatus <strong>Dikonfirmasi</strong>,{' '}
        <strong>Sedang Dikerjakan</strong>, dan <strong>Selesai</strong> (definisi sama
        dengan dashboard). Hak superadmin.
      </p>

      <form onSubmit={onFilter} className="card mb-4 flex flex-wrap items-end gap-3 p-4">
        <label className="block text-sm font-bold">
          Dari
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="input-brutal mt-1" />
        </label>
        <label className="block text-sm font-bold">
          Sampai
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="input-brutal mt-1" />
        </label>
        <button type="submit" className="btn btn-press">Tampilkan</button>
      </form>

      {loading || !data ? (
        <p className="text-gray-600">Memuat…</p>
      ) : (
        <>
          <div className="mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="card p-5">
              <p className="text-sm font-bold text-gray-600">Omzet Estimasi</p>
              <p className="mt-2 text-3xl font-extrabold">{formatRupiah(data.omzet_estimasi)}</p>
              <p className="mt-1 text-xs text-gray-500">confirmed → completed</p>
            </div>
            <div className="card p-5">
              <p className="text-sm font-bold text-gray-600">Omzet Selesai</p>
              <p className="mt-2 text-3xl font-extrabold">{formatRupiah(data.omzet_completed)}</p>
              <p className="mt-1 text-xs text-gray-500">status completed saja</p>
            </div>
            <div className="card p-5">
              <p className="text-sm font-bold text-gray-600">Total Booking (semua status)</p>
              <p className="mt-2 text-3xl font-extrabold">{data.total_count}</p>
            </div>
            <div className="card p-5">
              <p className="text-sm font-bold text-gray-600">Nilai Semua Status</p>
              <p className="mt-2 text-3xl font-extrabold">{formatRupiah(data.total_omzet_all_status)}</p>
              <p className="mt-1 text-xs text-gray-500">termasuk batal (bukan omzet)</p>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="card p-4">
              <h3 className="mb-3 font-extrabold">Per Status</h3>
              {/* overflow-x-auto — "Nilai" Rupiah panjang bisa luber di HP (issue #3) */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b-2 border-ink">
                    <tr>
                      <th className="p-2 font-bold">Status</th>
                      <th className="p-2 font-bold">Jumlah</th>
                      <th className="p-2 font-bold">Nilai</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.by_status.length === 0 ? (
                      <tr><td colSpan={3} className="p-3 text-gray-500">Tidak ada data.</td></tr>
                    ) : data.by_status.map((s) => (
                      <tr key={s.status} className="border-b border-gray-200 last:border-0">
                        <td className="p-2 font-bold">{statusLabel(s.status)}</td>
                        <td className="p-2">{s.count}</td>
                        <td className="p-2">{formatRupiah(s.omzet)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="card p-4">
              <h3 className="mb-3 font-extrabold">Harian (Omzet)</h3>
              {/* overflow-x+y-auto — daftar panjang scroll vertikal; kolom angka aman di HP */}
              <div className="max-h-80 overflow-auto">
                <table className="w-full text-left text-sm">
                  <thead className="sticky top-0 border-b-2 border-ink bg-white">
                    <tr>
                      <th className="p-2 font-bold">Tanggal</th>
                      <th className="p-2 font-bold">Jumlah</th>
                      <th className="p-2 font-bold">Omzet</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.daily.length === 0 ? (
                      <tr><td colSpan={3} className="p-3 text-gray-500">Belum ada booking beromzet di rentang ini.</td></tr>
                    ) : data.daily.map((d) => (
                      <tr key={d.slot_date} className="border-b border-gray-200 last:border-0">
                        <td className="p-2">{formatDateShort(d.slot_date)}</td>
                        <td className="p-2">{d.count}</td>
                        <td className="p-2 font-bold">{formatRupiah(d.omzet)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
