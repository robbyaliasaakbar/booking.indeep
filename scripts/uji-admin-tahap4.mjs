/**
 * Uji menyeluruh Admin — Penutupan Tahap 4 (T4-B4).
 * Jalankan: node scripts/uji-admin-tahap4.mjs  (backend :5011 harus nyala)
 *
 * Cakupan: guard role (customer 403, admin biasa vs superadmin),
 * dashboard, bookings (transisi + optimistic lock + alasan wajib),
 * pindah jadwal (aturan Selasa/lewat/H+30, issue #17),
 * slots (lock + kapasitas + validasi), customers, pricelist, reports, logs.
 */

import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const BASE = process.env.UJI_BASE || 'http://localhost:5011/api'
const EMAIL_CUSTOMER = 'robby@test.dev'
const EMAIL_ADMIN_BIASA = 'adminbiasa-uji4@test.dev'

// Kredensial superadmin dari config/config.php lokal (file git-ignored).
// Repo tidak pernah menyimpan password — termasuk tidak ada default.
function bacaConfig(key) {
  try {
    const cfg = readFileSync(new URL('../config/config.php', import.meta.url), 'utf8')
    const m = cfg.match(new RegExp(`['"]${key}['"]\\s*=>\\s*['"]([^'"]*)['"]`))
    return m ? m[1] : ''
  } catch {
    return ''
  }
}

let lolos = 0
let gagal = 0

function helper(...args) {
  return execSync(
    `docker compose exec -T php php /app/scripts/uji-admin-helper.php ${args.join(' ')}`,
    { cwd: process.cwd() },
  )
    .toString()
    .trim()
}

async function req(method, path, body, cookie) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      Accept: 'application/json',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const setCookie = res.headers.get('set-cookie') || ''
  const json = await res.json().catch(() => null)
  return { status: res.status, json, cookie: setCookie.split(';')[0] }
}

let _saCookie = null
async function loginAdmin() {
  // Login superadmin sekali saja — admin-login punya rate limit 5/10 menit/IP.
  if (_saCookie) return _saCookie
  const username = process.env.UJI_ADMIN_USER || bacaConfig('SEED_ADMIN_USERNAME')
  const password = process.env.UJI_ADMIN_PASSWORD || bacaConfig('SEED_ADMIN_PASSWORD')
  if (!username || !password) {
    throw new Error(
      'kredensial admin tidak terbaca — set SEED_ADMIN_* di config/config.php lokal, atau env UJI_ADMIN_USER/UJI_ADMIN_PASSWORD',
    )
  }
  const r = await req('POST', '/admin-login.php', { username, password })
  if (r.status !== 200) throw new Error('login superadmin gagal: ' + JSON.stringify(r.json))
  _saCookie = r.cookie
  return _saCookie
}

async function loginDev(email) {
  const r = await req('POST', '/login-dev.php', { email, name: 'Uji Admin 4' })
  if (r.status !== 200) throw new Error(`login ${email} gagal`)
  return r.cookie
}

function cek(label, kondisi, ket) {
  if (kondisi) {
    lolos++
    console.log(`  ✅ ${label}`)
  } else {
    gagal++
    console.log(`  ❌ ${label} — ${ket}`)
  }
}

const ADMIN_ENDPOINTS = [
  '/admin/dashboard.php',
  '/admin/bookings.php?limit=1',
  '/admin/slots.php',
  '/admin/customers.php?limit=1',
  '/admin/pricelist.php',
  '/admin/reports.php',
  '/admin/logs.php?limit=1',
]

// =============================================================

async function uji1_guardCustomer403() {
  console.log('\n[1] Guard: customer biasa → 403 di semua endpoint admin')
  const c = await loginDev(EMAIL_CUSTOMER)
  for (const ep of ADMIN_ENDPOINTS) {
    const r = await req('GET', ep, null, c)
    cek(
      `${ep.split('?')[0].replace('/admin', '')} → 403`,
      r.status === 403 && r.json?.code === 'forbidden',
      `status=${r.status} code=${r.json?.code}`,
    )
  }
}

async function uji2_adminBiasaVsSuperadmin() {
  console.log('\n[2] Admin biasa: boleh data, DITOLAK laporan; superadmin: laporan 200')
  helper('seed-admin-biasa', EMAIL_ADMIN_BIASA)
  const c = await loginDev(EMAIL_ADMIN_BIASA)

  const dash = await req('GET', '/admin/dashboard.php', null, c)
  cek('dashboard admin biasa 200', dash.status === 200, `status=${dash.status}`)

  const book = await req('GET', '/admin/bookings.php?limit=1', null, c)
  cek('bookings admin biasa 200', book.status === 200, `status=${book.status}`)

  const rep = await req('GET', '/admin/reports.php', null, c)
  cek(
    'reports admin biasa → 403',
    rep.status === 403 && rep.json?.code === 'forbidden',
    `status=${rep.status} code=${rep.json?.code}`,
  )

  const sa = await loginAdmin()
  const repSa = await req('GET', '/admin/reports.php', null, sa)
  cek('reports superadmin 200', repSa.status === 200, `status=${repSa.status}`)
}

