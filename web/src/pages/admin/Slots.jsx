import { useCallback, useEffect, useState } from 'react'
import { api, ApiError } from '../../lib/api.js'
import Modal from '../../components/Modal.jsx'
import ConfirmDialog from '../../components/ConfirmDialog.jsx'
import Banner from '../../components/Banner.jsx'
import { formatDate, formatSlotTime } from '../../lib/format.js'
import { useAuth } from '../../lib/auth.jsx'

/**
 * Kalender slot admin (PRD Bab 16.3): grid 30 hari per jam.
 * Hijau = tersedia, merah = penuh, abu = libur/terkunci.
 * Aksi tulis (D1): kunci/buka + ubah kapasitas via panel.
 * Superadmin (T7-B2): tambah slot manual + hapus slot kosong.
 */

function hariIndo(iso) {
  const names = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']
  const [y, m, d] = iso.split('-').map(Number)
  return names[new Date(y, m - 1, d).getDay()]
}

function cellClass(s) {
  if (s.is_locked) return 'bg-gray-300'
  if (s.booked >= s.capacity) return 'bg-red-300'
  return 'bg-green-200'
}

function cellLabel(s) {
  if (s.is_locked) return 'Terkunci'
  if (s.booked >= s.capacity) return 'Penuh'
  return 'Tersedia'
}

