import { useCallback, useEffect, useRef, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { api, ApiError } from '../lib/api.js'
import { useAuth } from '../lib/auth.jsx'
import StepIdentitas from './booking/StepIdentitas.jsx'
import StepItem from './booking/StepItem.jsx'
import StepJadwal from './booking/StepJadwal.jsx'
import StepReview from './booking/StepReview.jsx'
import StepSukses from './booking/StepSukses.jsx'

/**
 * Wizard booking 5 langkah (PRD Bab 9.2):
 * 1 Identitas -> 2 Item -> 3 Jadwal -> 4 Review -> 5 Sukses.
 * Total estimasi selalu dihitung server lewat /api/quote.php (BR07).
 */

const STEPS = ['Identitas', 'Item', 'Jadwal', 'Review', 'Sukses']

export default function Booking() {
  const { user, loading: authLoading, refresh } = useAuth()
  const navigate = useNavigate()

  const [step, setStep] = useState(1)
  const [me, setMe] = useState(null)
  const [pricelist, setPricelist] = useState([])
  const [surcharges, setSurcharges] = useState([])

  // Pilihan user
  const [items, setItems] = useState({}) // { skuId: qty }
  const [surChecked, setSurChecked] = useState({}) // { code: qtyAffected }
  const [selectedAddressId, setSelectedAddressId] = useState(null)
  const [newAddress, setNewAddress] = useState(null) // objek alamat baru, atau null
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')

  // Hasil server
  const [quote, setQuote] = useState(null)
  const [quoteLoading, setQuoteLoading] = useState(false)
  const [quoteError, setQuoteError] = useState(false)
  const [quoteNonce, setQuoteNonce] = useState(0) // naikkan untuk memicu ulang quote
  const [created, setCreated] = useState(null) // hasil booking sukses / double submit
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Idempotency key: dibuat sekali per kunjungan wizard (anti double klik, Bab 11 poin 8)
  const idemKey = useRef(
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `idem-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
  )

  // --- Guard: wajib login customer ---
  useEffect(() => {
    if (authLoading) return
    if (!user || user.role !== 'customer') return
    if (me) return
    ;(async () => {
      try {
        const res = await api('/me.php')
        setMe(res.data)
        const def = (res.data.addresses || []).find((a) => a.is_default)
        setSelectedAddressId(def ? def.id : null)
      } catch {
        setMe(user)
      }
    })()
  }, [authLoading, user, me])

  // --- Muat pricelist + surcharges sekali ---
  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const [pl, sc] = await Promise.all([api('/pricelist.php'), api('/surcharges.php')])
        if (!alive) return
        setPricelist(pl.data)
        setSurcharges(sc.data)
      } catch {
        if (alive) setError('Gagal memuat katalog. Muat ulang halaman ya.')
      }
    })()
    return () => {
      alive = false
    }
  }, [])

  // --- Quote realtime (debounce) ---
  const itemsArr = Object.entries(items)
    .filter(([, qty]) => qty > 0)
    .map(([skuId, qty]) => ({ skuId: Number(skuId), qty }))

  const surArr = Object.entries(surChecked)
    .filter(([, qty]) => qty > 0)
    .map(([code, qtyAffected]) => ({ code, qtyAffected }))

  useEffect(() => {
    if (itemsArr.length === 0) {
      setQuote(null)
      setQuoteError(false)
      return
    }
    let alive = true
    setQuoteLoading(true)
    setQuoteError(false)
    const t = setTimeout(async () => {
      try {
        const res = await api('/quote.php', {
          method: 'POST',
          body: JSON.stringify({ items: itemsArr, surcharges: surArr }),
        })
        if (alive) setQuote(res.data)
      } catch (err) {
        // Jangan diam: quote gagal = total tidak bisa dipercaya. Setel flag
        // supaya StepItem/Review menampilkan "gagal memuat harga + coba lagi",
        // bukan seolah-olah user di bawah minimum order (issue #6).
        if (alive) {
          setQuote(null)
          setQuoteError(true)
        }
      } finally {
        if (alive) setQuoteLoading(false)
      }
    }, 300)
    return () => {
      alive = false
      clearTimeout(t)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(itemsArr), JSON.stringify(surArr), quoteNonce])

  // --- Aksi ---
  // Total seat sofa di keranjang (surcharge per='seat', Opsi B — keputusan Bang Rob)
  const totalSeatSofa = useCallback(() => {
    return Object.entries(items).reduce((sum, [skuId, qty]) => {
      const sku = pricelist.find((p) => p.sku_id === Number(skuId))
      if (!sku || !sku.category.toLowerCase().startsWith('sofa')) return sum
      const m = String(sku.size).match(/(\d+)\s*seat/i)
      return sum + (m ? Number(m[1]) : 1) * qty
    }, 0)
  }, [items, pricelist])

  const setQty = useCallback((skuId, qty) => {
    setItems((prev) => {
      const next = { ...prev }
      if (qty <= 0) delete next[skuId]
      else next[skuId] = qty
      return next
    })
  }, [])

  const toggleSurcharge = useCallback((code) => {
    setSurChecked((prev) => {
      const next = { ...prev }
      if (next[code]) {
        delete next[code]
      } else {
        // Per-seat: qtyAffected otomatis = total seat sofa (min 1 biar valid)
        const sur = surcharges.find((s) => s.code === code)
        next[code] = sur?.per === 'seat' ? Math.max(totalSeatSofa(), 1) : 1
      }
      return next
    })
  }, [surcharges, totalSeatSofa])

  // Qty sofa berubah → surcharge per-seat yang sudah dicentang ikut menyesuaikan
  useEffect(() => {
    setSurChecked((prev) => {
      const next = { ...prev }
      let berubah = false
      for (const sc of surcharges) {
        if (sc.per === 'seat' && next[sc.code]) {
          const baru = Math.max(totalSeatSofa(), 1)
          if (next[sc.code] !== baru) {
            next[sc.code] = baru
            berubah = true
          }
        }
      }
      return berubah ? next : prev
    })
  }, [items, pricelist, surcharges, totalSeatSofa])

  const submitBooking = useCallback(async () => {
    setSubmitting(true)
    setError('')
    try {
      const body = {
        items: itemsArr,
        surcharges: surArr,
        date,
        time,
        idempotencyKey: idemKey.current,
        ...(newAddress ? { address: newAddress } : { addressId: selectedAddressId }),
      }
      const res = await api('/bookings-create.php', { method: 'POST', body: JSON.stringify(body) })
      setCreated(res.data)
      setStep(5)
    } catch (err) {
      if (err instanceof ApiError && err.code === 'double_submit' && err.details) {
        // Klik dobel / request ulang: tampilkan booking yang sudah tercatat
        try {
          const detail = await api(`/bookings-detail.php?id=${err.details.id}`)
          setCreated(detail.data)
          setStep(5)
        } catch {
          setError(err.message)
        }
      } else {
        setError(err.message || 'Gagal membuat booking. Coba lagi ya.')
      }
    } finally {
      setSubmitting(false)
    }
  }, [itemsArr, surArr, date, time, newAddress, selectedAddressId])

  const saveIdentitas = useCallback(
    async (payload) => {
      const res = await api('/me.php', { method: 'PATCH', body: JSON.stringify(payload) })
      setMe(res.data)
      await refresh()
      return res.data
    },
    [refresh]
  )

  // --- Guard render ---
  if (authLoading) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-16 text-center">
        <p className="font-bold">Memuat…</p>
      </main>
    )
  }
  if (!user) return <Navigate to="/login" replace />
  if (user.role !== 'customer') {
    return (
      <main className="mx-auto max-w-3xl px-4 py-16 text-center">
        <p className="font-bold">Form booking ini khusus pelanggan ya.</p>
      </main>
    )
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8">
      <h1 className="mb-2 text-2xl font-extrabold sm:text-3xl">Booking Cuci</h1>
      <p className="mb-6 text-sm text-gray-600">
        Isi 5 langkah di bawah ini. Total selalu dihitung dari harga resmi kami.
      </p>

      {/* Indikator langkah */}
      {step < 5 && (
        <ol className="mb-8 flex flex-wrap gap-2" aria-label="Langkah booking">
          {STEPS.slice(0, 4).map((label, i) => {
            const n = i + 1
            const active = step === n
            const done = step > n
            return (
              <li
                key={label}
                className={[
                  'rounded-full border-2 border-ink px-3 py-1 text-sm font-bold',
                  active ? 'bg-cta text-brand' : done ? 'bg-success' : 'bg-white text-gray-500',
                ].join(' ')}
                aria-current={active ? 'step' : undefined}
              >
                {n}. {label}
                {done ? ' ✓' : ''}
              </li>
            )
          })}
        </ol>
      )}

      {error && (
        <div
          role="alert"
          className="mb-6 rounded-card border-2 border-ink bg-danger p-4 font-bold shadow-brutal-sm"
        >
          {error}
        </div>
      )}

      {step === 1 && (
        <StepIdentitas
          me={me}
          onSave={saveIdentitas}
          selectedAddressId={selectedAddressId}
          onSelectAddress={setSelectedAddressId}
          newAddress={newAddress}
          onNewAddress={setNewAddress}
          onNext={() => setStep(2)}
        />
      )}
      {step === 2 && (
        <StepItem
          pricelist={pricelist}
          surcharges={surcharges}
          items={items}
          surChecked={surChecked}
          onSetQty={setQty}
          onToggleSurcharge={toggleSurcharge}
          quote={quote}
          quoteLoading={quoteLoading}
          quoteError={quoteError}
          onRetryQuote={() => setQuoteNonce((n) => n + 1)}
          onBack={() => setStep(1)}
          onNext={() => setStep(3)}
        />
      )}
      {step === 3 && (
        <StepJadwal
          date={date}
          onDate={setDate}
          time={time}
          onTime={setTime}
          onBack={() => setStep(2)}
          onNext={() => setStep(4)}
        />
      )}
      {step === 4 && (
        <StepReview
          me={me}
          items={items}
          pricelist={pricelist}
          surChecked={surChecked}
          surcharges={surcharges}
          quote={quote}
          quoteError={quoteError}
          onRetryQuote={() => setQuoteNonce((n) => n + 1)}
          date={date}
          time={time}
          newAddress={newAddress}
          selectedAddressId={selectedAddressId}
          submitting={submitting}
          onSubmit={submitBooking}
          onBack={() => setStep(3)}
        />
      )}
      {step === 5 && created && (
        <StepSukses
          booking={created}
          me={me}
          onNew={async () => {
            // Reset state wizard lalu tetap di halaman /booking (basename-aware),
            // biar "Mulai booking baru" beneran mulai dari nol tanpa full reload (issue #6).
            setStep(1)
            setItems({})
            setSurChecked({})
            setDate('')
            setTime('')
            setCreated(null)
            setError('')
            idemKey.current =
              typeof crypto !== 'undefined' && crypto.randomUUID
                ? crypto.randomUUID()
                : `idem-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
            const res = await api('/me.php').catch(() => null)
            if (res) setMe(res.data)
            navigate('/booking', { replace: true })
          }}
        />
      )}
    </main>
  )
}