async function uji3_dashboard() {
  console.log('\n[3] Dashboard: 5 metrik terisi')
  const sa = await loginAdmin()
  const r = await req('GET', '/admin/dashboard.php', null, sa)
  const d = r.json?.data || {}
  cek(
    '5 metrik ada',
    r.status === 200 &&
      ['today_bookings', 'pending_count', 'slots_full_today', 'omzet_today', 'omzet_month']
        .every((k) => typeof d[k] === 'number'),
    JSON.stringify(d),
  )
}

async function uji4_bookingTransisiPenuh() {
  console.log('\n[4] Booking: pending→confirmed→in_progress→completed + audit 3 baris')
  const sa = await loginAdmin()
  const tanggalUji = '2026-10-25'
  const [idStr, kode] = helper('seed-booking-pending', EMAIL_CUSTOMER, tanggalUji, '09.00').split(' ')
  const id = Number(idStr)

  let info = helper('get-booking', id).split(' ')
  let ver = Number(info[3])

  const chain = ['confirmed', 'in_progress', 'completed']
  let semuaOk = true
  for (const target of chain) {
    const r = await req('PATCH', '/admin/bookings.php', { id, status: target, version: ver }, sa)
    if (!(r.status === 200 && r.json?.data?.ok)) {
      semuaOk = false
      cek(`→ ${target}`, false, JSON.stringify(r.json))
      break
    }
    ver = r.json.data.version
  }
  cek('rantai 3 transisi sukses, versi 1→4', semuaOk && ver === 4, `versi akhir=${ver}`)

  const auditCount = Number(helper('count-audit', 'booking_status', id))
  cek('audit booking_status = 3 baris', auditCount === 3, `count=${auditCount}`)

  helper('hapus-booking', id)
  return { kode, id }
}

async function uji5_optimisticLock409() {
  console.log('\n[5] Booking: versi basi → 409 conflict')
  const sa = await loginAdmin()
  const [idStr] = helper('seed-booking-pending', EMAIL_CUSTOMER, '2026-10-26', '13.00').split(' ')
  const id = Number(idStr)
  const ver = Number(helper('get-booking', id).split(' ')[3])

  // update pertama sukses
  await req('PATCH', '/admin/bookings.php', { id, status: 'confirmed', version: ver }, sa)
  // update kedua pakai versi basi
  const r = await req('PATCH', '/admin/bookings.php', { id, status: 'in_progress', version: ver }, sa)
  cek(
    'versi basi → 409 conflict',
    r.status === 409 && r.json?.code === 'conflict',
    JSON.stringify(r.json),
  )
  helper('hapus-booking', id)
}

async function uji6_transisiIlegal400() {
  console.log('\n[6] Booking: transisi ilegal → 400 invalid_transition')
  const sa = await loginAdmin()
  const [idStr] = helper('seed-booking-pending', EMAIL_CUSTOMER, '2026-10-27', '09.00').split(' ')
  const id = Number(idStr)
  const ver = Number(helper('get-booking', id).split(' ')[3])

  // pending -> completed (langsung) = ilegal
  const r = await req('PATCH', '/admin/bookings.php', { id, status: 'completed', version: ver }, sa)
  cek(
    'pending→completed ilegal → 400',
    r.status === 400 && r.json?.code === 'invalid_transition',
    JSON.stringify(r.json),
  )
  helper('hapus-booking', id)
}

async function uji7_alasanWajib() {
  console.log('\n[7] Booking: cancelled tanpa alasan → 400 reason_required; dengan alasan → sukses')
  const sa = await loginAdmin()
  const [idStr] = helper('seed-booking-pending', EMAIL_CUSTOMER, '2026-10-28', '13.00').split(' ')
  const id = Number(idStr)
  const ver = Number(helper('get-booking', id).split(' ')[3])

  const tanpa = await req('PATCH', '/admin/bookings.php', { id, status: 'cancelled', version: ver }, sa)
  cek(
    'tanpa alasan → 400 reason_required',
    tanpa.status === 400 && tanpa.json?.code === 'reason_required',
    JSON.stringify(tanpa.json),
  )

  const dengan = await req(
    'PATCH',
    '/admin/bookings.php',
    { id, status: 'cancelled', version: ver, reason: 'Customer minta reschedule' },
    sa,
  )
  cek('dengan alasan → 200', dengan.status === 200 && dengan.json?.data?.ok, JSON.stringify(dengan.json))
  helper('hapus-booking', id)
}