export default function AdminSlots() {
  const { user } = useAuth()
  const isSuper = user?.role === 'superadmin'

  const [slots, setSlots] = useState([])
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [pilih, setPilih] = useState(null) // slot terpilih untuk aksi
  const [kapasitas, setKapasitas] = useState('')
  const [busy, setBusy] = useState(false)

  // form tambah slot manual (superadmin)
  const [tambah, setTambah] = useState(null) // { slot_date, slot_time, capacity }
  const [hapus, setHapus] = useState(null) // slot yang mau dihapus

  const muat = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await api('/admin/slots.php')
      setSlots(res.data.data)
      setFrom(res.data.from)
      setTo(res.data.to)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal memuat slot.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    document.title = 'Kalender Slot Admin | App InDeep Booking'
    muat()
  }, [muat])

  // Kelompokkan per tanggal
  const perTanggal = {}
  for (const s of slots) {
    if (!perTanggal[s.slot_date]) perTanggal[s.slot_date] = {}
    perTanggal[s.slot_date][s.slot_time] = s
  }
  const tanggalList = Object.keys(perTanggal).sort()

  function bukaAksi(s) {
    setPilih(s)
    setKapasitas(String(s.capacity))
    setError('')
  }

  async function simpanAksi(body) {
    setBusy(true)
    setError('')
    setSuccess('')
    try {
      await api('/admin/slots.php', { method: 'PATCH', body: JSON.stringify(body) })
      setSuccess('Slot diperbarui.')
      setPilih(null)
      await muat()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal memperbarui slot.')
    } finally {
      setBusy(false)
    }
  }

  async function simpanTambah() {
    if (!tambah?.slot_date || !tambah?.slot_time) {
      setError('Pilih tanggal dan jam dulu ya.')
      return
    }
    setBusy(true)
    setError('')
    setSuccess('')
    try {
      await api('/admin/slots.php', { method: 'POST', body: JSON.stringify(tambah) })
      setSuccess(`Slot ${tambah.slot_date} ${tambah.slot_time} ditambahkan.`)
      setTambah(null)
      await muat()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal menambah slot.')
    } finally {
      setBusy(false)
    }
  }

  async function konfirmasiHapus() {
    if (!hapus) return
    setBusy(true)
    setError('')
    setSuccess('')
    try {
      await api(`/admin/slots.php?id=${hapus.id}`, { method: 'DELETE' })
      setSuccess(`Slot ${hapus.slot_date} ${hapus.slot_time} dihapus.`)
      setHapus(null)
      setPilih(null)
      await muat()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal menghapus slot.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-extrabold">Kalender Slot</h2>
        <div className="flex items-center gap-3">
          {isSuper ? (
            <button
              type="button"
              onClick={() => setTambah({ slot_date: '', slot_time: '09.00', capacity: 1 })}
              className="btn btn-cta text-sm"
            >
              + Tambah Slot
            </button>
          ) : null}
          <p className="text-sm text-gray-600">
            {from && to ? `${formatDate(from)} – ${formatDate(to)}` : 'Memuat…'}
          </p>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-3 text-sm font-bold">
        <span className="flex items-center gap-1"><span className="h-4 w-4 rounded border-2 border-ink bg-green-200" /> Tersedia</span>
        <span className="flex items-center gap-1"><span className="h-4 w-4 rounded border-2 border-ink bg-red-300" /> Penuh</span>
        <span className="flex items-center gap-1"><span className="h-4 w-4 rounded border-2 border-ink bg-gray-300" /> Terkunci</span>
        <span className="flex items-center gap-1"><span className="h-4 w-4 rounded border-2 border-ink bg-white" /> Selasa (libur)</span>
      </div>

      {error ? (
        <Banner variant="error" className="mb-3">{error}</Banner>
      ) : null}
      {success ? (
        <Banner variant="success" className="mb-3">{success}</Banner>
      ) : null}

      {loading ? (
        <p className="text-gray-600">Memuat…</p>
      ) : (
        <>
        <div className="card hidden overflow-x-auto p-0 lg:block">
          <table className="w-full text-sm">
            <thead className="border-b-2 border-ink bg-paper">
              <tr>
                <th className="p-3 text-left font-extrabold">Tanggal</th>
                <th className="p-3 text-left font-extrabold">Pagi 09.00</th>
                <th className="p-3 text-left font-extrabold">Siang 13.00</th>
              </tr>
            </thead>
            <tbody>
              {tanggalList.map((tgl) => {
                const isSelasa = hariIndo(tgl) === 'Selasa'
                return (
                  <tr key={tgl} className="border-b border-gray-200 last:border-0">
                    <td className="p-3">
                      <p className="font-bold">{formatDate(tgl)}</p>
                      <p className="text-xs text-gray-500">{hariIndo(tgl)}</p>
                    </td>
                    {['09.00', '13.00'].map((jam) => {
                      if (isSelasa) {
                        return (
                          <td key={jam} className="p-3">
                            <span className="inline-block rounded-lg border-2 border-ink bg-white px-3 py-1 text-xs font-bold text-gray-400">
                              Libur (Selasa)
                            </span>
                          </td>
                        )
                      }
                      const s = perTanggal[tgl]?.[jam]
                      if (!s) {
                        return <td key={jam} className="p-3 text-gray-400">—</td>
                      }
                      return (
                        <td key={jam} className="p-3">
                          <button
                            type="button"
                            onClick={() => bukaAksi(s)}
                            className={`rounded-lg border-2 border-ink px-3 py-1 text-left text-xs font-bold shadow-brutal-sm transition hover:translate-x-px hover:translate-y-px ${cellClass(s)}`}
                          >
                            <p>{cellLabel(s)}</p>
                            <p className="font-normal">{s.booked}/{s.capacity} terisi</p>
                          </button>
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Cards mobile — per tanggal, 2 tombol slot (pola sama daftar admin lain) */}
        <ul className="space-y-3 lg:hidden">
          {tanggalList.map((tgl) => {
            const isSelasa = hariIndo(tgl) === 'Selasa'
            return (
              <li key={tgl} className="card p-4">
                <p className="font-bold">{formatDate(tgl)}</p>
                <p className="text-xs text-gray-500">{hariIndo(tgl)}</p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {['09.00', '13.00'].map((jam) => {
                    if (isSelasa) {
                      return (
                        <span key={jam} className="rounded-lg border-2 border-ink bg-white px-3 py-2 text-center text-xs font-bold text-gray-400">
                          Libur (Selasa)
                        </span>
                      )
                    }
                    const s = perTanggal[tgl]?.[jam]
                    if (!s) {
                      return <span key={jam} className="px-3 py-2 text-center text-gray-400">—</span>
                    }
                    return (
                      <button
                        key={jam}
                        type="button"
                        onClick={() => bukaAksi(s)}
                        className={`rounded-lg border-2 border-ink px-3 py-2 text-left text-xs font-bold shadow-brutal-sm transition hover:translate-x-px hover:translate-y-px ${cellClass(s)}`}
                      >
                        <p>{formatSlotTime(jam)}</p>
                        <p>{cellLabel(s)} · {s.booked}/{s.capacity}</p>
                      </button>
                    )
                  })}
                </div>
              </li>
            )
          })}
        </ul>
        </>
      )}

      {/* Panel aksi slot (berform: kapasitas + kunci) */}
      <Modal
        open={pilih !== null}
        title={pilih ? `${formatDate(pilih.slot_date)} — ${formatSlotTime(pilih.slot_time)}` : ''}
        onClose={() => setPilih(null)}
        busy={busy}
        footer={pilih ? (
          <>
            <button
              type="button"
              disabled={busy || Number(kapasitas) < pilih.booked || Number(kapasitas) === pilih.capacity}
              onClick={() => simpanAksi({ id: pilih.id, capacity: Number(kapasitas), is_locked: pilih.is_locked })}
              className="btn btn-cta py-2"
            >
              {busy ? 'Menyimpan…' : 'Simpan Kapasitas'}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => simpanAksi({ id: pilih.id, is_locked: !pilih.is_locked })}
              className="btn btn-press py-2"
            >
              {pilih.is_locked ? 'Buka Kunci' : 'Kunci Slot'}
            </button>
            {isSuper && pilih.booked === 0 ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => setHapus(pilih)}
                className="btn border-red-700 bg-red-50 text-red-800 hover:bg-red-100 py-2"
              >
                Hapus Slot
              </button>
            ) : null}
            <button type="button" onClick={() => setPilih(null)} className="btn btn-ghost py-2">
              Tutup
            </button>
          </>
        ) : null}
      >
        {pilih ? (
          <>
            <p className="mt-1 text-sm text-gray-600">
              Terisi {pilih.booked}/{pilih.capacity} · {cellLabel(pilih)}
            </p>
            <label className="mt-4 block text-sm font-bold">
              Kapasitas
              <input
                type="number"
                min={Math.max(1, pilih.booked)}
                value={kapasitas}
                onChange={(e) => setKapasitas(e.target.value)}
                className="input-brutal mt-1"
              />
            </label>
            {Number(kapasitas) < pilih.booked ? (
              <p className="mt-1 text-xs font-bold text-red-600">
                Tidak boleh kurang dari {pilih.booked} yang sudah terisi.
              </p>
            ) : null}
          </>
        ) : null}
      </Modal>

      {/* Dialog tambah slot manual (superadmin, berform) */}
      <Modal
        open={tambah !== null}
        title="Tambah Slot Manual"
        onClose={() => setTambah(null)}
        busy={busy}
        footer={
          <>
            <button type="button" disabled={busy} onClick={simpanTambah} className="btn btn-cta py-2">
              {busy ? 'Menyimpan…' : 'Tambah Slot'}
            </button>
            <button type="button" onClick={() => setTambah(null)} className="btn btn-ghost py-2">Batal</button>
          </>
        }
      >
        {tambah ? (
          <>
            <p className="mt-1 text-sm text-gray-600">Selasa libur mutlak. Jam hanya 09.00 / 13.00.</p>
            <label className="mt-4 block text-sm font-bold">
              Tanggal
              <input type="date" value={tambah.slot_date} onChange={(e) => setTambah({ ...tambah, slot_date: e.target.value })} className="input-brutal mt-1" />
            </label>
            <label className="mt-3 block text-sm font-bold">
              Jam
              <select value={tambah.slot_time} onChange={(e) => setTambah({ ...tambah, slot_time: e.target.value })} className="input-brutal mt-1">
                <option value="09.00">09.00</option>
                <option value="13.00">13.00</option>
              </select>
            </label>
            <label className="mt-3 block text-sm font-bold">
              Kapasitas (1-50)
              <input type="number" min={1} max={50} value={tambah.capacity} onChange={(e) => setTambah({ ...tambah, capacity: Number(e.target.value) })} className="input-brutal mt-1" />
            </label>
          </>
        ) : null}
      </Modal>

      {/* Dialog hapus slot (superadmin, konfirmasi) */}
      <ConfirmDialog
        open={hapus !== null}
        title="Hapus Slot?"
        confirmLabel="Ya, Hapus"
        variant="destructive"
        busy={busy}
        onConfirm={konfirmasiHapus}
        onCancel={() => setHapus(null)}
      >
        {hapus ? (
          <>
            <p className="mt-1 text-sm text-gray-600">
              {formatDate(hapus.slot_date)} {formatSlotTime(hapus.slot_time)} · {hapus.booked}/{hapus.capacity} terisi.
            </p>
            <p className="mt-3 text-sm text-gray-600">
              Hanya slot kosong yang bisa dihapus. Kalau hari itu masih dibutuhkan, buat lagi lewat Tambah Slot.
            </p>
          </>
        ) : null}
      </ConfirmDialog>
    </div>
  )
}
