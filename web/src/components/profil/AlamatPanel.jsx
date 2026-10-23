/**
 * AlamatPanel — panel alamat (list + tambah + edit + set default + hapus)
 * (issue #7 Batch 3, dipisah dari Profil.jsx).
 *
 * Terima `user` sebagai prop (bukan ambil useAuth sendiri) supaya mandiri
 * dan mudah diuji. Banner error/success lokal.
 */

import { useState } from 'react'
import { api, ApiError } from '../../lib/api.js'
import AddressFields from '../AddressFields.jsx'
import ConfirmDialog from '../ConfirmDialog.jsx'
import Banner from '../Banner.jsx'
import { EMPTY_ADDRESS, normalizeAddress } from '../../lib/addressForm.js'

export default function AlamatPanel({ user, onBerubah }) {
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [form, setForm] = useState(null) // null = tertutup, 'baru' = tambah, angka id = edit
  const [isi, setIsi] = useState(EMPTY_ADDRESS)
  const [busy, setBusy] = useState(false)
  const [hapus, setHapus] = useState(null) // alamat yang mau dihapus (untuk ConfirmDialog)

  const alamat = user?.addresses || []

  function bukaBaru() {
    setIsi(EMPTY_ADDRESS)
    setForm('baru')
    setError('')
    setSuccess('')
  }

  function bukaEdit(a) {
    setIsi({ ...normalizeAddress(a), is_default: a.is_default })
    setForm(a.id)
    setError('')
    setSuccess('')
  }

  function ubah(field, value) {
    setIsi((old) => ({ ...old, [field]: value }))
  }

  async function onSimpan(event) {
    event.preventDefault()
    setError('')
    setBusy(true)
    const payload = {
      label: isi.label,
      street_no: isi.street_no,
      village: isi.village,
      district: isi.district,
      city: isi.city,
      province: isi.province,
      postal: isi.postal,
      note: isi.note,
      maps_url: isi.maps_url,
      is_default: form === 'baru' ? !!isi.is_default : undefined,
    }
    try {
      if (form === 'baru') {
        await api('/addresses.php', { method: 'POST', body: JSON.stringify(payload) })
        setSuccess('Alamat tersimpan.')
      } else {
        await api('/addresses.php', {
          method: 'PATCH',
          body: JSON.stringify({ id: form, ...payload }),
        })
        setSuccess('Alamat diperbarui.')
      }
      await onBerubah()
      setForm(null)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal menyimpan alamat. Coba lagi ya.')
    } finally {
      setBusy(false)
    }
  }

  async function onSetDefault(id) {
    setError('')
    setSuccess('')
    try {
      await api('/addresses.php', {
        method: 'PATCH',
        body: JSON.stringify({ id, setDefault: true }),
      })
      await onBerubah()
      setSuccess('Alamat utama diperbarui.')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal mengubah alamat utama.')
    }
  }

  async function konfirmasiHapus() {
    if (!hapus) return
    setError('')
    setSuccess('')
    setBusy(true)
    try {
      await api(`/addresses.php?id=${hapus.id}`, { method: 'DELETE' })
      await onBerubah()
      setSuccess('Alamat dihapus.')
      setHapus(null)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Gagal menghapus alamat.')
      setHapus(null)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="card mb-6 p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-lg font-extrabold">Alamat Saya</h2>
        {form === null ? (
          <button type="button" onClick={bukaBaru} className="btn btn-press text-sm">
            + Tambah alamat
          </button>
        ) : null}
      </div>

      {error ? (
        <Banner variant="error" className="mb-3">
          {error}
        </Banner>
      ) : null}
      {success ? (
        <Banner variant="success" className="mb-3">
          {success}
        </Banner>
      ) : null}

      {alamat.length === 0 && form === null ? (
        <p className="text-sm text-gray-600">Belum ada alamat. Tambah satu biar booking cepat.</p>
      ) : null}

      <ul className="space-y-3">
        {alamat.map((a) => (
          <li key={a.id} className="rounded-xl border-2 border-ink p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-extrabold">
                  {a.label || 'Alamat'}{' '}
                  {a.is_default ? (
                    <span className="ml-1 rounded-md border-2 border-ink bg-cta px-1.5 py-0.5 text-xs font-extrabold text-brand">
                      Utama
                    </span>
                  ) : null}
                </p>
                <p className="text-sm text-gray-700">{a.street_no}</p>
                <p className="text-sm text-gray-600">
                  {a.village}, {a.district}, {a.city} {a.postal}
                </p>
                {a.maps_url ? (
                  <a
                    href={a.maps_url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 inline-block text-sm font-bold text-brand underline"
                  >
                    Buka di Google Maps
                  </a>
                ) : null}
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                {!a.is_default ? (
                  <button
                    type="button"
                    onClick={() => onSetDefault(a.id)}
                    className="btn btn-press text-xs"
                  >
                    Jadikan utama
                  </button>
                ) : null}
                <button type="button" onClick={() => bukaEdit(a)} className="btn btn-press text-xs">
                  Edit
                </button>
                {!a.is_default ? (
                  <button
                    type="button"
                    onClick={() => setHapus(a)}
                    className="btn btn-ghost text-xs"
                  >
                    Hapus
                  </button>
                ) : null}
              </div>
            </div>
          </li>
        ))}
      </ul>

      {form !== null ? (
        <form onSubmit={onSimpan} noValidate className="mt-4 rounded-xl border-2 border-dashed border-ink p-4">
          <h3 className="mb-3 font-extrabold">
            {form === 'baru' ? 'Alamat baru' : 'Edit alamat'}
          </h3>
          <AddressFields
            value={isi}
            onChange={ubah}
            idPrefix="profil-ad"
            variant="plain"
            showDefault
          />
          <div className="mt-4 flex gap-2">
            <button type="submit" disabled={busy} className="btn btn-cta py-2">
              {busy ? 'Menyimpan…' : 'Simpan alamat'}
            </button>
            <button type="button" onClick={() => setForm(null)} className="btn btn-ghost py-2">
              Batal
            </button>
          </div>
        </form>
      ) : null}

      <ConfirmDialog
        open={hapus !== null}
        title={hapus ? `Hapus alamat "${hapus.label || 'Alamat'}"?` : ''}
        confirmLabel="Ya, Hapus"
        variant="destructive"
        busy={busy}
        onConfirm={konfirmasiHapus}
        onCancel={() => setHapus(null)}
      >
        <p className="text-sm text-gray-600">
          Alamat ini akan dihapus dari daftar kamu. Tidak bisa dibatalkan.
        </p>
      </ConfirmDialog>
    </section>
  )
}
