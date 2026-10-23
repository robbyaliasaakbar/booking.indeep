/**
 * Bukti tingkat LOCK (issue #26): membandingkan serialisasi `SELECT` biasa vs
 * `SELECT … FOR UPDATE` pada baris otps yang sama, memakai dua koneksi paralel.
 *
 * Prinsip: dulu adalah buffer tahan transaksi (TAHAN_MS). Proses pertama yang
 * menang lock akan menahan; proses kedua:
 *   - mode `plain`     → SELECT-nya SELESAI cepat (< 100ms) → tidak ada lock.
 *   - mode `forupdate` → SELECT-nya BLOCK mendekati TAHAN_MS → terserialisasi
 *                        sampai proses pertama commit.
 *
 * Pakai (backend docker jalan): node scripts/uji-race-otp-lock.mjs
 */

import { execSync } from 'node:child_process'

const EMAIL = 'race.lock.uji@example.com'
const PURPOSE = 'lupa_password'
const TAHAN_MS = 800

function run(cmd) {
  return execSync(cmd, { cwd: process.cwd(), encoding: 'utf8', timeout: 60000 })
}

function seed() {
  run(`docker compose exec -T php php scripts/uji-otp-helper.php clear ${EMAIL} ${PURPOSE}`)
  run(
    `docker compose exec -T php php -r ` +
      `"require '/app/app/lib/bootstrap.php'; \\$pdo=db(); ` +
      `\\$pdo->prepare('INSERT INTO otps (email,purpose,code_hash,expires_at,attempts,consumed,created_at) VALUES (?,?,?,?,0,0,?)')` +
      `->execute(['${EMAIL}','${PURPOSE}',password_hash('999999',PASSWORD_DEFAULT),date('Y-m-d H:i:s',time()+300),date('Y-m-d H:i:s')]); echo 'ok';"`
  )
}

// Jalankan dua proses mode sama, ambil durasi SELECT (selesai - mulai) tiap proses.
function jalankan(mode) {
  const spawn =
    `php /app/scripts/uji-race-otp-lock.php ${EMAIL} ${PURPOSE} ${mode} ${TAHAN_MS} & ` +
    `php /app/scripts/uji-race-otp-lock.php ${EMAIL} ${PURPOSE} ${mode} ${TAHAN_MS} & ` +
    `wait`
  const out = run(`docker compose exec -T php sh -c '${spawn}'`)
  const durasi = []
  for (const line of out.split('\n')) {
    const m = line.trim().match(/^([\d.]+)\s+([\d.]+)$/)
    if (m) durasi.push((parseFloat(m[2]) - parseFloat(m[1])) * 1000) // ms
  }
  return durasi
}

let gagal = 0
function check(judul, ok, info = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${judul}${info ? '  — ' + info : ''}`)
  if (!ok) gagal++
}

const fmt = (arr) => arr.map((d) => d.toFixed(1) + 'ms').join(' | ')

console.log('Uji tingkat lock: SELECT biasa vs SELECT … FOR UPDATE\n')

seed()
const plain = jalankan('plain')
// Tanpa lock: kedua SELECT selesai cepat (tidak ada yang diblokir).
check(
  'mode PLAIN: kedua SELECT selesai cepat (tidak ada blocking)',
  plain.length === 2 && plain.every((d) => d < 100),
  fmt(plain)
)

seed()
const fu = jalankan('forupdate')
// Dengan lock: salah satu SELECT terblock mendekati TAHAN_MS.
const adaBlock = fu.some((d) => d >= TAHAN_MS * 0.6)
check(
  `mode FOR UPDATE: salah satu SELECT terblock ~${TAHAN_MS}ms (serialisasi)`,
  fu.length === 2 && adaBlock,
  fmt(fu)
)

run(`docker compose exec -T php php scripts/uji-otp-helper.php clear ${EMAIL} ${PURPOSE}`)

console.log(`\n${gagal === 0 ? 'SEMUA LULUS' : gagal + ' GAGAL'}`)
process.exit(gagal === 0 ? 0 : 1)

