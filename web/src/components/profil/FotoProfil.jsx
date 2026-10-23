/**
 * FotoProfil — panel upload/ganti/hapus foto profil (issue #7 Batch 3).
 * Dipisah dari Profil.jsx biar halaman tinggal menyusun panel.
 */

import { useRef, useState } from 'react'
import { api, ApiError } from '../../lib/api.js'

const MAX_BYTES = 2 * 1024 * 1024

export default function FotoProfil({ user, onBerubah, onError, onSuccess }) {
  const fileRef = useRef(null)
  const [uploading, setUploading] = useState(false)

  const fotoUrl = user?.photo_url || null

  async function onChange(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    if (file.size > MAX_BYTES) {
      onError('Ukuran foto maksimal 2 MB ya.')
      return
    }

    onError('')
    onSuccess('')
    setUploading(true)
    try {
      const form = new FormData()
      form.append('photo', file)
      await api('/me-photo.php', { method: 'POST', body: form })
      await onBerubah()
      onSuccess('Foto profil tersimpan.')
    } catch (err) {
      onError(err instanceof ApiError ? err.message : 'Upload foto gagal. Coba lagi ya.')
    } finally {
      setUploading(false)
    }
  }

  async function onHapus() {
    onError('')
    onSuccess('')
    setUploading(true)
    try {
      await api('/me-photo.php', { method: 'DELETE' })
      await onBerubah()
      onSuccess('Foto profil dihapus.')
    } catch (err) {
      onError(err instanceof ApiError ? err.message : 'Gagal menghapus foto. Coba lagi ya.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <section className="card mb-6 p-5">
      <h2 className="mb-3 text-lg font-extrabold">Foto Profil</h2>
      <div className="flex items-center gap-4">
        <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-ink bg-gray-100">
          {fotoUrl ? (
            <img src={fotoUrl} alt="Foto profil" className="h-full w-full object-cover" />
          ) : (
            <span className="text-2xl font-extrabold text-gray-400">
              {(user?.name || user?.email || '?').charAt(0).toUpperCase()}
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
            className="btn btn-press"
          >
            {uploading ? 'Memproses…' : fotoUrl ? 'Ganti foto' : 'Upload foto'}
          </button>
          {fotoUrl ? (
            <button type="button" disabled={uploading} onClick={onHapus} className="btn btn-ghost">
              Hapus
            </button>
          ) : null}
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={onChange}
          />
        </div>
      </div>
      <p className="mt-3 text-xs text-gray-500">JPG, PNG, atau WebP. Maksimal 2 MB.</p>
    </section>
  )
}
