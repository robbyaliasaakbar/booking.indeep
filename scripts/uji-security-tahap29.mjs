#!/usr/bin/env node
/**
 * Uji keamanan retest (issue #29) — verifikasi end-to-end lewat endpoint asli.
 *
 * Cakupan:
 *   [1] Attempt cap OTP akun TERDAFTAR: 400 otp_salah x5 → 429 kunci 15 menit
 *   [2] IDOR horizontal: akun A akses booking/alamat/cancel milik B → 403/404
 *   [3] IDOR vertical: session customer akses /api/admin/* → 401/403
 *   [4] Mass assignment PATCH /me.php (role/password_hash/id/email) → diabaikan
 *   [5] bookings-create: idempotencyKey milik user lain + skuId/surcharge asing
 *
 * Pakai: backend jalan (docker compose up -d), lalu dari folder booking/:
 *   node scripts/uji-security-tahap29.mjs
 * Exit 0 = semua lolos, 1 = ada gagal.
 */

import { execFileSync } from 'node:child_process'

const BASE = process.env.API_URL || 'http://localhost:5011'
const OUT = []

const helper = (action, ...args) =>
  execFileSync('docker', ['compose', 'exec', '-T', 'php', 'php', 'scripts/uji-security-helper.php', action, ...args], {
    cwd: process.cwd(),
    encoding: 'utf8',
  }).trim()

function check(name, pass, detail = '') {
  OUT.push({ name, pass })
  console.log(`${pass ? '✅ PASS' : '❌ GAGAL'}  ${name}${detail ? ' — ' + detail : ''}`)
}