async function uji8_slots() {
  console.log('\n[8] Slots: GET grid, PATCH kunci/kapasitas, kapasitas<booked → 400')
  const sa = await loginAdmin()

  const list = await req('GET', '/admin/slots.php', null, sa)
  const slots = list.json?.data?.data || []
  cek(
    'grid 30 hari (±50 baris non-Selasa)',
    list.status === 200 && slots.length >= 40,
    `count=${slots.length}`,
  )

  const slot = slots.find((s) => s.booked === 0 && !s.is_locked) || slots[0]
  const lock = await req('PATCH', '/admin/slots.php', { id: slot.id, is_locked: true }, sa)
  cek('kunci slot → is_locked=true', lock.status === 200 && lock.json?.data?.is_locked === true, JSON.stringify(lock.json))

  const unlock = await req('PATCH', '/admin/slots.php', { id: slot.id, is_locked: false, capacity: 2 }, sa)
  cek(
    'buka + kapasitas 2 → sukses',
    unlock.status === 200 && unlock.json?.data?.is_locked === false && unlock.json?.data?.capacity === 2,
    JSON.stringify(unlock.json),
  )

  // slot yang sudah booked: cari slot booked>0, set capacity < booked
  const terisi = slots.find((s) => s.booked > 0)
  if (terisi) {
    const r = await req('PATCH', '/admin/slots.php', { id: terisi.id, capacity: terisi.booked - 1 >= 1 ? terisi.booked - 1 : 0 }, sa)
    cek(
      'kapasitas < booked → 400',
      r.status === 400 && r.json?.code === 'capacity_invalid',
      JSON.stringify(r.json),
    )
  } else {
    cek('kapasitas < booked → 400 (skip: tak ada slot terisi)', true, '')
  }

  helper('restore-slot', slot.id, 1, 0)
}

async function uji9_customersPricelist() {
  console.log('\n[9] Customers search + Pricelist edit & toggle')
  const sa = await loginAdmin()

  const cust = await req('GET', '/admin/customers.php?search=robby', null, sa)
  cek(
    'search "robby" ketemu + field lengkap',
    cust.status === 200 &&
      cust.json.data.count >= 1 &&
      'total_bookings' in cust.json.data.data[0] &&
      'default_address' in cust.json.data.data[0],
    JSON.stringify(cust.json?.data?.data?.[0] || {}),
  )

  const pl = await req('GET', '/admin/pricelist.php', null, sa)
  cek('pricelist 44 SKU', pl.status === 200 && pl.json.data.count === 44, `count=${pl.json?.data?.count}`)

  const sku = pl.json.data.data[0]
  const hargaLama = sku.price
  const edit = await req('PATCH', '/admin/pricelist.php', { id: sku.id, price: hargaLama + 1000, is_active: false }, sa)
  cek(
    'edit harga + nonaktif → sukses',
    edit.status === 200 && edit.json.data.price === hargaLama + 1000 && edit.json.data.is_active === false,
    JSON.stringify(edit.json),
  )

  helper('restore-pricelist', sku.id, hargaLama)
  cek('pricelist direstore', true, '')
}

async function uji10_reportsLogs() {
  console.log('\n[10] Reports omzet_completed + Logs filter booking')
  const sa = await loginAdmin()

  // seed 1 booking completed di tanggal tertentu
  const tanggal = '2026-10-29'
  const [idStr] = helper('seed-booking-pending', EMAIL_CUSTOMER, tanggal, '09.00').split(' ')
  const id = Number(idStr)
  let ver = Number(helper('get-booking', id).split(' ')[3])
  for (const target of ['confirmed', 'in_progress', 'completed']) {
    const r = await req('PATCH', '/admin/bookings.php', { id, status: target, version: ver }, sa)
    ver = r.json.data.version
  }

  const rep = await req('GET', `/admin/reports.php?from=${tanggal}&to=${tanggal}`, null, sa)
  cek(
    'omzet_completed = 150000 di tanggal uji',
    rep.status === 200 && rep.json.data.omzet_completed === 150000,
    `omzet=${rep.json?.data?.omzet_completed}`,
  )

  const logs = await req('GET', `/admin/logs.php?booking_id=${id}&action=booking_status`, null, sa)
  cek(
    'logs filter booking → 3 baris booking_status',
    logs.status === 200 && logs.json.data.count === 3,
    `count=${logs.json?.data?.count}`,
  )

  helper('hapus-booking', id)
}

