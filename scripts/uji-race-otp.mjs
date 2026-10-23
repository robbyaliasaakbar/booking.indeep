/**
 * Uji balapan attempt cap OTP (issue #26).
 *
 * Menembak N proses paralel `otp_verify()` dengan kode SALAH ke email+purpose
 * yang punya kode aktif, lalu memastikan:
 *   1. attempts akhir di DB TEPAT = OTP_MAX_ATTEMPTS (5) — tidak lebih.
 *   2. Jumlah respons yang sampai ke password_verify() (otp_salah + terlalu_sering)
 *      tidak melebihi OTP_MAX_ATTEMPTS.
 *
 * Race lama (sebelum fix): beberapa request lolos gate bersamaan sehingga
 * attempts bisa > 5 dan lebih dari 5 langkah menjalankan password_verify().
 *
 * Pakai: backend docker jalan dulu (docker compose up -d), lalu dari folder
 * booking/:
 *   node scripts/uji-race-otp.mjs
 */

import { execSync } from 'node:child_process'

const N = 20 // jumlah request paralel
const EMAIL = 'race.otp.uji@example.com'
const PURPOSE = 'lupa_password'
const CODE_SALAH = '000000'

function run(cmd) {
  return execSync(cmd, { cwd: process.cwd(), encoding: 'utf8', timeout: 120000 })
}

function kodeDariOutput(out) {
  // Tiap proses mencetak satu JSON; shell menambahkan newline pemisah.
  const codes = []
  for (const line of out.split('\n')) {
    const t = line.trim()
    if (!t.startsWith('{')) continue
    try {
      codes.push(JSON.parse(t).code || '?')
    } catch {
      codes.push('PARSE_ERR')
    }
  }
  return codes
}

let gagal = 0
function check(judul, ok, info = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${judul}${info ? '  — ' + info : ''}`)
  if (!ok) gagal++
}

console.log(`Uji balapan attempt cap OTP — ${N} request paralel kode salah\n`)

// 1. Bersihkan + siapkan 1 kode OTP aktif untuk email uji.
run(`docker compose exec -T php php scripts/uji-otp-helper.php clear ${EMAIL} ${PURPOSE}`)
// Seed hash kode aktif lewat helper khusus (insert langsung, tanpa cooldown).
const seedOut = run(
  `docker compose exec -T php php -r ` +
    `"require '/app/app/lib/bootstrap.php'; require '/app/app/lib/otp.php'; ` +
    `\\$pdo=db(); \\$pdo->prepare('INSERT INTO otps (email,purpose,code_hash,expires_at,attempts,consumed,created_at) VALUES (?,?,?,?,0,0,?)')` +
    `->execute(['${EMAIL}','${PURPOSE}',password_hash('999999',PASSWORD_DEFAULT),date('Y-m-d H:i:s',time()+300),date('Y-m-d H:i:s')]); echo 'seeded';"`
)
check('Siapkan kode OTP aktif untuk email uji', seedOut.includes('seeded'), seedOut.trim())

// 2. Tembak N request paralel.
const spawn = Array.from({ length: N }, () => `php /app/scripts/uji-race-otp.php ${EMAIL} ${PURPOSE}; echo`).join(' & ')
const out = run(`docker compose exec -T php sh -c '${spawn} wait'`)

const codes = kodeDariOutput(out)
const nSalah = codes.filter((c) => c === 'otp_salah').length
const nKunci = codes.filter((c) => c === 'terlalu_sering').length
const nHilang = codes.filter((c) => c === 'otp_not_found' || c === 'otp_kedaluwarsa').length
const nTotal = codes.length

console.log(`Respons: total=${nTotal} salah=${nSalah} kunci=${nKunci} hilang=${nHilang}\n`)

check('Semua request mengembalikan JSON (tidak ada error infra)', nTotal === N, `terbaca ${nTotal}/${N}`)
check('Tidak ada respons "kode tidak ditemukan"', nHilang === 0, `hilang=${nHilang}`)

// 3. attempts akhir di DB = SATU-SATUNYA bukti definitif "berapa request yang
// sampai password_verify()": attempts hanya naik setelah verify gagal, di
// dalam transaksi terkunci. Target: TEPAT 5 (tidak lebih).
const attemptsOut = run(
  `docker compose exec -T php php -r ` +
    `"require '/app/app/lib/bootstrap.php'; \\$pdo=db(); ` +
    `\\$s=\\$pdo->prepare('SELECT MAX(attempts) AS m FROM otps WHERE email=? AND purpose=?'); \\$s->execute(['${EMAIL}','${PURPOSE}']); echo (int)(\\$s->fetch()['m'] ?? 0);"`
)
const attempts = parseInt(attemptsOut.trim(), 10)
check('Jumlah yang sampai password_verify() (= attempts) TEPAT 5', attempts === 5, `attempts=${attempts}`)
check('attempts tidak melebihi cap walau 20 request paralel', attempts <= 5, `attempts=${attempts}`)

// 4. Sisanya harus diblokir (429), bukan lolos diam-diam.
check(
  `request sisa diblokir (kunci=${nKunci}, diharapkan >= ${N - 5})`,
  nKunci >= N - 5,
  `kunci=${nKunci}`
)

// 5. Bersih-bersih data uji.
run(`docker compose exec -T php php scripts/uji-otp-helper.php clear ${EMAIL} ${PURPOSE}`)

console.log(`\n${gagal === 0 ? 'SEMUA LULUS' : gagal + ' GAGAL'}`)
process.exit(gagal === 0 ? 0 : 1)
