import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { api } from './api.js'

/**
 * State auth global: siapa yang login, loading, refresh, logout.
 * Session pakai cookie HttpOnly dari backend (PRD Bab 10.1) — frontend cuma
 * nanya /api/me.php, tidak pernah simpan token di localStorage.
 */

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    try {
      const res = await api('/me.php')
      setUser(res.data)
    } catch {
      // 401 = belum login (wajar). Error lain (jaringan/dsb) juga dianggap
      // belum login — dua cabang dulu yang identik digabung (issue #3).
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [])

  const logout = useCallback(async () => {
    try {
      await api('/logout.php', { method: 'POST' })
    } catch {
      // logout tetap diteruskan ke state lokal walau request gagal
    }
    setUser(null)
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const value = useMemo(
    () => ({ user, loading, refresh, logout }),
    [user, loading, refresh, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth harus dipakai di dalam AuthProvider')
  }
  return ctx
}
