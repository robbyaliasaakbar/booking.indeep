import { useEffect, useMemo, useState } from 'react'
import { api } from '../../lib/api.js'
import { formatDate, formatSlotTime } from '../../lib/format.js'

/**
 * Langkah 3 — Jadwal (PRD Bab 5.4, 5.5, BR01, BR02):
 * pilih tanggal non-Selasa (maks H+30) + jam 09.00 atau 13.00,
 * status Tersedia / Penuh / Terkunci dari server.
 */
export default function StepJadwal({ date, onDate, time, onTime, onBack, onNext }) {
  const [days, setDays] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const res = await api('/availability.php')
        if (alive) setDays(res.data.days)
      } catch {
        if (alive) setError('Gagal memuat jadwal. Muat ulang halaman ya.')
      }
    })()
    return () => {
      alive = false
    }
  }, [])

  const selectedDay = useMemo(
    () => (days || []).find((d) => d.date === date) || null,
    [days, date]
  )

  if (error) {
    return (
      <section className="rounded-card border-2 border-ink bg-danger p-5 font-bold shadow-brutal">
        {error}
      </section>
    )
  }

  if (!days) {
    return (
      <section className="rounded-card border-2 border-ink bg-white p-5 shadow-brutal">
        <p className="font-bold">Memuat jadwal 30 hari ke depan…</p>
      </section>
    )
  }

  return (
    <section className="rounded-card border-2 border-ink bg-white p-5 shadow-brutal sm:p-6">
      <h2 className="mb-1 text-xl font-extrabold">Langkah 3 — Jadwal</h2>
      <p className="mb-5 text-sm text-gray-600">
        Kami buka Rabu sampai Senin. Selasa libur. Jam cuci cuma pagi 09.00 dan siang 13.00.
      </p>

      <h3 className="mb-2 font-extrabold">Pilih tanggal</h3>
      <ul className="mb-6 flex gap-2 overflow-x-auto pb-2" role="listbox" aria-label="Pilih tanggal">
        {days.map((d) => {
          const disabled = d.status === 'libur' || d.slots.every((s) => s.status !== 'tersedia')
          const selected = date === d.date
          return (
            <li key={d.date} role="option" aria-selected={selected}>
              <button
                type="button"
                disabled={disabled}
                onClick={() => {
                  onDate(d.date)
                  onTime('')
                }}
                className={[
                  'w-20 shrink-0 rounded-xl border-2 border-ink px-2 py-2 text-center text-sm',
                  selected
                    ? 'bg-cta shadow-brutal-sm'
                    : disabled
                      ? 'bg-gray-100 text-gray-400'
                      : 'bg-white hover:bg-paper',
                ].join(' ')}
                title={d.note || undefined}
              >
                <span className="block font-bold">{d.day_name.slice(0, 3)}</span>
                <span className="block text-lg font-extrabold">{Number(d.date.slice(8))}</span>
                <span className="block text-[10px] font-bold">
                  {d.status === 'libur'
                    ? 'Libur'
                    : d.slots.every((s) => s.status === 'penuh')
                      ? 'Penuh'
                      : d.slots.every((s) => s.status === 'terkunci')
                        ? 'Terkunci'
                        : 'Buka'}
                </span>
              </button>
            </li>
          )
        })}
      </ul>

      <h3 className="mb-2 font-extrabold">Pilih jam</h3>
      {!date && <p className="mb-4 text-sm text-gray-600">Pilih tanggal dulu ya.</p>}
      {date && selectedDay && (
        <div className="mb-6 flex flex-wrap gap-3">
          {selectedDay.slots.map((s) => {
            const disabled = s.status !== 'tersedia'
            const selected = time === s.time
            return (
              <button
                key={s.time}
                type="button"
                disabled={disabled}
                onClick={() => onTime(s.time)}
                className={[
                  'rounded-xl border-2 border-ink px-5 py-3 font-bold',
                  selected
                    ? 'bg-cta shadow-brutal-sm'
                    : disabled
                      ? 'bg-gray-100 text-gray-400'
                      : 'bg-white hover:bg-paper',
                ].join(' ')}
              >
                {formatSlotTime(s.time)}
                <span className="ml-2 text-xs font-normal">
                  {s.status === 'tersedia'
                    ? 'Tersedia'
                    : s.status === 'penuh'
                      ? 'Penuh'
                      : s.status === 'terkunci'
                        ? 'Lewat cutoff'
                        : 'Libur'}
                </span>
              </button>
            )
          })}
        </div>
      )}

      {date && time && (
        <p className="mb-6 rounded-xl border-2 border-ink bg-success/50 p-3 font-bold">
          Jadwal dipilih: {formatDate(date)}, {formatSlotTime(time)}
        </p>
      )}

      <div className="flex gap-3">
        <button type="button" className="btn btn-ghost btn-press flex-1 py-3" onClick={onBack}>
          Kembali
        </button>
        <button
          type="button"
          className="btn btn-cta flex-1 py-3"
          onClick={onNext}
          disabled={!date || !time}
        >
          Lanjut — Review
        </button>
      </div>
    </section>
  )
}
