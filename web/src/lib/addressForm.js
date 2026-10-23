/**
 * Kontrak field alamat yang SERAGAM (issue #7 Batch 1, lanjutan #16).
 * Satu sumber untuk objek kosong + validasi wajib, dipakai form alamat
 * bersama (`components/AddressFields.jsx`) di wizard, profil, dan lengkapi profil.
 *
 * Kontrak resmi = snake_case (dipatok juga di backend `app/lib/address.php`).
 * Field wajib (panjang) sesuai PRD: street_no, village, district, city, province.
 */

export const EMPTY_ADDRESS = {
  label: '',
  street_no: '',
  village: '',
  district: '',
  city: '',
  province: '',
  postal: '',
  note: '',
  maps_url: '',
}

/** Field wajib alamat (selain label/postal/note/maps_url yang opsional). */
export const REQUIRED_ADDRESS_FIELDS = ['street_no', 'village', 'district', 'city', 'province']

/**
 * Validasi field alamat. Balas pesan error atau '' kalau oke.
 * $addr boleh berisi snake_case (kontrak resmi) — camelCase legacy diabaikan
 * di sini karena FE modern sudah snake_case.
 */
export function validateAddress(addr) {
  if (!addr) return 'Alamat dulu diisi ya.'
  const missing = REQUIRED_ADDRESS_FIELDS.filter((k) => !String(addr[k] ?? '').trim())
  if (missing.length > 0) {
    return 'Alamat belum lengkap. Isi nomor rumah, kelurahan, kecamatan, kota, dan provinsi ya.'
  }
  const postal = String(addr.postal ?? '').trim()
  if (postal !== '' && !/^\d{5}$/.test(postal)) {
    return 'Kode pos harus 5 angka (atau dikosongkan) ya.'
  }
  return ''
}

/** Normalisasi alamat ke kontrak snake_case + trim (buang camelCase legacy). */
export function normalizeAddress(addr) {
  const a = addr || {}
  return {
    label: String(a.label ?? '').trim(),
    street_no: String(a.street_no ?? a.streetNo ?? '').trim(),
    village: String(a.village ?? '').trim(),
    district: String(a.district ?? '').trim(),
    city: String(a.city ?? '').trim(),
    province: String(a.province ?? '').trim(),
    postal: String(a.postal ?? '').trim(),
    note: String(a.note ?? '').trim(),
    maps_url: String(a.maps_url ?? a.mapsUrl ?? '').trim(),
  }
}

/** Ringkas alamat jadi satu baris buat pratinjau. */
export function formatAddressLine(addr) {
  if (!addr) return ''
  const a = normalizeAddress(addr)
  const pos = a.postal ? ` ${a.postal}` : ''
  return `${a.street_no}, Kel. ${a.village}, Kec. ${a.district}, ${a.city}, ${a.province}${pos}`
}
