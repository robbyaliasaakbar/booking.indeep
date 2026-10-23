/**
 * 10 Uji OTP — Penutupan Tahap 3 (T3-B5).
 * Jalankan: node scripts/uji-otp-tahap3.mjs  (backend :5011 harus nyala)
 *
 * Helper DB (backdate/expire/clear/check-password/reset) lewat
 * scripts/uji-otp-helper.php di dalam container PHP.
 */

import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const BASE = process.env.UJI_BASE || 'http://localhost:5011/api'
const LOG = path.join(ROOT, 'storage', 'otp-dev.log')

let lolos = 0
let gagal = 0

function helper(...args) {
  return execSync(
    `docker compose exec -T php php /app/scripts/uji-otp-helper.php ${args.join(' ')}`,
    { cwd: ROOT },
  )
    .toString()
    .trim()
}

function bacaKodeTerakhir(email, purpose) {
  const isi = readFileSync(LOG, 'utf8')
  const baris = isi.trim().split('\n')
  const tanda = `TO=${email} PURPOSE=${purpose} CODE=`
  for (let i = baris.length - 1; i >= 0; i--) {
    if (baris[i].includes(tanda)) {
      return baris[i].split('CODE=')[1].trim()
    }
  }
  throw new Error(`kode untuk ${email}/${purpose} tidak ada di log`)
}

