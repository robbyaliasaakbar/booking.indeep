/**
 * Helper fetch ke backend PHP (PRD Bab 16: base /api, format JSON,
 * error baku code, message, details).
 *
 * - Selalu kirim cookie session (credentials include) — auth pakai
 *   session PHP native HttpOnly (PRD Bab 10.1).
 * - Base URL: ikut base Vite (BASE_URL). Dev '/' -> /api lewat proxy Vite;
 *   produksi '/' (subdomain booking.indeepcleaningid.site) -> /api langsung.
 *   VITE_API_URL tetap boleh diisi sebagai override bila butuh host/port lain.
 */

const BASE = (import.meta.env.VITE_API_URL || import.meta.env.BASE_URL || '/').replace(/\/+$/, '')

export class ApiError extends Error {
  constructor(message, { status = 0, code = '', details = null } = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.details = details
  }
}

/**
 * @param {string} path contoh: '/pricelist.php?category=sofa'
 * @param {RequestInit} options opsi fetch biasa (method, headers, body)
 */
export async function api(path, options = {}) {
  const res = await fetch(`${BASE}/api${path}`, {
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      ...(options.body && !(options.body instanceof FormData)
        ? { 'Content-Type': 'application/json' }
        : {}),
      ...(options.headers || {}),
    },
    ...options,
  })

  let data = null
  try {
    data = await res.json()
  } catch {
    data = null
  }

  if (!res.ok) {
    throw new ApiError(data?.message || `Permintaan gagal (HTTP ${res.status})`, {
      status: res.status,
      code: data?.code || '',
      details: data?.details ?? null,
    })
  }

  return data
}

export default api
