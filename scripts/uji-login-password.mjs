/**
 * Uji login customer email + password (issue #30).
 * Jalankan: node scripts/uji-login-password.mjs  (backend :5011 harus nyala)
 *
 * Cakupan: login sukses + session, pesan generik buat gagal, akun tanpa
 * password (Google-only), validasi input, method salah, rate limit 5/10 menit,
 * dan jejak audit.
 *
 * Helper DB lewat scripts/uji-login-helper.php di dalam container PHP.
 */

import { execSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const BASE = process.env.UJI_BASE || 'http://localhost:5011/api'

const EMAIL = 'login-uji@test.dev'
const EMAIL_GOOGLE = 'login-google-uji@test.dev'
const EMAIL_KOSONG = 'login-tidak-ada@test.dev'
const PASSWORD = 'RahasiaUji2026!'

let lolos = 0
let gagal = 0

function helper(...args) {
  return execSync(
    `docker compose exec -T php php /app/scripts/uji-login-helper.php ${args.join(' ')}`,
    { cwd: ROOT },
  )
    .toString()
    .trim()
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

function cek(label, kondisi, ket) {
  if (kondisi) {
    lolos++
    console.log(`  ✅ ${label}`)
  } else {
    gagal++
    console.log(`  ❌ ${label} — ${ket}`)
  }
}

// --- Persiapan: customer dengan password, customer tanpa password, reset rate limit ---
// Reset state uji terpusat dulu (issue #38) — hapus rate limit + data @test.dev
// lama, baru seed lagi. Membuat suite idempoten antar-run.
try {
  execSync('docker compose exec -T php php /app/scripts/reset-uji.php', { cwd: ROOT, stdio: 'ignore' })
} catch {
  console.warn('⚠️  reset-uji gagal (lanjut, state mungkin kotor)')
}

helper('seed-customer', EMAIL, 'Customer+Uji+Login')
helper('set-password', EMAIL, PASSWORD)
helper('seed-customer', EMAIL_GOOGLE, 'Customer+Google')
helper('clear-password', EMAIL_GOOGLE)

console.log('=== UJI LOGIN EMAIL + PASSWORD (issue #30) ===')
console.log(`API: ${BASE}`)

// ---------- 1. Login sukses ----------
console.log('\n[1] Login sukses → session + data user')
let cookie = ''
{
  const r = await req('POST', '/login.php', { email: EMAIL, password: PASSWORD })
  cek('login 200', r.status === 200, `status=${r.status} body=${JSON.stringify(r.json)}`)
  cek('balas data user (email cocok)', r.json?.data?.email === EMAIL, JSON.stringify(r.json?.data))
  cek('dapat cookie session', r.cookie.includes('INDEEPSESSID'), r.cookie)
  cookie = r.cookie

  const me = await req('GET', '/me.php', null, cookie)
  cek('session valid → /me 200', me.status === 200 && me.json?.data?.email === EMAIL,
    `status=${me.status} body=${JSON.stringify(me.json)}`)

  const audit = Number(helper('count-audit', 'login_password'))
  cek('audit login_password kecatat', audit >= 1, `baris=${audit}`)
}

// ---------- 2. Password salah → 401 generik ----------
console.log('\n[2] Password salah → 401 generik')
{
  const r = await req('POST', '/login.php', { email: EMAIL, password: 'salah-banget' })
  cek('401 invalid_credentials', r.status === 401 && r.json?.code === 'invalid_credentials',
    `status=${r.status} code=${r.json?.code}`)
  cek('tidak dapat cookie', !r.cookie.includes('INDEEPSESSID'), r.cookie)
  const audit = Number(helper('count-audit', 'login_failed', 'Password salah'))
  cek('audit login_failed (password salah)', audit >= 1, `baris=${audit}`)
}

// ---------- 3. Email tidak terdaftar → 401 dengan pesan SAMA ----------
console.log('\n[3] Email tidak terdaftar → 401 (pesan identik, anti-enumerasi)')
{
  const salah = await req('POST', '/login.php', { email: EMAIL, password: 'salah-banget' })
  const tidakAda = await req('POST', '/login.php', { email: EMAIL_KOSONG, password: PASSWORD })
  cek('401 juga', tidakAda.status === 401 && tidakAda.json?.code === 'invalid_credentials',
    `status=${tidakAda.status} code=${tidakAda.json?.code}`)
  cek('pesan sama persis dengan password salah', tidakAda.json?.message === salah.json?.message,
    `${tidakAda.json?.message} vs ${salah.json?.message}`)
}

// ---------- 4. Akun tanpa password (dibuat via Google) → arahan ramah ----------
console.log('\n[4] Akun Google-only (password_hash NULL) → 409 password_not_set')
{
  const r = await req('POST', '/login.php', { email: EMAIL_GOOGLE, password: PASSWORD })
  cek('409 password_not_set', r.status === 409 && r.json?.code === 'password_not_set',
    `status=${r.status} code=${r.json?.code}`)
  cek('pesan mengarahkan ke Google / Lupa password',
    String(r.json?.message || '').includes('Google'), r.json?.message)
}

// ---------- 5. Validasi input ----------
console.log('\n[5] Validasi input')
{
  const kosong = await req('POST', '/login.php', { email: '', password: '' })
  cek('400 missing_fields', kosong.status === 400 && kosong.json?.code === 'missing_fields',
    `status=${kosong.status} code=${kosong.json?.code}`)

  const format = await req('POST', '/login.php', { email: 'bukan-email', password: PASSWORD })
  cek('400 invalid_email', format.status === 400 && format.json?.code === 'invalid_email',
    `status=${format.status} code=${format.json?.code}`)

  const get = await req('GET', '/login.php')
  cek('405 buat GET', get.status === 405 && get.json?.code === 'method_not_allowed',
    `status=${get.status} code=${get.json?.code}`)
}

// ---------- 6. Rate limit 5 percobaan / 10 menit / IP ----------
console.log('\n[6] Rate limit: 5 gagal → percobaan ke-6 kena 429')
{
  helper('clear-attempts')

  const status = []
  for (let i = 1; i <= 5; i++) {
    const r = await req('POST', '/login.php', { email: EMAIL, password: 'salah-' + i })
    status.push(r.status)
  }
  cek('5 percobaan pertama 401', status.every((s) => s === 401), status.join(','))

  const r6 = await req('POST', '/login.php', { email: EMAIL, password: 'salah-6' })
  cek('percobaan ke-6 → 429 rate_limited', r6.status === 429 && r6.json?.code === 'rate_limited',
    `status=${r6.status} code=${r6.json?.code}`)

  // Walaupun password BENAR, saat limit aktif tetap ditolak (limiter di depan)
  const benar = await req('POST', '/login.php', { email: EMAIL, password: PASSWORD })
  cek('password benar pun kena 429 saat limit aktif', benar.status === 429, `status=${benar.status}`)

  helper('clear-attempts')
  const lagi = await req('POST', '/login.php', { email: EMAIL, password: PASSWORD })
  cek('setelah attempt direset → bisa login lagi', lagi.status === 200, `status=${lagi.status}`)
}

console.log(`\n=== HASIL: ${lolos} lolos, ${gagal} gagal ===`)
if (gagal > 0) {
  console.log('⚠️  Ada yang gagal. Periksa sebelum lanjut.')
  process.exit(1)
}