async function uji11_pindahJadwalAturan() {
  console.log('\n[11] Pindah jadwal: aturan Selasa/lewat/H+30 — sama dengan create customer')
  const sa = await loginAdmin()

  const pad = (n) => String(n).padStart(2, '0')
  const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  const hari = (offset) => {
    const d = new Date()
    d.setDate(d.getDate() + offset)
    return d
  }
  // Selasa berikutnya (selalu <= +8 hari, otomatis dalam window H+30)
  const selasa = hari(1)
  while (selasa.getDay() !== 2) selasa.setDate(selasa.getDate() + 1)
  // Hari valid pertama: >= +3 hari dan bukan Selasa
  const valid = hari(3)
  while (valid.getDay() === 2) valid.setDate(valid.getDate() + 1)

  // Guard role: admin biasa tidak boleh pindah jadwal
  helper('seed-admin-biasa', EMAIL_ADMIN_BIASA)
  const cBiasa = await loginDev(EMAIL_ADMIN_BIASA)
  const [idStr] = helper('seed-booking-pending', EMAIL_CUSTOMER, '2026-11-05', '09.00').split(' ')
  const id = Number(idStr)

  // Bersihkan counter orphan di slot tujuan dari run sebelumnya (issue #38)
  helper('recount-slot', ymd(valid), '13.00')

  const ditolakBiasa = await req(
    'PATCH', '/admin/bookings.php',
    { id, slot_date: ymd(valid), slot_time: '13.00' }, cBiasa,
  )
  cek(
    'admin biasa pindah jadwal → 403',
    ditolakBiasa.status === 403 && ditolakBiasa.json?.code === 'forbidden',
    JSON.stringify(ditolakBiasa.json),
  )

  // Aturan jadwal (issue #17)
  const keSelasa = await req(
    'PATCH', '/admin/bookings.php',
    { id, slot_date: ymd(selasa), slot_time: '09.00' }, sa,
  )
  cek(
    'pindah ke Selasa → 400 hari_selasa',
    keSelasa.status === 400 && keSelasa.json?.code === 'hari_selasa',
    JSON.stringify(keSelasa.json),
  )

  const keLewat = await req(
    'PATCH', '/admin/bookings.php',
    { id, slot_date: ymd(hari(-1)), slot_time: '09.00' }, sa,
  )
  cek(
    'pindah ke tanggal lewat → 400 date_invalid',
    keLewat.status === 400 && keLewat.json?.code === 'date_invalid',
    JSON.stringify(keLewat.json),
  )

  const keJauh = await req(
    'PATCH', '/admin/bookings.php',
    { id, slot_date: ymd(hari(31)), slot_time: '09.00' }, sa,
  )
  cek(
    'pindah ke H+31 → 400 date_invalid',
    keJauh.status === 400 && keJauh.json?.code === 'date_invalid',
    JSON.stringify(keJauh.json),
  )

  const sukses = await req(
    'PATCH', '/admin/bookings.php',
    { id, slot_date: ymd(valid), slot_time: '13.00', reason: 'Uji aturan jadwal' }, sa,
  )
  cek(
    `pindah ke ${ymd(valid)} 13.00 (hari valid) → 200 + slot berubah`,
    sukses.status === 200 && sukses.json?.data?.ok && sukses.json?.data?.slot_date === ymd(valid),
    JSON.stringify(sukses.json),
  )

  helper('hapus-booking', id)
}

// =============================================================

async function main() {
  console.log('=== Uji Menyeluruh Admin — Penutupan Tahap 4 ===')
  console.log(`Backend: ${BASE}`)

  // Reset state uji terpusat (issue #38) — login_attempts, rate limit, slots,
  // data uji. Membuat suite idempoten antar-run.
  try { helper('reset-state-uji') } catch { try { execSync('docker compose exec -T php php /app/scripts/reset-uji.php', { cwd: process.cwd(), stdio: 'ignore' }) } catch { console.warn('⚠️  reset-uji gagal (lanjut)') } }

  await uji1_guardCustomer403()
  await uji2_adminBiasaVsSuperadmin()
  await uji3_dashboard()
  await uji4_bookingTransisiPenuh()
  await uji5_optimisticLock409()
  await uji6_transisiIlegal400()
  await uji7_alasanWajib()
  await uji8_slots()
  await uji9_customersPricelist()
  await uji10_reportsLogs()
  await uji11_pindahJadwalAturan()

  console.log(`\n=== HASIL: ${lolos} lolos, ${gagal} gagal ===`)
  process.exit(gagal > 0 ? 1 : 0)
}

main().catch((err) => {
  console.error('Error tak terduga:', err)
  process.exit(1)
})
