import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { api, ApiError } from './api.js'

/**
 * Hook daftar ter-paginasi dengan filter (issue #14, desain Opsi B).
 *
 * Menyatukan pola fetch yang sebelumnya diduplikasi di admin/Bookings.jsx dan
 * admin/Logs.jsx, sekaligus memperbaiki tiga masalah:
 *
 * 1. **Debounce** — key yang ada di `liveKeys` (mis. `search`) auto-apply
 *    setelah user berhenti mengetik `debounceMs` milidetik (live search).
 *    Key lain (dropdown/date) TIDAK auto-apply — nunggu `apply()` dipanggil
 *    (tombol "Terapkan"). Ini hemat request: ganti 3 filter = 1 request.
 * 2. **AbortController** — request lama di-abort begitu query berubah, dan
 *    hasil request yang sudah stale diabaikan. Mencegah race response
 *    menimpa hasil yang lebih baru.
 * 3. **Satu jalur fetch** — filter/page/apply berubah = satu efek; tombol
 *    "Terapkan" cukup memanggil `apply()`, bukan fetch manual (dulu memicu
 *    dua request: satu terbuang).
 *
 * Kontrak draft vs applied:
 * - `params` = nilai DRAFT (yang sedang diisi di form).
 * - Key di `liveKeys` berpindah draft→applied otomatis (debounced).
 * - Key lain berpindah ke applied hanya saat `apply()` dipanggil.
 *
 * @param {object} config
 * @param {string} config.path URL path relatif ke /api, mis. '/admin/bookings.php'
 * @param {object} config.params objek filter draft (mis. { status, search })
 * @param {number} [config.pageSize=20] limit per halaman
 * @param {string[]} [config.liveKeys=[]] key draft yang auto-apply (debounced)
 * @param {number} [config.debounceMs=350] durasi debounce untuk liveKeys
 * @returns {{
 *   rows: any[], total: number, page: number, totalPages: number,
 *   loading: boolean, error: string, setPage: (n: number) => void,
 *   apply: () => void, reload: () => void,
 * }}
 */
export function useListQuery({
  path,
  params,
  pageSize = 20,
  liveKeys = [],
  debounceMs = 350,
}) {
  const [rows, setRows] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPageState] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Draft params sebagai string stabil (dekatkan deps effect).
  const paramsKey = useMemo(() => JSON.stringify(params ?? {}), [params])

  // Applied filter = yang benar-benar di-fetch. Di-update oleh live-debounce
  // atau oleh apply(). Tidak pernah langsung dari `params` mentah.
  const [appliedKey, setAppliedKey] = useState(paramsKey)

  // Penanda reload manual (setelah aksi tulis) — memicu effect tanpa ubah filter.
  const [reloadTick, setReloadTick] = useState(0)

  const liveKeysKey = liveKeys.join(',')
  const liveKeysRef = useRef(liveKeys)
  liveKeysRef.current = liveKeys

  // Efek 1 — auto-apply HANYA bila yang berubah (dibanding applied) semuanya
  // termasuk liveKeys. Kalau ada perubahan key non-live, tunda sampai apply().
  useEffect(() => {
    const applied = JSON.parse(appliedKey)
    const draft = JSON.parse(paramsKey)
    const changed = Object.keys(draft).filter((k) => draft[k] !== applied[k])
    if (changed.length === 0) return

    const onlyLive = changed.every((k) => liveKeysRef.current.includes(k))
    if (!onlyLive) return // nunggu tombol "Terapkan"

    const t = setTimeout(() => setAppliedKey(paramsKey), debounceMs)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramsKey, appliedKey, debounceMs, liveKeysKey])

  // Snapshot query yang di-fetch: { filter, page }. Reset page ke 1 tiap
  // applied filter berubah — satu snapshot → satu fetch, tanpa fetch basi.
  const [query, setQuery] = useState({ filter: appliedKey, page: 1 })

  useEffect(() => {
    setQuery((q) => (q.filter === appliedKey ? q : { filter: appliedKey, page: 1 }))
  }, [appliedKey])

  const setPage = useCallback((n) => {
    setQuery((q) => {
      const next = typeof n === 'function' ? n(q.page) : n
      const page = Math.max(1, next)
      return page === q.page ? q : { ...q, page }
    })
  }, [])

  // Terapkan seluruh draft sekarang (dari tombol "Terapkan").
  const apply = useCallback(() => setAppliedKey(paramsKey), [paramsKey])

  // Paksa fetch ulang tanpa mengubah filter/page (setelah aksi tulis).
  const reload = useCallback(() => setReloadTick((t) => t + 1), [])

  // Fetch utama — satu jalur, ter-abort saat query berubah/unmount.
  useEffect(() => {
    const controller = new AbortController()
    let alive = true

    ;(async () => {
      setLoading(true)
      setError('')
      try {
        const filter = JSON.parse(query.filter)
        const qs = new URLSearchParams({ page: String(query.page), limit: String(pageSize) })
        for (const [k, v] of Object.entries(filter)) {
          // Hanya sisipkan filter yang terisi (string kosong/null/undefined dilewati)
          if (v !== '' && v !== null && v !== undefined) qs.set(k, String(v))
        }
        const res = await api(`${path}?${qs}`, { signal: controller.signal })
        if (!alive) return
        setRows(res.data.data)
        setTotal(res.data.total)
        setPageState(res.data.page)
        setTotalPages(res.data.totalPages)
      } catch (err) {
        // Abort bukan error user — diamkan (request baru sudah jalan).
        if (err?.name === 'AbortError' || !alive) return
        setError(err instanceof ApiError ? err.message : 'Gagal memuat data.')
      } finally {
        if (alive) setLoading(false)
      }
    })()

    return () => {
      alive = false
      controller.abort()
    }
  }, [path, query, pageSize, reloadTick])

  return { rows, total, page, totalPages, loading, error, setPage, apply, reload }
}

export default useListQuery
