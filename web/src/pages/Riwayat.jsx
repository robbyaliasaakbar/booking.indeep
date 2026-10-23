import { useCallback, useEffect, useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { api, ApiError } from '../lib/api.js'
import { useAuth } from '../lib/auth.jsx'
import Modal from '../components/Modal.jsx'
import { formatDateShort, formatRupiah, formatSlotTime, statusBadgeClass, statusLabel } from '../lib/format.js'
import HubungiAdmin from '../components/HubungiAdmin.jsx'
import Banner from '../components/Banner.jsx'

/**
 * Riwayat booking milik sendiri (PRD Bab 9.3, BR09, BR10):
 * daftar + batalkan (pending/confirmed, sebelum hari H) dengan alasan wajib.
 */
export default function Riwayat() {
  const { user, loading, logout } = useAuth()
  const navigate = useNavigate()
  const [bookings, setBookings] = useState(null)
  const [error, setError] = useState('')
  const [cancelTarget, setCancelTarget] = useState(null) // booking yang mau dibatalkan
  const [reason, setReason] = useState('')
  const [cancelError, setCancelError] = useState('')
  const [canceling, setCanceling] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await api('/bookings-mine.php')
      setBookings(res.data)
    } catch (err) {
      setError(err.message || 'Gagal memuat riwayat. Coba lagi ya.')
      setBookings([])
    }
  }, [])

  useEffect(() => {
    if (user?.role === 'customer') load()
  }, [user, load])

  const canCancel = (b) => {
    if (!['pending', 'confirmed'].includes(b.status)) return false
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const [y, m, d] = b.slot_date.split('-').map(Number)
    const slotDay = new Date(y, m - 1, d)
    return slotDay > today
  }

  const submitCancel = async () => {
    if (reason.trim().length < 3) {
      setCancelError('Tulis alasan pembatalan dulu ya, minimal beberapa huruf.')
      return
    }
    setCanceling(true)
    setCancelError('')
    try {
      await api('/bookings-cancel.php', {
        method: 'POST',
        body: JSON.stringify({ id: cancelTarget.id, reason: reason.trim() }),
      })
      setCancelTarget(null)
      setReason('')
      await load()
    } catch (err) {
      setCancelError(err.message || 'Gagal membatalkan. Coba lagi ya.')
    } finally {
      setCanceling(false)
    }
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-16 text-center font-bold">Memuat…</main>
    )
  }
  if (!user) return <Navigate to="/login" replace />

  // Session sedang dipakai role admin/superadmin (mis. habis konfirmasi booking
  // di panel admin pada browser yang sama). Jangan stuck "Memuat…" — kasih tahu.
  if (user.role !== 'customer') {
    return (
      <main className="mx-auto max-w-3xl px-4 py-16 text-center">
        <div className="rounded-card border-2 border-dashed border-ink bg-white p-8">
          <p className="mb-2 text-lg font-extrabold">Kamu sedang login sebagai {user.role === 'superadmin' ? 'superadmin' : 'admin'}.</p>
          <p className="mb-4 text-sm text-gray-600">
            Halaman riwayat ini khusus akun customer. Logout dulu dari akun tim, lalu login
            sebagai customer (akun Google atau email) untuk melihat riwayat booking kamu.
          </p>
          <button
            type="button"
            className="btn btn-cta px-5 py-2"
            onClick={() => {
              logout().finally(() => navigate('/login', { replace: true }))
            }}
          >
            Logout & Login Ulang
          </button>
        </div>
      </main>
    )
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold sm:text-3xl">Riwayat Booking</h1>
        <Link to="/booking" className="btn btn-cta px-4 py-2 text-sm">
          + Booking Baru
        </Link>
      </div>

      {error && (
        <Banner variant="error" className="mb-4">
          {error}
        </Banner>
      )}

      {bookings === null && <p className="font-bold">Memuat riwayat…</p>}

      {bookings !== null && bookings.length === 0 && (
        <div className="rounded-card border-2 border-dashed border-ink bg-white p-8 text-center">
          <p className="mb-2 font-extrabold">Belum ada booking.</p>
          <p className="mb-4 text-sm text-gray-600">
            Saatnya cuci kasur atau sofa — kami tunggu di jadwal pilihanmu.
          </p>
          <Link to="/booking" className="btn btn-cta inline-block px-5 py-2">
            Mulai Booking
          </Link>
        </div>
      )}

      {bookings !== null && bookings.length > 0 && (
        <ul className="space-y-3">
          {bookings.map((b) => (
            <li
              key={b.id}
              role="link"
              tabIndex={0}
              aria-label={`Detail booking ${b.code}`}
              className="cursor-pointer rounded-card border-2 border-ink bg-white p-4 shadow-brutal-sm transition hover:bg-paper hover:shadow-brutal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              onClick={() => navigate(`/riwayat/${b.id}`)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  navigate(`/riwayat/${b.id}`)
                }
              }}
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-extrabold tracking-wide">{b.code}</p>
                  <p className="text-sm text-gray-600">
                    {formatDateShort(b.slot_date)} — {formatSlotTime(b.slot_time)} ·{' '}
                    {b.item_count} jenis barang
                  </p>
                </div>
                <span
                  className={`rounded-full border-2 border-ink px-3 py-1 text-xs font-bold ${statusBadgeClass(b.status)}`}
                >
                  {statusLabel(b.status)}
                </span>
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <p className="text-lg font-extrabold">{formatRupiah(b.total)}</p>
                <div className="flex gap-2">
                  <Link
                    to={`/riwayat/${b.id}/struk`}
                    className="btn btn-press px-3 py-1 text-sm"
                    onClick={(e) => e.stopPropagation()}
                  >
                    Struk
                  </Link>
                  {canCancel(b) && (
                    <button
                      type="button"
                      className="btn border-red-700 bg-red-50 px-3 py-1 text-sm text-red-800 hover:bg-red-100"
                      onClick={(e) => {
                        e.stopPropagation()
                        setCancelTarget(b)
                        setReason('')
                        setCancelError('')
                      }}
                    >
                      Batalkan
                    </button>
                  )}
                </div>
              </div>

              {b.status === 'pending' && (
                <HubungiAdmin bookingCode={b.code} className="mt-3" />
              )}
            </li>
          ))}
        </ul>
      )}

      {/* Dialog batal (berform: alasan wajib) */}
      <Modal
        open={cancelTarget !== null}
        title={cancelTarget ? `Batalkan ${cancelTarget.code}?` : ''}
        onClose={() => setCancelTarget(null)}
        busy={canceling}
        footer={
          <>
            <button type="button" className="btn btn-ghost btn-press py-2" onClick={() => setCancelTarget(null)}>
              Kembali
            </button>
            <button
              type="button"
              className="btn border-red-700 bg-red-600 py-2 text-white hover:bg-red-700"
              onClick={submitCancel}
              disabled={canceling}
            >
              {canceling ? 'Membatalkan…' : 'Ya, Batalkan'}
            </button>
          </>
        }
      >
        {cancelTarget ? (
          <>
            <p className="mb-3 text-sm text-gray-600">
              Slotnya otomatis dibuka lagi untuk pelanggan lain. Tulis alasan ya.
            </p>
            <textarea
              className="input-brutal mb-3 p-3"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Contoh: jadwal berubah, ada tamu datang"
              maxLength={500}
              autoFocus
            />
            {cancelError && (
              <p role="alert" className="mb-3 font-bold text-red-700">
                {cancelError}
              </p>
            )}
          </>
        ) : null}
      </Modal>
    </main>
  )
}