async function req(method, pathApi, body, cookie) {
  const res = await fetch(`${BASE}${pathApi}`, {
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

async function login(email, name) {
  const r = await req('POST', '/login-dev.php', { email, name })
  if (r.status !== 200) throw new Error(`login ${email} gagal: ${r.status}`)
  return r.cookie
}

function cek(label, kondisi, keterangan) {
  if (kondisi) {
    lolos++
    console.log(`  ✅ ${label}`)
  } else {
    gagal++
    console.log(`  ❌ ${label} — ${keterangan}`)
  }
}

// =============================================================

const EMAIL_UTAMA = 'robby@test.dev'
const PW_BARU = 'rahasiaBaru123'

async function uji1_gantiPasswordKodeBenar() {
  console.log('\n[1] Ganti password — kode benar → password berubah')
  helper('clear', EMAIL_UTAMA, 'ganti_password')
  const c = await login(EMAIL_UTAMA)
  await req('POST', '/otp-request.php', { purpose: 'ganti_password' }, c)
  const kode = bacaKodeTerakhir(EMAIL_UTAMA, 'ganti_password')
  const v = await req(
    'POST',
    '/otp-verify.php',
    { purpose: 'ganti_password', code: kode, newPassword: PW_BARU },
    c,
  )
  cek('verify 200 + ok', v.status === 200 && v.json?.data?.ok === true, JSON.stringify(v.json))
  const pw = helper('check-password', EMAIL_UTAMA, PW_BARU)
  cek('password_hash cocok', pw === 'cocok', pw)
}

async function uji2_gantiPasswordKodeSalah() {
  console.log('\n[2] Ganti password — kode salah → sisa percobaan berkurang')
  helper('clear', EMAIL_UTAMA, 'ganti_password')
  const c = await login(EMAIL_UTAMA)
  await req('POST', '/otp-request.php', { purpose: 'ganti_password' }, c)
  const kode = bacaKodeTerakhir(EMAIL_UTAMA, 'ganti_password')
  const salah = kode === '000000' ? '000001' : '000000'
  const v = await req(
    'POST',
    '/otp-verify.php',
    { purpose: 'ganti_password', code: salah, newPassword: PW_BARU },
    c,
  )
  cek('400 otp_salah', v.status === 400 && v.json?.code === 'otp_salah', JSON.stringify(v.json))
  cek(
    'sisa percobaan 4',
    (v.json?.message || '').includes('4'),
    v.json?.message,
  )
}

async function uji3_kunci15Menit() {
  console.log('\n[3] Ganti password — 5x salah → kunci 15 menit')
  helper('clear', EMAIL_UTAMA, 'ganti_password')
  const c = await login(EMAIL_UTAMA)
  await req('POST', '/otp-request.php', { purpose: 'ganti_password' }, c)
  const kode = bacaKodeTerakhir(EMAIL_UTAMA, 'ganti_password')
  const salah = kode === '000000' ? '000001' : '000000'

  let terakhir = null
  for (let i = 0; i < 5; i++) {
    terakhir = await req(
      'POST',
      '/otp-verify.php',
      { purpose: 'ganti_password', code: salah, newPassword: PW_BARU },
      c,
    )
  }
  cek(
    'percobaan ke-5 → 429 terkunci',
    terakhir.status === 429 && terakhir.json?.code === 'terlalu_sering',
    JSON.stringify(terakhir),
  )

  const minta = await req('POST', '/otp-request.php', { purpose: 'ganti_password' }, c)
  cek(
    'minta kode baru → 429 terkunci',
    minta.status === 429 && minta.json?.code === 'terlalu_sering',
    JSON.stringify(minta),
  )
  helper('clear', EMAIL_UTAMA, 'ganti_password')
}

async function uji4_cooldownResend() {
  console.log('\n[4] Ganti password — resend <60 detik → 429')
  helper('clear', EMAIL_UTAMA, 'ganti_password')
  const c = await login(EMAIL_UTAMA)
  const pertama = await req('POST', '/otp-request.php', { purpose: 'ganti_password' }, c)
  cek('request pertama 200', pertama.status === 200, JSON.stringify(pertama.json))

  const kedua = await req('POST', '/otp-request.php', { purpose: 'ganti_password' }, c)
  cek(
    'resend <60 dtk → 429 terlalu_sering',
    kedua.status === 429 && kedua.json?.code === 'terlalu_sering',
    JSON.stringify(kedua),
  )
  helper('clear', EMAIL_UTAMA, 'ganti_password')
}

async function uji5_kodeLamaTetapBerlaku() {
  console.log('\n[5] Resend → kode LAMA tetap berlaku (keputusan T3-B1)')
  helper('clear', EMAIL_UTAMA, 'ganti_password')
  const c = await login(EMAIL_UTAMA)
  await req('POST', '/otp-request.php', { purpose: 'ganti_password' }, c)
  const kodeLama = bacaKodeTerakhir(EMAIL_UTAMA, 'ganti_password')

  helper('bypass-cooldown', EMAIL_UTAMA, 'ganti_password', '70')
  const resend = await req('POST', '/otp-request.php', { purpose: 'ganti_password' }, c)
  cek('resend setelah cooldown 200', resend.status === 200, JSON.stringify(resend.json))

  const kodeBaru = bacaKodeTerakhir(EMAIL_UTAMA, 'ganti_password')
  cek('kode berbeda setelah resend', kodeLama !== kodeBaru, `${kodeLama} vs ${kodeBaru}`)

  const v = await req(
    'POST',
    '/otp-verify.php',
    { purpose: 'ganti_password', code: kodeLama, newPassword: PW_BARU },
    c,
  )
  cek(
    'kode LAMA masih dipakai → 200',
    v.status === 200 && v.json?.data?.ok === true,
    JSON.stringify(v.json),
  )
  helper('clear', EMAIL_UTAMA, 'ganti_password')
}

async function uji6_kodeKedaluwarsa() {
  console.log('\n[6] Ganti password — kode expired → 400 otp_kedaluwarsa')
  helper('clear', EMAIL_UTAMA, 'ganti_password')
  const c = await login(EMAIL_UTAMA)
  await req('POST', '/otp-request.php', { purpose: 'ganti_password' }, c)
  const kode = bacaKodeTerakhir(EMAIL_UTAMA, 'ganti_password')
  helper('expire', EMAIL_UTAMA, 'ganti_password')

  const v = await req(
    'POST',
    '/otp-verify.php',
    { purpose: 'ganti_password', code: kode, newPassword: PW_BARU },
    c,
  )
  cek(
    '400 otp_kedaluwarsa',
    v.status === 400 && v.json?.code === 'otp_kedaluwarsa',
    JSON.stringify(v.json),
  )
  helper('clear', EMAIL_UTAMA, 'ganti_password')
}

async function uji7_lupaPasswordEmailTakTerdaftar() {
  console.log('\n[7] Lupa password — email tak terdaftar → respons generik sukses')
  const r = await req('POST', '/otp-request.php', {
    purpose: 'lupa_password',
    email: 'tidakada@test.dev',
  })
  cek(
    '200 generik + email_masked',
    r.status === 200 && typeof r.json?.data?.email_masked === 'string',
    JSON.stringify(r.json),
  )
  cek(
    'email_masked menyembunyikan',
    r.json?.data?.email_masked !== 'tidakada@test.dev',
    r.json?.data?.email_masked,
  )
}

async function uji8_gantiEmailDuaKodeBenar() {
  console.log('\n[8] Ganti email — dua OTP benar → email berubah')
  const lama = 'ujiemail.ok@test.dev'
  const baru = 'ujiemail.ok.baru@test.dev'
  const c = await login(lama, 'Uji Email OK')

  const old = await req('POST', '/otp-email-request-old.php', {}, c)
  cek('request OTP email lama 200', old.status === 200, JSON.stringify(old.json))

  const nw = await req(
    'POST',
    '/otp-request.php',
    { purpose: 'ganti_email', newEmail: baru },
    c,
  )
  cek('request OTP email baru 200', nw.status === 200, JSON.stringify(nw.json))

  const kodeLama = bacaKodeTerakhir(lama, 'ganti_email')
  const kodeBaru = bacaKodeTerakhir(baru, 'ganti_email')

  const conf = await req(
    'POST',
    '/otp-email-confirm.php',
    { newEmail: baru, oldCode: kodeLama, newCode: kodeBaru },
    c,
  )
  cek('confirm 200 + ok', conf.status === 200 && conf.json?.data?.ok === true, JSON.stringify(conf.json))

  const me = await req('GET', '/me.php', null, c)
  cek('email berubah di /me', me.json?.data?.email === baru, me.json?.data?.email)
}

async function uji9_gantiEmailSalahSatuKode() {
  console.log('\n[9] Ganti email — salah satu kode → ditolak, email tidak berubah')
  const lama = 'ujiemail.gagal@test.dev'
  const baru = 'ujiemail.gagal.baru@test.dev'
  const c = await login(lama, 'Uji Email Gagal')

  await req('POST', '/otp-email-request-old.php', {}, c)
  await req('POST', '/otp-request.php', { purpose: 'ganti_email', newEmail: baru }, c)

  const kodeLama = bacaKodeTerakhir(lama, 'ganti_email')
  const kodeBaru = bacaKodeTerakhir(baru, 'ganti_email')
  const kodeBaruSalah = kodeBaru === '000000' ? '000001' : '000000'

  const conf = await req(
    'POST',
    '/otp-email-confirm.php',
    { newEmail: baru, oldCode: kodeLama, newCode: kodeBaruSalah },
    c,
  )
  cek('confirm 400', conf.status === 400, JSON.stringify(conf.json))

  const me = await req('GET', '/me.php', null, c)
  cek('email TIDAK berubah', me.json?.data?.email === lama, me.json?.data?.email)
}

async function uji10_purposeTidakDikenal() {
  console.log('\n[10] Request OTP — purpose tidak dikenal → 400')
  const c = await login(EMAIL_UTAMA)
  const r = await req('POST', '/otp-request.php', { purpose: 'aneh' }, c)
  cek(
    '400 purpose_invalid',
    r.status === 400 && r.json?.code === 'purpose_invalid',
    JSON.stringify(r.json),
  )
}

// =============================================================

async function main() {
  console.log('=== 10 Uji OTP — Penutupan Tahap 3 ===')
  console.log(`Backend: ${BASE}`)

  // Reset state uji terpusat (issue #38) — OTP/cooldown/rate limit/data uji.
  // Membuat suite idempoten antar-run (dulu sering gagal karena cooldown sisa).
  try {
    execSync('docker compose exec -T php php /app/scripts/reset-uji.php', { cwd: ROOT, stdio: 'ignore' })
  } catch {
    console.warn('⚠️  reset-uji gagal (lanjut, state mungkin kotor)')
  }

  await uji1_gantiPasswordKodeBenar()
  await uji2_gantiPasswordKodeSalah()
  await uji3_kunci15Menit()
  await uji4_cooldownResend()
  await uji5_kodeLamaTetapBerlaku()
  await uji6_kodeKedaluwarsa()
  await uji7_lupaPasswordEmailTakTerdaftar()
  await uji8_gantiEmailDuaKodeBenar()
  await uji9_gantiEmailSalahSatuKode()
  await uji10_purposeTidakDikenal()

  console.log(`\n=== HASIL: ${lolos} lolos, ${gagal} gagal ===`)
  process.exit(gagal > 0 ? 1 : 0)
}

main().catch((err) => {
  console.error('Error tak terduga:', err)
  process.exit(1)
})
