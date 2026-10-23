import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, ApiError } from '../../lib/api.js'
import { useListQuery } from '../../lib/useListQuery.js'
import { formatRupiah, formatDateShort, formatSlotTime, statusLabel } from '../../lib/format.js'
import { useAuth } from '../../lib/auth.jsx'
import BookingRow from '../../components/admin/BookingRow.jsx'
import Modal from '../../components/Modal.jsx'
import ConfirmDialog from '../../components/ConfirmDialog.jsx'
import Banner from '../../components/Banner.jsx'

/**
 * Booking admin (PRD Bab 16.3): tabel + filter + search + pagination server-side.
 * Aksi tulis (D1): ubah status dengan alasan + optimistic lock (version).
 * Superadmin (T7-B2): pindah jadwal (pending/confirmed) + hapus permanen.
 */

const TRANSITIONS = {
  pending: [
    { to: 'confirmed', label: 'Konfirmasi', cta: true },
    { to: 'rejected', label: 'Tolak', needReason: true },
    { to: 'cancelled', label: 'Batalkan', needReason: true },
  ],
  confirmed: [
    { to: 'in_progress', label: 'Mulai Kerjakan', cta: true },
    { to: 'cancelled', label: 'Batalkan', needReason: true },
  ],
  in_progress: [{ to: 'completed', label: 'Selesaikan', cta: true }],
}