// Sesi cookie per "aktor" (customer A, customer B, admin)
function session() {
  return { cookie: '' }
}
async function req(sess, path, { method = 'GET', body } = {}) {
  const res = await fetch(`${BASE}/api${path}`, {
    method,
    headers: {
      Accept: 'application/json',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(sess?.cookie ? { Cookie: sess.cookie } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })
  const sc = res.headers.get('set-cookie')
  if (sc && sess) sess.cookie = sc.split(';')[0]
  let data = null
  try { data = await res.json() } catch {}
  return { status: res.status, data }
}

const stamp = Date.now().toString(36)
const EMAIL_A = `sec.a.${stamp}@test.dev`
const EMAIL_B = `sec.b.${stamp}@test.dev`

const nowWib = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
function plusDaysWib(n) {
  const d = new Date(Date.now() + n * 86400000)
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)
}
function nextWeekdayFromToday(target) {
  for (let i = 0; i <= 30; i++) {
    const iso = plusDaysWib(i)
    const [y, m, d] = iso.split('-').map(Number)
    if (new Date(y, m - 1, d).getDay() === target) return iso
  }
  return null
}
const idem = () => `sec-${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`

// Login-dev helper: fresh session per aktor (jangan andalkan cookie lama).
async function loginDev(sess, email, name) {
  const r = await req(sess, '/login-dev.php', { method: 'POST', body: { email, name } })
  if (r.status !== 200) throw new Error(`login-dev ${email} gagal: HTTP ${r.status} ${JSON.stringify(r.data)}`)
  return r.data.data.id
}

async function main() {
  console.log('=== UJI KEAMANAN RETEST — issue #29 ===')
  console.log(`API: ${BASE}\n`)

  const health = await fetch(`${BASE}/api/pricelist.php`)
  if (!health.ok) {
    console.error('Backend tidak jalan. Nyalakan docker compose dulu ya.')
    process.exit(1)
  }

  // Reset state uji terpusat (issue #38) — idempoten antar-run
  try {
    execFileSync('docker', ['compose', 'exec', '-T', 'php', 'php', 'scripts/reset-uji.php'], { cwd: process.cwd(), stdio: 'ignore' })
  } catch {
    console.warn('⚠️  reset-uji gagal (lanjut, state mungkin kotor)')
  }

  // ---------- Setup dua customer ----------
  const A = session()
  const B = session()
  const idA = Number(helper('seed-customer', EMAIL_A, 'Security A', '081200001111'))
  const idB = Number(helper('seed-customer', EMAIL_B, 'Security B', '081200002222'))
  let addrBId = 0 // alamat milik B (dipakai lintas blok)

  await loginDev(A, EMAIL_A, 'Security A')
  await loginDev(B, EMAIL_B, 'Security B')
  console.log(`setup: A=#${idA} B=#${idB}\n`)

  // ============================================================
  // [1] Attempt cap OTP — akun TERDAFTAR, alur lupa_password
  // ============================================================
  console.log('[1] Attempt cap OTP (akun terdaftar)')
  {
    helper('reset-security-state')

    // minta OTP lupa_password — pakai sesi publik (tanpa cookie)
    const pub = session()
    const rq = await req(pub, '/otp-request.php', { method: 'POST', body: { purpose: 'lupa_password', email: EMAIL_A } })
    check('OTP request ke email terdaftar → 200', rq.status === 200, `HTTP ${rq.status} ${JSON.stringify(rq.data?.data || rq.data)}`)

    const adaAktif = Number(helper('latest-otp-code', EMAIL_A, 'lupa_password'))
    check('baris OTP aktif ada di DB', adaAktif >= 1, `rows=${adaAktif}`)

    // Hammer kode salah sampai kena kunci. Attempt cap = 5: percobaan yang
    // membuat attempts mencapai 5 dibalas 429 (kunci), jadi pola aktual:
    //   400, 400, 400, 400, 429  (4x sisa percobaan, lalu terkunci)
    const codes = []
    for (let i = 1; i <= 6; i++) {
      const res = await req(pub, '/otp-verify.php', {
        method: 'POST',
        body: { purpose: 'lupa_password', email: EMAIL_A, code: '000000', newPassword: 'PasswordBaru123' },
      })
      codes.push(res.status)
    }
    // 400 otp_salah muncul (belum semua 429), lalu ada 429 (terkunci)
    const ada400 = codes.filter((s) => s === 400).length
    const ada429 = codes.filter((s) => s === 429).length
    check('OTP salah dibalas 400 otp_salah (attempt cap belum penuh)', ada400 >= 3, `codes=${codes.join(',')}`)
    check('OTP terkunci 429 setelah attempts cap', ada429 >= 1, `codes=${codes.join(',')}`)
    check('setelah terkunci, tetap 429 (kunci 15 menit)', codes.slice(-2).every((s) => s === 429), `codes=${codes.join(',')}`)
  }

  // ============================================================
  // [2] IDOR horizontal — A akses data milik B
  // ============================================================
  console.log('\n[2] IDOR horizontal (A mengakses milik B)')
  {
    // Fresh session (blok [1] mengosongkan rate-limit/OTP state)
    await loginDev(A, EMAIL_A, 'Security A')
    await loginDev(B, EMAIL_B, 'Security B')

    // B bikin alamat + booking
    const addrB = await req(B, '/addresses.php', {
      method: 'POST',
      body: { street_no: 'Jl Milik B No 1', village: 'Sukamaju', district: 'Cilodong', city: 'Depok', province: 'Jawa Barat' },
    })
    addrBId = addrB.data?.data?.id
    check('B berhasil bikin alamat (setup)', addrB.status === 200 && addrBId > 0, `HTTP ${addrB.status}`)

    const jumat = nextWeekdayFromToday(5)
    const createB = await req(B, '/bookings-create.php', {
      method: 'POST',
      body: { items: [{ skuId: 3, qty: 1 }], date: jumat, time: '09.00', idempotencyKey: idem(), addressId: addrBId },
    })
    const bookingBId = createB.data?.data?.id
    check('B berhasil bikin booking (setup)', createB.status === 201 && bookingBId > 0, `HTTP ${createB.status} id=${bookingBId}`)

    // A coba lihat booking B
    if (bookingBId) {
      const detail = await req(A, `/bookings-detail.php?id=${bookingBId}`)
      check('A lihat booking B → 404 (bukan data B)', detail.status === 404, `HTTP ${detail.status} code=${detail.data?.code}`)
    } else {
      check('A lihat booking B → 404 (bukan data B)', false, 'setup booking B gagal')
    }

    // A coba edit alamat B
    if (addrBId) {
      const edit = await req(A, '/addresses.php', {
        method: 'PATCH',
        body: { id: addrBId, street_no: 'Dibajak A', village: 'X', district: 'Y', city: 'Z', province: 'W' },
      })
      check('A edit alamat B → 404', edit.status === 404, `HTTP ${edit.status} code=${edit.data?.code}`)

      const del = await req(A, '/addresses.php', { method: 'DELETE', body: { id: addrBId } })
      check('A hapus alamat B → 404', del.status === 404, `HTTP ${del.status} code=${del.data?.code}`)
    }

    // A coba batalkan booking B
    if (bookingBId) {
      const cancel = await req(A, '/bookings-cancel.php', { method: 'POST', body: { id: bookingBId, reason: 'bajak test' } })
      check('A batalkan booking B → 404', cancel.status === 404, `HTTP ${cancel.status} code=${cancel.data?.code}`)

      // Pastikan booking B TIDAK berubah status
      const detailCheck = await req(B, `/bookings-detail.php?id=${bookingBId}`)
      check('booking B tetap pending (tidak terpengaruh)', detailCheck.data?.data?.status === 'pending', `status=${detailCheck.data?.data?.status}`)
    }
  }

  // ============================================================
  // [3] IDOR vertical — customer akses /api/admin/*
  // ============================================================
  console.log('\n[3] IDOR vertical (customer → admin API)')
  {
    const adminEndpoints = [
      '/admin/bookings.php', '/admin/customers.php', '/admin/dashboard.php',
      '/admin/reports.php', '/admin/slots.php', '/admin/logs.php',
    ]
    let semuaDitolak = true
    const hasil = []
    for (const ep of adminEndpoints) {
      const res = await req(A, ep)
      const ditolak = res.status === 401 || res.status === 403
      hasil.push(`${ep}=${res.status}`)
      if (!ditolak) semuaDitolak = false
    }
    check('semua /admin/* dari customer → 401/403', semuaDitolak, hasil.join(' '))
  }

  // ============================================================
  // [4] Mass assignment PATCH /me.php
  // ============================================================
  console.log('\n[4] Mass assignment PATCH /me.php')
  {
    await loginDev(A, EMAIL_A, 'Security A')
    const sebelum = await req(A, '/me.php')
    const roleAwal = sebelum.data?.data?.role
    const idAwal = sebelum.data?.data?.id

    const res = await req(A, '/me.php', {
      method: 'PATCH',
      body: {
        name: 'Security A Updated',
        role: 'superadmin',
        id: 999999,
        password_hash: '$2y$10$palsu',
        email: 'hacker@evil.com',
        username: 'hacker',
        profile_complete: 1,
      },
    })
    check('PATCH me dengan field terlarang → tetap 200 (hanya field sah diterapkan)', res.status === 200, `HTTP ${res.status}`)

    const sesudah = await req(A, '/me.php')
    check('role TIDAK berubah (tetap customer)', sesudah.data?.data?.role === 'customer', `role=${sesudah.data?.data?.role} (awal ${roleAwal})`)
    check('id TIDAK berubah', sesudah.data?.data?.id === idAwal, `id=${sesudah.data?.data?.id}`)
    check('email TIDAK berubah', sesudah.data?.data?.email === EMAIL_A, `email=${sesudah.data?.data?.email}`)
    check('name sah TETAP diterapkan', sesudah.data?.data?.name === 'Security A Updated', `name=${sesudah.data?.data?.name}`)
  }

  // ============================================================
  // [5] bookings-create: idempotencyKey lintas user + skuId asing
  // ============================================================
  console.log('\n[5] bookings-create: idempotency lintas user + kepemilikan SKU/surcharge')
  {
    await loginDev(A, EMAIL_A, 'Security A')
    await loginDev(B, EMAIL_B, 'Security B')

    // A bikin booking dengan idempotencyKey K
    const addrA = await req(A, '/addresses.php', {
      method: 'POST',
      body: { street_no: 'Jl Milik A No 1', village: 'Sukamaju', district: 'Cilodong', city: 'Depok', province: 'Jawa Barat' },
    })
    const addrAId = addrA.data?.data?.id

    const sabtu = nextWeekdayFromToday(6)
    const K = idem()
    const createA = await req(A, '/bookings-create.php', {
      method: 'POST',
      body: { items: [{ skuId: 3, qty: 1 }], date: sabtu, time: '13.00', idempotencyKey: K, addressId: addrAId },
    })
    check('A create dengan key K → 201', createA.status === 201, `HTTP ${createA.status}`)

    // B pakai key yang sama → harus 409 double_submit (bukan bikin booking baru milik B, atau mengembalikan milik A)
    const createBDup = await req(B, '/bookings-create.php', {
      method: 'POST',
      body: { items: [{ skuId: 3, qty: 1 }], date: sabtu, time: '13.00', idempotencyKey: K, addressId: addrBId },
    })
    check('B reuse key K → 409 double_submit', createBDup.status === 409 && createBDup.data?.code === 'double_submit', `HTTP ${createBDup.status} code=${createBDup.data?.code}`)
    // Pastikan B tidak bisa lihat detail booking A via details.id (jika ada)
    if (createBDup.data?.details?.id) {
      const detailB = await req(B, `/bookings-detail.php?id=${createBDup.data.details.id}`)
      check('B tidak bisa akses detail booking dari key A', detailB.status === 404, `HTTP ${detailB.status}`)
    }

    // skuId asing (999999) → harus ditolak, bukan bikin booking harga 0
    const asing = await req(A, '/bookings-create.php', {
      method: 'POST',
      body: { items: [{ skuId: 999999, qty: 1 }], date: sabtu, time: '13.00', idempotencyKey: idem(), addressId: addrAId },
    })
    check('skuId asing ditolak (bukan booking harga 0)', asing.status >= 400, `HTTP ${asing.status} code=${asing.data?.code}`)

    // surcharge code asing → harus ditolak/diabaikan (tidak menambah total aneh)
    const surAsing = await req(A, '/bookings-create.php', {
      method: 'POST',
      body: { items: [{ skuId: 3, qty: 1 }], surcharges: [{ code: 'SURCHARGE_PALSU', qtyAffected: 99 }], date: sabtu, time: '13.00', idempotencyKey: idem(), addressId: addrAId },
    })
    const ditolakSur = surAsing.status >= 400 || (surAsing.data?.data?.surchargeTotal === 0)
    check('surcharge code asing ditolak/diabaikan', ditolakSur, `HTTP ${surAsing.status} surchargeTotal=${surAsing.data?.data?.surchargeTotal}`)
  }

  // cleanup
  try { helper('cleanup-customer', EMAIL_A) } catch {}
  try { helper('cleanup-customer', EMAIL_B) } catch {}

  const lolos = OUT.filter((o) => o.pass).length
  console.log(`\n=== RINGKASAN: ${lolos}/${OUT.length} lolos ===`)
  process.exit(lolos === OUT.length ? 0 : 1)
}

main().catch((e) => { console.error(e); process.exit(1) })
