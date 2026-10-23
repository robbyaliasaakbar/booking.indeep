import { useCallback, useEffect, useState } from 'react'
import { api } from '../../lib/api.js'
import { formatRupiah } from '../../lib/format.js'
import Banner from '../../components/Banner.jsx'

/**
 * Dashboard admin (PRD Bab 16.3): booking hari ini, pending,
 * slot penuh, omzet estimasi hari ini + bulan ini.
 */
export default function AdminDashboard() {
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const muat = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await api('/admin/dashboard.php')
      setData(res.data)
    } catch (err) {
      setError(err.message || 'Gagal memuat dashboard.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    document.title = 'Dashboard Admin | App InDeep Booking'
    muat()
  }, [muat])

  if (error) {
    return (
      <div>
        <h2 className="mb-4 text-2xl font-extrabold">Dashboard</h2>
        <Banner variant="error">{error}</Banner>
        <button type="button" className="btn btn-press mt-3 py-2 text-sm" onClick={muat}>
          Coba lagi
        </button>
      </div>
    )
  }
  if (loading || !data) return <p className="text-gray-600">Memuat…</p>

  const cards = [
    { label: 'Booking Hari Ini', value: data.today_bookings, sub: 'aktif (bukan batal)' },
    { label: 'Booking Besok', value: data.tomorrow_bookings, sub: 'aktif (bukan batal)' },
    { label: 'Menunggu Konfirmasi', value: data.pending_count, sub: 'perlu ditindak' },
    { label: 'Slot Penuh Hari Ini', value: data.slots_full_today, sub: 'pagi + siang' },
    { label: 'Slot Penuh Minggu Ini', value: data.slots_full_week, sub: 'Senin–Minggu' },
    { label: 'Omzet Estimasi Hari Ini', value: formatRupiah(data.omzet_today), sub: 'confirmed → completed' },
    { label: 'Omzet Estimasi Bulan Ini', value: formatRupiah(data.omzet_month), sub: 'bulan berjalan' },
  ]

  return (
    <div>
      <h2 className="mb-4 text-2xl font-extrabold">Dashboard</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <div key={c.label} className="card p-5">
            <p className="text-sm font-bold text-gray-600">{c.label}</p>
            <p className="mt-2 text-3xl font-extrabold">{c.value}</p>
            <p className="mt-1 text-xs text-gray-500">{c.sub}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
