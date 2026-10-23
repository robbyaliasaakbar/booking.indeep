# App InDeep Booking

[![License: proprietary](https://img.shields.io/badge/license-proprietary-lightgrey)](LICENSE)

**Sistem booking mandiri untuk [InDeepCleaningID](https://indeepcleaningid.site)** —
bisnis jasa cuci (sofa, kasur, karpet, gordyn, interior mobil, baby stuff).

> **Alamat produksi:** <https://booking.indeepcleaningid.site> (subdomain).
> Path lama `indeepcleaningid.site/app-booking/` sudah **tidak dipakai** (404).
>
> **Catatan monorepo:** app ini tinggal di subfolder `booking/` dari repo
> `indeepcleaningid/digital-assets-indeepcleaningid` (satu repo dengan website
> utama). Semua perintah di dokumen ini dijalankan dari folder `booking/`.

> **English (TL;DR):** A production booking system for a real cleaning-service
> business — self-service scheduling, server-side pricing from a 44-SKU catalog,
> race-safe slot locking (MySQL transactions), an admin dashboard, Google OAuth
> plus email/password login, and OTP-protected password & email changes. Built
> with PHP 8.3 (zero dependencies) + React 19 + Vite on shared hosting. CI
> workflow exists but is **not active yet** (see [Deployment dan CI/CD](#deployment-dan-cicd)).
> The repository is open for inspection and serves paying customers daily —
> see [SECURITY.md](SECURITY.md) for the no-secrets policy and disclosure.

Customer memesan slot sendiri dalam waktu kurang dari 5 menit tanpa chat
negosiasi panjang. Admin memantau semuanya dari satu dashboard. Semua harga
datang dari database, semua slot dijamin bebas bentrok, dan setiap order
memenuhi minimum order — secara otomatis.

> **Status:** production — `main` langsung ter-deploy ke production. Semua
> perubahan wajib lewat Pull Request — baca [CONTRIBUTING.md](CONTRIBUTING.md).
> Repository **proprietary**, dibuka untuk inspeksi (bukan open-source) —
> lihat [LICENSE](LICENSE).

---

## Daftar Isi

- [Kenapa App Ini Ada](#kenapa-app-ini-ada)
- [Fitur](#fitur)
- [Tech Stack](#tech-stack)
- [Arsitektur](#arsitektur)
- [Struktur Repo](#struktur-repo)
- [Mulai Dari Nol (Local Dev)](#mulai-dari-nol-local-dev)
- [Pengujian](#pengujian)
- [Deployment dan CI/CD](#deployment-dan-cicd)
- [Referensi Konfigurasi](#referensi-konfigurasi)
- [Model Keamanan](#model-keamanan)
- [Integrasi](#integrasi)
- [Keterbatasan yang Diketahui dan Roadmap](#keterbatasan-yang-diketahui-dan-roadmap)
- [Peta Dokumentasi](#peta-dokumentasi)
- [Lisensi](#lisensi)

---

## Kenapa App Ini Ada

Bisnisnya jalan hampir otomatis di operasional inti, tapi pintu masuk order
masih lewat chat manual dan bocor di titik-titik yang predictable:

| Masalah hari ini | Yang dijaga sistem |
|---|---|
| Alamat setengah jadi, teknisi muter-muter cari rumah | Alamat terstruktur 6 field, 5 field wajib, tersimpan sebagai default |
| Harga dihafal manual (salah ingat kasur 160 vs 180) | Semua harga dibaca dari tabel pricelist 44 SKU, dihitung ulang di server |
| Jadwal dobel booking | Transaksi MySQL InnoDB + kunci baris: 1 booking aktif per tanggal-jam, yang kalah dapat `409` |
| Order kecil yang gak nutup ongkos jalan | Minimum order **Rp250.000** dipaksa di UI *dan* API (`422`) |
| Gak ada jejak audit kalo ada masalah | Tiap ganti status menulis audit log (siapa, kapan, dari → ke, alasan) |

**Tujuan:** customer booking < 5 menit · zero overbook · zero harga manual ·
satu dashboard admin yang jujur · local dev nyala dengan satu perintah.

---

## Fitur

### Customer

- **Login Google** (OAuth 2.0, implementasi mentah — nol library pihak ketiga;
  sudah aktif di produksi) dan **login email + password** manual buat customer
  yang menyetel password lewat alur "Lupa password" (rate limit 5 percobaan /
  10 menit / IP)
- Pelengkapan profil wajib (nama, WhatsApp utama, alamat terstruktur)
- **Wizard booking 5 langkah**: identitas → item → jadwal → review → sukses
- Estimasi harga realtime sambil pilih item (cari + filter kategori di 44 SKU)
- Checkbox biaya tambahan dengan aturan yang jelas (kasur latex, sofa lebar,
  sofa bantalan lepas pasang)
- Pemilih jadwal: **Rabu–Senin saja** (Selasa libur), 2 slot per hari
  (`09.00` / `13.00`), cutoff hari H 7 jam sebelumnya, maksimal H+30
- Riwayat booking, batal sendiri (pending/confirmed, H-1), struk PDF (jsPDF)
- Profil: upload foto (2 MB, jpg/png/webp), nomor WhatsApp, alamat,
  preferensi — ganti password dan ganti email dilindungi **OTP 6 digit via email**

### Admin

- Login username/password (halaman terpisah, hash Argon2id, kena rate limit)
- Dashboard KPI: booking hari ini/besok, pending konfirmasi, slot penuh,
  estimasi omzet bulan ini
- Detail booking dengan konfirmasi / tolak / reschedule / cancel / selesaikan —
  **alasan wajib**, dijaga optimistic locking (kolom `version`)
- Kalender slot: kunci/buka/kapasitas per slot, hijau/merah/abu sekilas pandang
- Daftar customer, kelola pricelist (ubah harga = superadmin saja),
  audit log, laporan sederhana
- Role: `admin` dan `superadmin` (Bang Rob)

---

## Tech Stack

| Lapisan | Pilihan | Alasan |
|---|---|---|
| Frontend | **React 19 + Vite 8 + Tailwind CSS 4 + React Router 7** | State multi-step rumit (wizard, filter, chart) — vanilla JS bakal jadi boilerplate. Build Vite menghasilkan file statis yang tinggal diserve host |
| Struk PDF | jsPDF | Generate struk di browser, gak perlu library PDF server |
| Backend | **PHP 8.3, nol dependensi** (tanpa Composer, tanpa framework) | Tiap baris bisa ditrace di shared hosting; gak ada `composer install` saat deploy. Filosofi sama kayak auth backend EXP011 |
| Database | **MariaDB 11** lokal (Docker), **MySQL InnoDB** di Hostinger | Kunci baris InnoDB + transaksi bikin booking slot anti-bentrok |
| Session | Session PHP native (`HttpOnly` + `SameSite`) | Gak ribet JWT; pencabutan dari server cukup hapus baris |
| Email (OTP) | **Klien SMTP mentah** `app/lib/smtp.php` — Gmail, TLS implisit :465, App Password | Menggantikan PHPMailer sesuai amendmen PRD 10.4: satu provider, zero dep, tiap dialog bisa ditrace |
| Login Google | Alur OAuth 2.0 mentah dengan `state` acak di session | Aturan zero-dep yang sama |
| Validasi | PHP di server (percaya browser = bahaya) + guard ramah di FE | Defense in depth |
| Test | Skrip Node polos yang nembak API + skrip headless-Chrome CDP buat UI | Tanpa framework test; jalan di mana aja |
| CI | GitHub Actions: `php -l` + build Vite + cek sinkron bundle — **⚠️ belum aktif** (file workflow masih di `booking/.github/workflows/`, belum di root repo; lihat [Deployment dan CI/CD](#deployment-dan-cicd)) | Nangkep error sintaks dan "lupa rebuild" sebelum direview — sementara ini dijalankan manual |
| Deploy | Push ke `main` → **auto-deploy Hostinger (15–20 detik)**, sudah terbukti (bundle live == bundle `main`) | Tanpa upload manual, tanpa SSH |

### Konvensi waktu (WIB)

Semua waktu aplikasi = **WIB (Asia/Jakarta)** dan diset dari **kode**, bukan
dari server (issue #18) — produksi Hostinger tidak menyetel timezone apa pun:

- `app/lib/bootstrap.php` → `date_default_timezone_set('Asia/Jakarta')` untuk
  semua endpoint & skrip cron (hari ini di dashboard, cutoff H-1 cancel,
  expiry/cooldown OTP, window rate limit).
- `app/lib/db.php` → `SET time_zone = '+07:00'` per koneksi, jadi `NOW()` /
  `CURDATE()` / `DEFAULT CURRENT_TIMESTAMP` di MySQL juga WIB (updated_at,
  `login_attempts`, expire-bookings vs slot bisnis).
- Rate limit window **ditulis dari PHP** (`date()`), bukan `NOW()` DB —
  satu sumber per konteks, jangan dikembalikan ke campur.
- Satu pengecualian sengaja: **`audit_logs.created_at` = `UTC_TIMESTAMP()`**
  sesuai PRD Bab 15 — tampil mentah (UTC) di halaman logs admin.

---

## Arsitektur

```
        ┌───────────────────────────────────┐
        │  Browser — React SPA (built)      │
        │  booking.indeepcleaningid.site    │
        └────────────────┬──────────────────┘
                         │  fetch  /api/*.php  (base '/')
                         │  (cookie session, Origin dicek)
        ┌────────────────▼──────────────────┐
        │  Hostinger shared hosting         │
        │  Apache → root .htaccess router   │
        │  ├── blok config/ app/ scripts/   │
        │  ├── /api/*.php  → PHP 8.3        │
        │  └── sisanya     → public/        │
        │       (SPA + asset built)         │
        └───────┬────────────────┬──────────┘
                │ PDO            │ raw SMTP :465
        ┌───────▼───────┐  ┌─────▼──────────┐
        │ MySQL InnoDB  │  │ Gmail (OTP)    │
        │ (Hostinger)   │  │ App Password   │
        └───────────────┘  └────────────────┘

Local dev mencerminkannya 1:1 pakai Docker:

  Vite :5173 ──proxy /api, /uploads──▶ container PHP :5011 ──▶ MariaDB 11
  (auto-seed kalo DB kosong)
```

**Siklus request:** cek origin allowlist (khusus request tulis) → lookup
session → handler validasi input → aturan bisnis dicek ulang di server (harga
dari DB, kapasitas slot di dalam transaksi InnoDB) → JSON seragam
(`{code, message, details}` kalo error).

**Aturan server yang kunci:** harga selalu dihitung ulang dari `pricelist`;
kapasitas slot 1 per tanggal-jam dijaga `SELECT … FOR UPDATE`; create booking
idempoten lewat `idempotency_key`; update status wajib kirim `version` berjalan
(optimistic lock → `409` kalo ketinggalan).

---

## Struktur Repo

Repo ini **berdiri sendiri** (repo terpisah dari website utama) dan isinya
persis root project ini. Di server Hostinger folder ini hidup di
`public_html/booking/`.

```
<root repo = folder app di server>
├── public/                  # ← yang ter-deploy ke server (SPA built + API)
│   ├── index.html           #    entry hasil build (Vite outDir)
│   ├── assets/              #    bundle JS/CSS ber-hash (wajib ikut di-commit)
│   ├── api/                 #    endpoint PHP (pricelist, bookings, admin, auth)
│   ├── brand/, uploads/     #    logo, foto profil (uploads/* di-gitignore)
│   └── .htaccess            #    fallback SPA + guard upload + blok login-dev
├── .htaccess                # router: blok file repo internal → public/
├── app/
│   └── lib/                 # bootstrap, db, session, security (origin check),
│                            # mailer + smtp.php, otp, ratelimit, slots, audit
├── config/
│   ├── config.example.php   # template (di-commit)
│   └── config.php           # kredensial ASLI — tidak pernah di-commit
├── web/                     # source React
│   ├── src/pages/           # route: landing, booking, riwayat, profil, admin/*
│   ├── src/components/      # UI bersama (termasuk PasswordInput)
│   ├── src/lib/             # api.js (wrapper fetch), context auth, helper
│   └── vite.config.js       # outDir ../public, proxy :5011, base default '/'
├── scripts/
│   ├── dev.mjs              # orkestrator `npm run dev` (Docker + seed + Vite)
│   ├── seed.php             # pricelist 44 SKU, surcharge, admin, slot
│   ├── expire-bookings.php  # cron: booking kedaluwarsa (5 menit)
│   ├── cleanup-otp.php      # cron: hapus OTP expired (10 menit)
    │   └── uji-*.mjs / *.php    # suite uji (lihat Pengujian)
├── storage/                 # log dev lokal (otp-dev.log, di-gitignore)
├── docker-compose.yml       # MariaDB 11 + PHP 8.3 container (:5011)
├── .github/workflows/ci.yml # CI: php -l + build + cek sinkron bundle
├── README.md · CONTRIBUTING.md · ENGINEER.md · LICENSE
└── (Credential+plan/        # PRD internal — di-gitignore, tidak pernah ke-push)
```

> Catatan: `app/models/` (lapis query PDO per tabel) **belum ada** — PRD
> menjanjikannya, kode saat ini masih pakai PDO langsung di endpoint. Pembahasan:
> issue #13.

---

## Mulai Dari Nol (Local Dev)

**Prasyarat:** Node.js 20+ (22 dipakai CI), Docker, git.

```bash
git clone https://github.com/robbyaliasaakbar/booking.indeep.git
cd booking.indeep

# 1. Config backend dari template (default udah cocok buat Docker lokal)
cp config/config.example.php config/config.php

# 2. Deps frontend
npm ci --prefix web

# 3. Nyalain semua: Docker (MariaDB + PHP :5011) + auto-seed + Vite :5173
npm run dev
```

Buka URL yang dicetak Vite (biasanya `http://localhost:5173`).

| Bagian | Di mana |
|---|---|
| Frontend | `:5173` (otomatis geser ke 5174/5175 kalo penuh) |
| Backend API | `:5011` (Docker, diproxy Vite sebagai `/api` + `/uploads`) |
| Login admin | `/admin/login` — username & password dari `SEED_ADMIN_*` di `config/config.php` (isi sendiri — tidak ada default di repo) |
| Login customer | `/login` — tombol Google (pintu utama) + form email & password |
| Database | Docker `MariaDB 11`, auto-seed 44 SKU + 3 surcharge + admin saat first boot |

Perintah lain:

```bash
npm run dev:web      # Vite doang
npm run dev:api      # backend Docker doang
npm run seed         # isi ulang database
npm run build        # build produksi → public/
```

---

## Pengujian

Skrip test berupa Node/PHP polos — tanpa framework. Jaga suite tetap hijau
sebelum buka PR. (CI GitHub Actions **belum aktif** saat ini — `php -l` + build
masih dijalankan manual; lihat [Deployment dan CI/CD](#deployment-dan-cicd).)

| Suite | Perintah | Cakupan |
|---|---|---|
| Login password (19 cek) | `node scripts/uji-login-password.mjs` | login email+password, pesan generik, akun Google-only, rate limit 5/10 menit, audit |
| OTP (21 cek) | `node scripts/uji-otp-tahap3.mjs` | request/verify/cooldown/lockout OTP buat ganti password & ganti email |
| Admin API (33 cek) | `node scripts/uji-admin-tahap4.mjs` | login admin, rate limit, dashboard, guard CRUD, pindah jadwal (aturan Selasa/lewat/H+30) |
| Tahap 2 (16 cek / 9 skenario) | `node scripts/uji-tahap2.mjs` | subtotal, surcharge, minimum order, aturan hari/jam, balapan slot, double-submit, kontrak alamat |
| Keamanan (23 cek) | `node scripts/uji-security-tahap29.mjs` | attempt cap OTP, IDOR horizontal/vertical, mass assignment, idempotency lintas user |
| Balapan slot (helper) | `php scripts/uji-race-tahap2.php <YYYY-MM-DD> <A\|B>` | dipanggil suite Tahap 2 skenario 7 — 1 menang, 1 ditolak |

> Diketahui: skenario 2 di Tahap 2 (surcharge latex + sofa lebar) **gagal
> pre-existing** — validasi `surcharge_qty_mismatch` menolak payload uji lama.
> Bukan regresi.

### Reset state uji (idempoten antar-run)

Tiap suite `.mjs` sekarang **mereset state di awal** lewat `scripts/reset-uji.php`
(issue #38), jadi bisa dijalankan beruntun tanpa gagal palsu. Reset membersihkan:
`otps`, `login_attempts`, `api_rate_limits`, `slots`, dan data ber-email `*@test.dev`
(booking + items + surcharges + alamat + user). **Tidak** menyentuh pricelist,
surcharges, atau user asli.

Manual bila perlu:

```bash
docker compose exec -T php php /app/scripts/reset-uji.php
```

Alur UI diverifikasi pakai headless Chrome lewat DevTools protocol
(login → wizard → profil), dan smoke test production dijalankan ke live
setelah deploy (canary origin, login, availability, upload foto).

---

## Deployment dan CI/CD

**Model: build lokal → push `main` → Hostinger auto-deploy.**

1. Build dengan env produksi. **Base harus `/`** (produksi = subdomain
   `booking.indeepcleaningid.site`, bukan sub-path) — jangan isi
   `VITE_BASE_PATH` / `VITE_BASENAME`. `VITE_WA_ADMIN` wajib diisi supaya
   tombol "Hubungi Admin" muncul:

   ```bash
   VITE_WA_ADMIN=628xxxxxxxxxxx npm run build   # tulis ke public/ (Vite outDir)
   ```

2. Commit kode **dan** `public/` hasil build ulang (host tidak menjalankan
   npm — yang masuk `public/` itu yang ter-deploy).
3. Buka PR → **Bang Rob review dan merge manual**. Karena CI belum aktif,
   jalankan sendiri checklist-nya: `php -l` semua PHP + suite uji + build ulang.
4. Hostinger menyinkronkan repo ke server dalam **15–20 detik**. Sudah
   diverifikasi: hash bundle di `main` == hash bundle yang diserve produksi.
5. Smoke-check live: landing kebuka, API GET balas JSON, gak ada `500`,
   dan `POST /api/login-dev.php` tetap balas `403`.

**CI (GitHub Actions)** — file workflow-nya ada di
**`booking/.github/workflows/ci.yml`**, sedangkan GitHub hanya membaca
`.github/workflows/` di **root repo**. Jadi workflow ini **belum pernah jalan**
(cek: `gh run list` kosong) dan ini harus dipindah dulu sebelum bisa dipakai.
Isinya kalau aktif:

- `php-lint` — `php -l` semua PHP di `public/`, `app/`, `scripts/`
- `frontend-build` — `npm ci` bersih + build + `git diff --exit-code public/`
  biar bundle ke-commit yang basi bikin PR gagal

Memindahkannya ke root repo adalah pekerjaan terpisah (belum ada PR-nya).

**Fakta sisi server yang perlu diketahui:**

- Produksi = subdomain **`booking.indeepcleaningid.site`**; folder app di
  server adalah folder repo ini (docroot-nya root repo, `.htaccess` yang
  mengarahkan ke `public/`). Path lama `/app-booking/` sudah dimatikan (404).
- `config/config.php` di server diedit lewat File Manager Hostinger, hidup
  di luar git, dan **selamat dari deploy** (sudah diuji — `uploads/` juga)
- Root `.htaccess` memblokir akses web ke `config/`, `app/`, `scripts/`,
  `storage/`, `.git`, `Credential+plan/`, nama file kayak `*.md`,
  `package.json`, plus `login-dev.php` (issue #27)
- Dua cron jobs diatur di hPanel (bukan scheduler DB — shared hosting).
  Folder app di server: `public_html/booking/` (di dalam `public_html`
  website utama). Sesuaikan `<user>` dengan username hosting:

  ```
  tiap 5 menit : php -f /home/<user>/public_html/booking/scripts/expire-bookings.php
  tiap 10 menit: php -f /home/<user>/public_html/booking/scripts/cleanup-otp.php
  ```

---

## Referensi Konfigurasi

### `config/config.php` (server/lokal, tidak pernah di-commit)

| Key | Default lokal | Production |
|---|---|---|
| `DB_HOST`, `DB_NAME`, `DB_USER`, `DB_PASS` | Docker MariaDB | MySQL Hostinger |
| `APP_URL` | `http://localhost:5011` | `https://booking.indeepcleaningid.site` (terkonfirmasi dari `redirect_uri` Google yang dipakai produksi) |
| `WEB_URL` | `http://localhost:5173` | origin frontend produksi — `https://booking.indeepcleaningid.site` (dipakai allowlist Origin; **origin saja, bukan path**) |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | kosong → login balas `503 google_disabled` | **terisi & aktif**; redirect URI Google Console: `https://booking.indeepcleaningid.site/api/google-callback.php` |
| `SMTP_HOST` / `SMTP_USER` / `SMTP_PASS` | kosong → OTP ditulis ke `storage/otp-dev.log` | `smtp.gmail.com` + Gmail App Password (aktif sejak 12 Okt 2026) |
| `SEED_ADMIN_USERNAME` / `SEED_ADMIN_PASSWORD` | `admin indeep` / **wajib diisi sendiri** | password tidak pernah ada di repo — hanya di config server |
| `MIN_ORDER_IDR` | `250000` | `250000` |
| `SLOT_CAPACITY_DEFAULT` | `1` | `1` |

### `web/.env` (opsional, dari `web/.env.example`)

| Key | Fungsi |
|---|---|
| `VITE_API_URL` | biasanya kosong — API ikut `BASE_URL` (proxy `/api` saat dev, `/api` langsung di produksi) |
| `VITE_BASE_PATH` / `VITE_BASENAME` | **kosongkan** — produksi sekarang subdomain dengan base `/`. Isi hanya kalau app dipindah ke sub-path |
| `VITE_WA_ADMIN` | WA admin `628…` buat tombol "Hubungi Admin"; disembunyikan kalo kosong. Produksi saat ini: `6287748244464` |

---

## Model Keamanan

- **Origin allowlist di semua request tulis** (POST/PATCH/PUT/DELETE) —
  dibandingkan sebagai `scheme://host[:port]`, origin salah →
  `403 origin_denied`; dipadu cookie `SameSite` menggantikan token CSRF per form
- **Session**: PHP native, `HttpOnly` + `Secure`, id di-regenerate saat login,
  pencabutan dari server
- **Rate limit**: login (admin & customer) 5 / 10 menit / IP (tabel
  `login_attempts`, basis `REMOTE_ADDR`), cooldown kirim ulang OTP 60 detik,
  maks 5 percobaan OTP lalu kunci 15 menit
- **OTP**: 6 digit, kedaluwarsa 5 menit, **di-hash** saat disimpan, terikat
  purpose (`ganti_email` butuh dua kode — alamat lama + baru)
- **Password**: Argon2id (fallback bcrypt-12)
- **Upload**: jpg/png/webp saja, maks 2 MB, nama acak, foto lama dihapus saat
  ganti, guard `index.php` di `public/uploads/`
- **Pesan auth generik**: password salah dan email tidak terdaftar dibalas
  `401` dengan pesan yang **identik** (anti-enumerasi). Satu pengecualian yang
  disengaja: akun yang belum punya password (dibuat via Google) dibalas
  `409 password_not_set` + arahan — trade-off UX vs enumerasi, keputusan
  produk issue #30
- **`login-dev.php` bukan jalur produksi**: hanya hidup di server lokal
  (`APP_URL` lokal **dan** SAPI `cli-server`), diblokir juga di level web
  server (`403`) — jejaknya dicatat `audit_log` (issue #27)
- **Gagal dengan jujur**: kalo SMTP belum diisi di produksi, API balas
  `503 email_disabled` — bukan pura-pura email terkirim
- **Rahasia**: `config/config.php`, `.env`, `Credential+plan/` masuk
  `.gitignore`; rahasia produksi hanya hidup di config server

---

## Integrasi

| Layanan | Status | Catatan |
|---|---|---|
| **Google OAuth 2.0** | ✅ aktif | Produksi balas `302` ke `accounts.google.com` dengan `client_id` terisi (dicek 15 Okt 2026). Redirect URI: `https://booking.indeepcleaningid.site/api/google-callback.php` |
| **Gmail SMTP (OTP)** | ✅ aktif sejak 12 Okt 2026 | App Password, TLS implisit :465, klien mentah `app/lib/smtp.php` |
| **WhatsApp (MinDi)** | ✅ | Tombol "Hubungi Admin" via `VITE_WA_ADMIN` (`6287748244464`) |
| **Hostinger** | ✅ | Shared hosting, MySQL, auto-deploy dari GitHub, cron hPanel |
| **GitHub Actions** | ⚠️ belum aktif | Workflow ada di `booking/.github/workflows/ci.yml` — GitHub hanya baca `.github/workflows/` di root repo, jadi belum pernah jalan (`gh run list` kosong) |

---

## Keterbatasan yang Diketahui dan Roadmap

- **CI belum jalan** — workflow harus dipindah ke root repo dulu (pekerjaan
  terpisah; lihat [Deployment dan CI/CD](#deployment-dan-cicd))
- **Rate limit IP: key `REMOTE_ADDR`, belum siap CDN** — endpoint auth
  (`otp-request`, `otp-verify`, `admin-login`, `login`) di-hitung per
  `REMOTE_ADDR` (anti XFF spoof, issue #25); `login_attempts` dipakai
  bersama admin + customer tanpa filter username. Trade-off-nya: kalau
  nanti dipasang CDN/proxy di depan, `REMOTE_ADDR` jadi IP proxy → semua
  client masuk bucket bersama — evaluasi trusted-proxy dulu sebelum
  pasang CDN (endpoint publik sudah beda jalur: `client_ip()` baca XFF)
- **`app/models/` belum ada** — query PDO masih langsung di endpoint. Diskusi
  arsitektur: issue #13
- **2 cron jobs hPanel** wajib ada (5 menit expire-bookings, 10 menit
  cleanup-otp)
- **Password admin wajib diganti** dari default seed saat serah terima
- State rate limit dan OTP hidup di MySQL (cukup buat skala sekarang;
  Redis kalo nanti naik kelas)
- Di luar cakupan v1 (per PRD): pembayaran online, notifikasi WA/SMS, app
  mobile, multi-cabang, rute optimasi, foto before/after

---

## Peta Dokumentasi

| Dokumen | Bahasa | Isi |
|---|---|---|
| [CONTRIBUTING.md](CONTRIBUTING.md) | Indonesia | Alur wajib PR, aturan review, checklist |
| [ENGINEER.md](ENGINEER.md) | Indonesia | Log perubahan — **diupdate di tiap PR** |
| [LICENSE](LICENSE) | Inggris | Proprietary — all rights reserved |
| PRD internal | Indonesia | Spesifikasi produk yang locked — ada di `Credential+plan/`, **tidak** di git |

---

## Lisensi

Copyright (c) 2026 Robby. All rights reserved.

Perangkat lunak proprietari milik bisnis — **dibuka untuk inspeksi**, bukan
open-source. Dilarang menyalin, mendistribusikan, membuat karya turunan, atau
memanfaatkan untuk layanan bersaing tanpa izin tertulis —
lihat [LICENSE](LICENSE).
