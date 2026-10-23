/**
 * AddressFields — field alamat bersama (issue #7 Batch 1).
 *
 * Menghapus duplikasi form alamat yang dulu ditulis 3× (wizard StepIdentitas,
 * Profil/AlamatPanel, LengkapiProfil) dengan kontrak & gaya berbeda. Komponen
 * ini "controlled": parent yang pegang state, komponen cuma render + onChange.
 *
 * Props:
 *   value     : objek alamat (snake_case) — lihat EMPTY_ADDRESS di lib/addressForm.js
 *   onChange  : (namaField, nilai) => void
 *   idPrefix  : prefix id input (biar unik kalau ada >1 form di halaman), default 'ad'
 *   showLabel  : tampilkan field label (default true)
 *   showNote   : tampilkan field catatan (default true)
 *   showMaps   : tampilkan field link maps (default true)
 *   showDefault: tampilkan checkbox "jadikan utama" (default false; butuh value.is_default + onChange('is_default', bool))
 *   variant   : 'plain' (input-brutal, dipakai profil) | 'wizard' (gaya step booking)
 */

import { REQUIRED_ADDRESS_FIELDS } from '../lib/addressForm.js'

export default function AddressFields({
  value,
  onChange,
  idPrefix = 'ad',
  showLabel = true,
  showNote = true,
  showMaps = true,
  showDefault = false,
  variant = 'plain',
}) {
  const v = value || {}
  const set = (k, val) => onChange(k, val)
  const req = (k) => (REQUIRED_ADDRESS_FIELDS.includes(k) ? <span className="text-red-600"> *</span> : null)

  if (variant === 'wizard') {
    // Token .input-brutal (issue #3 batch 3c) — dulu nulis styling manual
    const cls = 'input-brutal text-base'
    return (
      <>
        {showLabel && (
          <div>
            <label htmlFor={`${idPrefix}-label`} className="mb-1 block font-bold">
              Label alamat <span className="font-normal text-gray-500">(opsional)</span>
            </label>
            <input
              id={`${idPrefix}-label`}
              className={cls}
              value={v.label || ''}
              onChange={(e) => set('label', e.target.value)}
              placeholder="Rumah, Kantor, dll"
              maxLength={40}
            />
          </div>
        )}
        <div>
          <label htmlFor={`${idPrefix}-street`} className="mb-1 block font-bold">
            Jalan & nomor rumah / patokan <span className="text-red-600">*</span>
          </label>
          <input
            id={`${idPrefix}-street`}
            className={cls}
            value={v.street_no || ''}
            onChange={(e) => set('street_no', e.target.value)}
            placeholder="Jl Mawar 2 No 45 RT 03 RW 07"
            maxLength={190}
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor={`${idPrefix}-village`} className="mb-1 block font-bold">
              Kelurahan / desa <span className="text-red-600">*</span>
            </label>
            <input id={`${idPrefix}-village`} className={cls} value={v.village || ''} onChange={(e) => set('village', e.target.value)} maxLength={100} />
          </div>
          <div>
            <label htmlFor={`${idPrefix}-district`} className="mb-1 block font-bold">
              Kecamatan <span className="text-red-600">*</span>
            </label>
            <input id={`${idPrefix}-district`} className={cls} value={v.district || ''} onChange={(e) => set('district', e.target.value)} maxLength={100} />
          </div>
          <div>
            <label htmlFor={`${idPrefix}-city`} className="mb-1 block font-bold">
              Kota / kabupaten <span className="text-red-600">*</span>
            </label>
            <input id={`${idPrefix}-city`} className={cls} value={v.city || ''} onChange={(e) => set('city', e.target.value)} maxLength={100} />
          </div>
          <div>
            <label htmlFor={`${idPrefix}-province`} className="mb-1 block font-bold">
              Provinsi <span className="text-red-600">*</span>
            </label>
            <input id={`${idPrefix}-province`} className={cls} value={v.province || ''} onChange={(e) => set('province', e.target.value)} maxLength={100} />
          </div>
          <div>
            <label htmlFor={`${idPrefix}-postal`} className="mb-1 block font-bold">
              Kode pos <span className="font-normal text-gray-500">(opsional)</span>
            </label>
            <input
              id={`${idPrefix}-postal`}
              className={cls}
              value={v.postal || ''}
              onChange={(e) => set('postal', e.target.value.replace(/\D/g, ''))}
              inputMode="numeric"
              maxLength={5}
            />
          </div>
          {showMaps && (
            <div>
              <label htmlFor={`${idPrefix}-maps`} className="mb-1 block font-bold">
                Link maps <span className="font-normal text-gray-500">(opsional)</span>
              </label>
              <input
                id={`${idPrefix}-maps`}
                className={cls}
                value={v.maps_url || ''}
                onChange={(e) => set('maps_url', e.target.value)}
                placeholder="https://maps.app.goo.gl/…"
              />
            </div>
          )}
        </div>
        {showNote && (
          <div>
            <label htmlFor={`${idPrefix}-note`} className="mb-1 block font-bold">
              Catatan alamat <span className="font-normal text-gray-500">(opsional)</span>
            </label>
            <input
              id={`${idPrefix}-note`}
              className={cls}
              value={v.note || ''}
              onChange={(e) => set('note', e.target.value)}
              placeholder="Pagar hitam sebelah mushola"
              maxLength={255}
            />
          </div>
        )}
      </>
    )
  }

  // variant 'plain' — input-brutal (dipakai Profil & LengkapiProfil)
  const field = (label, key, opts = {}) => (
    <label className="block text-sm font-bold">
      {label}
      {req(key)}
      <input
        type={opts.type || 'text'}
        maxLength={opts.maxLength}
        inputMode={opts.inputMode}
        value={v[key] || ''}
        onChange={(e) => set(key, opts.digits ? e.target.value.replace(/\D/g, '') : e.target.value)}
        className="input-brutal mt-1"
        placeholder={opts.placeholder}
      />
    </label>
  )

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {showLabel && field('Label (Rumah/Kantor) — opsional', 'label', { maxLength: 40, placeholder: 'Rumah' })}
      {field('Nama jalan & nomor', 'street_no', { maxLength: 190, placeholder: 'Jl. Melati No. 10' })}
      {field('Kelurahan/desa', 'village', { maxLength: 100 })}
      {field('Kecamatan', 'district', { maxLength: 100 })}
      {field('Kota', 'city', { maxLength: 100 })}
      {field('Provinsi', 'province', { maxLength: 100 })}
      {field('Kode pos — opsional (5 angka kalau diisi)', 'postal', { maxLength: 5, inputMode: 'numeric', digits: true, placeholder: '16415' })}
      {showMaps && field('Link Google Maps (opsional)', 'maps_url', { type: 'url', placeholder: 'https://maps.app.goo.gl/…' })}
      {showNote && field('Catatan untuk teknisi (opsional)', 'note', { maxLength: 255, placeholder: 'Patokan: sebelah minimarket' })}
      {showDefault && (
        <div className="sm:col-span-2">
          <label className="flex items-center gap-2 text-sm font-bold">
            <input
              type="checkbox"
              checked={!!v.is_default}
              onChange={(e) => set('is_default', e.target.checked)}
              className="h-4 w-4 accent-brand"
            />
            Jadikan alamat utama
          </label>
        </div>
      )}
    </div>
  )
}