// Tanggal lokal browser (bukan toISOString — itu UTC) buat min/max input
// pindah jadwal: hari ini s/d H+30, aturan sama dengan backend (issue #17)
function hariLokal(offsetHari = 0) {
  const d = new Date()
  d.setDate(d.getDate() + offsetHari)
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

// Guard UX Selasa (backend juga menolak — slot_assert_date_rules, issue #17)
function isSelasa(ymd) {
  return ymd !== '' && new Date(`${ymd}T00:00:00`).getDay() === 2
}

const STATUS_OPTIONS = [
  '', 'pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'rejected', 'expired',
]

export default function AdminBookings() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const isSuper = user?.role === 'superadmin'

  const [status, setStatus] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [slotTime, setSlotTime] = useState('')
  const [search, setSearch] = useState('')

  // Daftar booking + pagination + filter via hook bersama (issue #14):
  // `search` live (debounced), filter lain via tombol "Terapkan" (apply).
  const {
    rows,
    total,
    page,
    totalPages,
    loading,
    error: listError,
    setPage,
    apply,
    reload,
  } = useListQuery({
    path: '/admin/bookings.php',
    params: { status, date_from: dateFrom, date_to: dateTo, slot_time: slotTime, search },
    pageSize: 20,
    liveKeys: ['search'],
  })

  // error/success dipakai untuk pesan aksi tulis (di bawah tabel), terpisah
  // dari error pemuatan daftar (listError).
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  // dialog aksi: { booking, action }
  const [dialog, setDialog] = useState(null)
  const [alasan, setAlasan] = useState('')
  const [busy, setBusy] = useState(false)

  // dialog pindah jadwal & hapus (superadmin)
  const [move, setMove] = useState(null) // { booking, slot_date, slot_time, reason }
  const [moveError, setMoveError] = useState('')
  const [hapus, setHapus] = useState(null) // booking yang mau dihapus

  useEffect(() => {
    document.title = 'Booking Admin | App InDeep Booking'
  }, [])

  // Render HANYA satu tampilan (tabel ATAU kartu) sesuai lebar layar — dulu
  // dua-duanya selalu ter-mount (issue #7 Batch 2). Batas lg = 1024px (Tailwind).
  const [isDesktop, setIsDesktop] = useState(
    typeof window !== 'undefined' ? window.matchMedia('(min-width: 1024px)').matches : true
  )
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)')
    const onChange = (e) => setIsDesktop(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  function bukaDialog(booking, action) {
    setDialog({ booking, action })
    setAlasan('')
  }

  async function jalankanAksi() {
    if (!dialog) return
    const { booking, action } = dialog
    if (action.needReason && !alasan.trim()) {
      setError('Alasan wajib diisi ya.')
      return
    }
    setBusy(true)
    setError('')
    setSuccess('')
    try {
      await api('/admin/bookings.php', {
        method: 'PATCH',
        body: JSON.stringify({
          id: booking.id,
          status: action.to,
          reason: alasan.trim() || undefined,
          version: booking.version,
        }),
      })
      setSuccess(`Booking ${booking.code} → ${statusLabel(action.to)}.`)
      setDialog(null)
      await reload()
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setError('Booking baru diubah orang lain. Daftar dimuat ulang ya.')
        setDialog(null)
        await reload()
      } else {
        setError(err instanceof ApiError ? err.message : 'Gagal mengubah status.')
      }
    } finally {
      setBusy(false)
    }
  }

  async function simpanPindah() {
    if (!move) return
    if (!move.slot_date || !move.slot_time) {
      setMoveError('Pilih tanggal dan jam baru dulu ya.')
      return
    }
    if (isSelasa(move.slot_date)) {
      setMoveError('Selasa kami libur ya. Pilih Rabu sampai Senin.')
      return
    }
    setBusy(true)
    setMoveError('')
    setSuccess('')
    try {
      await api('/admin/bookings.php', {
        method: 'PATCH',
        body: JSON.stringify({
          id: move.booking.id,
          slot_date: move.slot_date,
          slot_time: move.slot_time,
          reason: move.reason?.trim() || undefined,
        }),
      })
      setSuccess(`Booking ${move.booking.code} dipindah ke ${move.slot_date} ${move.slot_time}.`)
      setMove(null)
      await reload()
    } catch (err) {
      setMoveError(err instanceof ApiError ? err.message : 'Gagal memindah jadwal.')
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
      await api(`/admin/bookings.php?id=${hapus.id}`, { method: 'DELETE' })
      setSuccess(`Booking ${hapus.code} dihapus permanen.`)
      setHapus(null)
      await reload()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal menghapus booking.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <h2 className="mb-4 text-2xl font-extrabold">Semua Booking</h2>

      {/* Filter */}
      <form onSubmit={(e) => { e.preventDefault(); apply() }} className="card mb-4 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-5">
        <label className="block text-sm font-bold">
          Status
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="input-brutal mt-1">
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>{s === '' ? 'Semua' : statusLabel(s)}</option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-bold">
          Dari tanggal
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="input-brutal mt-1" />
        </label>
        <label className="block text-sm font-bold">
          Sampai tanggal
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="input-brutal mt-1" />
        </label>
        <label className="block text-sm font-bold">
          Jam
          <select value={slotTime} onChange={(e) => setSlotTime(e.target.value)} className="input-brutal mt-1">
            <option value="">Semua</option>
            <option value="09.00">Pagi 09.00</option>
            <option value="13.00">Siang 13.00</option>
          </select>
        </label>
        <label className="block text-sm font-bold">
          Cari (kode/nama/WA)
          <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} className="input-brutal mt-1" placeholder="IDP-… / nama" />
        </label>
        <div className="sm:col-span-2 lg:col-span-5">
          <button type="submit" className="btn btn-press">Terapkan Filter</button>
        </div>
      </form>

      {listError || error ? (
        <Banner variant="error" className="mb-3">{listError || error}</Banner>
      ) : null}
      {success ? (
        <Banner variant="success" className="mb-3">{success}</Banner>
      ) : null}

      {/* Daftar booking — render SATU tampilan saja (issue #7 Batch 2) */}
      {isDesktop ? (
        <div className="card overflow-x-auto p-0">
          <table className="w-full text-left text-sm">
            <thead className="border-b-2 border-ink bg-paper">
              <tr>
                <th className="p-3 font-extrabold">Kode</th>
                <th className="p-3 font-extrabold">Nama</th>
                <th className="p-3 font-extrabold">Jadwal</th>
                <th className="p-3 font-extrabold">Total</th>
                <th className="p-3 font-extrabold">Status</th>
                <th className="p-3 font-extrabold">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="p-4 text-center text-gray-500">Memuat…</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={6} className="p-4 text-center text-gray-500">Tidak ada booking dengan filter ini.</td></tr>
              ) : rows.map((b) => (
                <BookingRow
                  key={b.id}
                  booking={b}
                  variant="table"
                  isSuper={isSuper}
                  transitions={TRANSITIONS[b.status] || []}
                  onOpen={() => navigate(`/admin-bookings/${b.id}/struk`)}
                  onAction={bukaDialog}
                  onMove={(bk) => { setMove({ booking: bk, slot_date: bk.slot_date, slot_time: bk.slot_time, reason: '' }); setMoveError('') }}
                  onDelete={setHapus}
                />
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="space-y-3">
          {loading ? (
            <p className="text-gray-500">Memuat…</p>
          ) : rows.length === 0 ? (
            <p className="text-gray-500">Tidak ada booking dengan filter ini.</p>
          ) : rows.map((b) => (
            <BookingRow
              key={b.id}
              booking={b}
              variant="card"
              isSuper={isSuper}
              transitions={TRANSITIONS[b.status] || []}
              onOpen={() => navigate(`/admin-bookings/${b.id}/struk`)}
              onAction={bukaDialog}
              onMove={(bk) => { setMove({ booking: bk, slot_date: bk.slot_date, slot_time: bk.slot_time, reason: '' }); setMoveError('') }}
              onDelete={setHapus}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="text-sm text-gray-600">
          Total {total} booking · Halaman {page}/{totalPages}
        </p>
        <div className="flex gap-2">
          <button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)} className="btn btn-press text-sm disabled:opacity-40">
            Sebelumnya
          </button>
          <button type="button" disabled={page >= totalPages} onClick={() => setPage(page + 1)} className="btn btn-press text-sm disabled:opacity-40">
            Berikutnya
          </button>
        </div>
      </div>

      {/* Dialog aksi (berform: alasan wajib untuk tolak/batalkan) */}
      <Modal
        open={dialog !== null}
        title={dialog ? `${dialog.action.label} — ${dialog.booking.code}` : ''}
        onClose={() => setDialog(null)}
        busy={busy}
        footer={
          <>
            <button type="button" disabled={busy} onClick={jalankanAksi} className="btn btn-cta py-2">
              {busy ? 'Menyimpan…' : dialog ? 'Ya, ' + dialog.action.label : 'Ya'}
            </button>
            <button type="button" onClick={() => setDialog(null)} className="btn btn-ghost py-2">
              Batal
            </button>
          </>
        }
      >
        {dialog ? (
          <>
            <p className="mt-1 text-sm text-gray-600">
              {dialog.booking.name} · {formatDateShort(dialog.booking.slot_date)} {formatSlotTime(dialog.booking.slot_time)}
            </p>
            {dialog.action.needReason ? (
              <label className="mt-4 block text-sm font-bold">
                Alasan <span className="text-red-600">*</span>
                <textarea
                  value={alasan}
                  onChange={(e) => setAlasan(e.target.value)}
                  rows={3}
                  className="input-brutal mt-1"
                  placeholder="Contoh: slot bentrok, customer minta reschedule…"
                />
              </label>
            ) : (
              <p className="mt-4 text-sm text-gray-600">Yakin ubah status booking ini?</p>
            )}
          </>
        ) : null}
      </Modal>

      {/* Dialog pindah jadwal (superadmin, berform) */}
      <Modal
        open={move !== null}
        title={move ? `Pindah Jadwal — ${move.booking.code}` : ''}
        onClose={() => { setMove(null); setMoveError('') }}
        busy={busy}
        footer={
          <>
            <button type="button" disabled={busy} onClick={simpanPindah} className="btn btn-cta py-2">
              {busy ? 'Memindah…' : 'Pindahkan'}
            </button>
            <button type="button" onClick={() => { setMove(null); setMoveError('') }} className="btn btn-ghost py-2">Batal</button>
          </>
        }
      >
        {move ? (
          <>
            <p className="mt-1 text-sm text-gray-600">
              Sekarang: {formatDateShort(move.booking.slot_date)} {formatSlotTime(move.booking.slot_time)}
            </p>
            <label className="mt-4 block text-sm font-bold">
              Tanggal baru
              <input
                type="date"
                value={move.slot_date}
                min={hariLokal()}
                max={hariLokal(30)}
                onChange={(e) => {
                  const v = e.target.value
                  setMove({ ...move, slot_date: v })
                  setMoveError(isSelasa(v) ? 'Selasa kami libur ya. Pilih Rabu sampai Senin.' : '')
                }}
                className="input-brutal mt-1"
              />
            </label>
            <label className="mt-3 block text-sm font-bold">
              Jam baru
              <select value={move.slot_time} onChange={(e) => setMove({ ...move, slot_time: e.target.value })} className="input-brutal mt-1">
                <option value="">— pilih —</option>
                <option value="09.00">09.00</option>
                <option value="13.00">13.00</option>
              </select>
            </label>
            <label className="mt-3 block text-sm font-bold">
              Alasan (opsional)
              <input value={move.reason} maxLength={500} onChange={(e) => setMove({ ...move, reason: e.target.value })} className="input-brutal mt-1" placeholder="Contoh: customer minta ganti hari" />
            </label>
            {moveError ? <Banner variant="error" className="mt-3">{moveError}</Banner> : null}
          </>
        ) : null}
      </Modal>

      {/* Dialog hapus permanen (superadmin, konfirmasi) */}
      <ConfirmDialog
        open={hapus !== null}
        title={hapus ? `Hapus ${hapus.code}?` : ''}
        confirmLabel="Ya, Hapus Permanen"
        variant="destructive"
        busy={busy}
        onConfirm={konfirmasiHapus}
        onCancel={() => setHapus(null)}
      >
        {hapus ? (
          <>
            <p className="mt-1 text-sm text-gray-600">
              {hapus.name} · {formatDateShort(hapus.slot_date)} {formatSlotTime(hapus.slot_time)} · {formatRupiah(hapus.total)}
            </p>
            <p className="mt-3 text-sm text-gray-600">
              Booking beserta isi barangnya dihapus <b>permanen</b>. Slotnya dibuka lagi. Riwayat audit tetap tersimpan. Tidak bisa dibatalkan.
            </p>
          </>
        ) : null}
      </ConfirmDialog>
    </div>
  )
}
