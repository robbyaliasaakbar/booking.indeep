# ENGINEER — Log Perubahan Sistem

> Riwayat perubahan teknis App InDeep Booking. **Setiap PR wajib menambah
> entry baru di sini** (aturan di [CONTRIBUTING.md](CONTRIBUTING.md)).
>
> Format: tanggal (YYYY-MM-DD) → judul → commit/PR → **apa** yang berubah →
> **kenapa** → file kena.

---

## 2026-10-16

### FE polish: seragamkan token CSS — border-ink, shadow-brutal-sm, input-brutal (batch 3c) — issue #3

- **Apa**:
  - `border-black` → `border-ink` di **semua JSX (17 file)** — `--color-ink:
    #000000` (hitam identik, murni konsistensi token, visual tak berubah).
  - `shadow-[3px_3px_0_0_#000000]` (Login) → token `shadow-brutal-sm` (nilai
    sama persis). `shadow-[2px_...]` hover **tidak diubah** — itu pola inline
    `.btn-press`, gak punya token sendiri (bukan bagian issue).
  - Styling input manual → token `.input-brutal`: `fieldClass` wizard
    (`AddressFields.jsx`, `StepIdentitas.jsx` — dulu nulis `w-full rounded-xl
    border-2 border-ink bg-white px-3 py-2 text-base focus:outline-none
    focus-visible:outline-3`), search+select `StepItem.jsx`, textarea alasan
    `Riwayat.jsx`.
  - Build ulang `public/`.
- **Kenapa**: Issue #3 — token dipakai tangan: `border-black` 46× vs
  `border-ink`; input styling manual nulis ulang token yang sudah ada.
  Sekarang satu sumber. **Catatan**: bikin komponen `<Input>` terpisah (usulan
  issue) **tidak dilakukan** — utility class `.input-brutal` sudah cukup buat
  seragam & menghindari abstraction layer baru tanpa kebutuhan nyata.
  Perubahan focus ring wizard input mengikuti konsistensi 12 file lain yang
  sudah pakai `.input-brutal`.
- **Bukti**: grep `border-black` / `shadow-[3px` / styling manual → **0 sisa**;
  `npm run build` sukses.
- **File**: 17 JSX (lihat grep), `public/` (bundle rebuild), `ENGINEER.md`.

### FE polish: tabel → cards mobile semua daftar admin (batch 3b) — issue #3

- **Apa**:
  - `admin/Reports.jsx` — bungkus 2 tabel (Per Status, Harian) dengan
    `overflow-x-auto` — kolom "Nilai"/Rupiah panjang bisa luber di HP.
  - `admin/Customers.jsx` — tabel dibuat desktop-only (`hidden lg:block`) +
    cards mobile `lg:hidden` (nama, email, WA, alamat, booking, aksi edit/hapus).
  - `admin/Logs.jsx` — pola sama: tabel desktop + cards (aksi, waktu UTC,
    pelaku, booking, perubahan status, alasan).
  - `admin/Slots.jsx` — kalender: tabel grid desktop + cards per tanggal
    (2 tombol slot 09.00/13.00 dengan warna status yang sama).
  - `admin/Pricelist.jsx` — tabel desktop + cards mobile **read-only** + tombol
    Aktif/Nonaktif. **Edit detail (nama/harga/kategori) tetap via desktop** —
    popover inline menempel di sel tabel, tidak dipindah ke cards (keputusan
    sadar; HP untuk pantau + toggle).
  - `admin/Bookings.jsx` — **tidak disentuh**: sudah punya pola
    `isDesktop` + `BookingRow variant="table"|"card"` (hasil issue #7 batch 2).
  - Build ulang `public/`.
- **Kenapa**: Issue #3 — "Table→cards cuma 2 dari 8 daftar; Reports card bahkan
  tanpa `overflow-x-auto` → luber di HP". Admin dicek dari HP pun sekarang
  aman di semua halaman.
- **Bukti**: `npm run build` sukses; pola mengikuti `Pricelist` customer
  (`hidden lg:block` / `lg:hidden`) yang sudah ada sebelumnya.
- **File**: `admin/{Reports,Customers,Logs,Slots,Pricelist}.jsx`, `public/`
  (bundle rebuild), `ENGINEER.md`.

### FE polish: kategori booking di-derive dari pricelist API (batch 3a) — issue #3

- **Apa**:
  - `web/src/pages/booking/StepItem.jsx` — buang `CATEGORIES` hardcode 9
    kategori → derive dari `pricelist` (prop, sumber API) pakai `useMemo`
    (pola sama `Home.jsx`, urut urutan SKU = kelompok PRD Bab 6).
  - Build ulang `public/` (base `/`, WA produksi).
- **Kenapa**: Issue #3 — kategori booking hardcode (`StepItem.jsx`) sementara
  Home/Admin/Pricelist derive dari API. Kategori baru di pricelist (tambah SKU
  lewat admin) tidak muncul di filter wizard booking. Sekarang satu sumber.
  **Catatan**: klaim issue nyebut `StepIdentitas` juga hardcode — dicek, **tidak
  terbukti** (file itu tidak punya daftar kategori), jadi tidak disentuh.
- **Bukti**: grep `CATEGORIES` → 0 sisa; `npm run build` sukses; filter kategori
  di `/booking` kini mengikuti isi pricelist (fallback hardcode dihapus — kalau
  pricelist kosong, kategori kosong tapi item juga kosong, konsisten dgn Home).
- **File**: `web/src/pages/booking/StepItem.jsx`, `public/` (bundle rebuild),
  `ENGINEER.md`.

### FE polish: unifikasi struk — RiwayatDetail pakai StrukBody, strukPdf dari format.js (batch 2) — issue #3

- **Apa**:
  - `web/src/pages/RiwayatDetail.jsx` — hapus 4 blok markup yang menduplikasi
    struk (kartu ringkasan, rincian list, alamat, alasan batal) → konten utama
    pakai `<StrukBody>` (149 → 85 baris). Navigasi, badge status, HubungiAdmin
    (pending), tombol Unduh Struk tetap di halaman ini.
  - `web/src/lib/strukPdf.js` — buang 4 helper lokal (`rupiah`, `fmtDate`,
    `fmtTime`, `statusText`) → import `formatRupiah`, `formatDateShort`,
    `formatSlotTime`, `statusLabel` dari `lib/format.js`.
  - Build ulang `public/` (base `/`, WA produksi).
- **Kenapa**: Issue #3 — dua sumber tampilan struk: `RiwayatDetail` mengulang
  `StrukBody` (output bisa beda kalau satu diubah), dan `strukPdf.js` ngedefine
  ulang format yang output-nya beda (`"Rp 300.000"` vs `"Rp300.000"`).
  **Catatan**: perubahan perilaku yang disengaja — harga di PDF kini seragam
  `Rp300.000` (tanpa spasi), sama persis dengan tampilan HTML. Layout
  `RiwayatDetail` ikut berubah (bukan lagi kartu text-center, tapi konten struk
  + badge + aksi) — keputusan sadar biar satu sumber, bukan duplikasi.
- **Bukti**: `npm run build` sukses; grep helper lama → 0 sisa; endpoint data
  (`bookings-detail.php`) sama persis dengan `Struk.jsx` yang sudah memakai
  `StrukBody` di produksi → field kompatibel.
- **File**: `web/src/pages/RiwayatDetail.jsx`, `web/src/lib/strukPdf.js`,
  `public/` (bundle rebuild), `ENGINEER.md`.

### FE polish: buang dead code + copy dev di 404 (batch 1) — issue #3

- **Apa**:
  - `web/src/lib/auth.jsx` — gabung dua cabang `catch` yang identik
    (`setUser(null)` × 2, dulu beda label 401 vs lain) jadi satu; buang import
    `ApiError` yang kini tak terpakai.
  - `web/src/pages/Placeholder.jsx` — buang copy dev
    "Halaman ini menyusul di tahap berikutnya." dari halaman 404 publik +
    betulkan komen kedaluwarsa ("halaman sementara") → 404 beneran.
  - `web/src/pages/LengkapiProfil.jsx` — `navigate()` saat render (guard
    `!user`) diganti `<Navigate to="/login" replace />`, konsisten dengan
    `Riwayat.jsx`.
  - Build ulang `public/` (base `/`, WA admin produksi).
- **Kenapa**: Issue #3 — polish frontend. **Catatan verifikasi**: 4 klaim issue
  dicek ke kode aktual dan **tidak terbukti** (props `StepSukses`, import api di
  `StepIdentitas`, `ApiError` di `Riwayat`, `waAdminReady` — semuanya masih
  dipakai), jadi **tidak disentuh**. Yang dieksekusi hanya 3 yang valid.
- **Bukti**: `npm run build` sukses; perilaku app tak berubah (cleanup murni).
- **File**: `web/src/lib/auth.jsx`, `web/src/pages/{Placeholder,LengkapiProfil}.jsx`,
  `public/` (bundle rebuild), `ENGINEER.md`.

### Security: blokir nama file repo tanpa ekstensi (LICENSE/dst) — follow-up issue #1

- **Apa**:
  - Tambah `RewriteRule ^(LICENSE|README|SECURITY|NOTICE|CHANGELOG|Makefile|Dockerfile)(\.(md|txt))?$ - [F,L,NC]`
    di `booking/.htaccess`.
  - Anchoring `^...$` biar cuma kena nama file exact, bukan jalur lain.
- **Kenapa**: Validasi production PR #60 menemukan rule ekstensi
  (`\.(md|sql|...)`) lolos buat file tanpa ekstensi — `/LICENSE` masih 200 OK
  (padahal issue #1 nyebut LICENSE ikut kebaca). Di repo `booking/` memang ada
  file tanpa ekstensi nyata: `LICENSE`, `Dockerfile` (plus `.gitignore`,
  `.dockerignore` yang sudah ke-block rule dotfile).
- **Bukti**: setelah deploy, `curl` ke `/LICENSE`, `/Dockerfile`, `/README`,
  `/SECURITY`, `/Makefile` harus **403**; jalur normal (`/`, `/api/*`, `assets/*`)
  tetap **200** — dicek manual setelah auto-deploy.
- **File**: `booking/.htaccess`, `ENGINEER.md`.

### Security: blokir ekstensi sensitif (.md/.sql/.log/.db/.env/dst) di .htaccess — issue #1

- **Apa**:
  - Tambah `RewriteRule \.(md|sql|db|log|env|bak|old|swp)$ - [F,L]` di
    `booking/.htaccess` (blokir any request ke file berekstensi sensitif,
    kembalikan 403).
  - Proteksi **belt-and-suspenders** selain `FilesMatch` yang sudah ada di
    `public/.htaccess`.
- **Kenapa**: Issue #1 — pentest black-box menemukan file root repo
  (`README.md`, `ENGINEER.md`, `CONTRIBUTING.md`, dst.) kebaca 200 OK di
  production karena deploy pernah mengunggah lebih dari `public/`; `FilesMatch`
  ekstensi gak nendang di Hostinger (LiteSpeed/CDN), tapi `mod_rewrite`
  **kebukti jalan** (folder `app/ config/ scripts/` → 403). Rule ini nyambung
  ke fakta auto-deploy Hostinger bersifat *additive* (file lama nggak kehapus),
  jadi kalau ada file sensitif berekstensi `.sql`/`.log`/`.db` yang tak sengaja
  ter-upload, ia gak akan kebaca.
- **Catatan**: Bagian lain issue #1 (auto-deploy additive di hPanel; setelan
  *clean deploy*) **belum** dikerjakan — butuh akses hPanel manual, di luar
  repo. Diverifikasi nanti.
- **Bukti**: `curl` ke `https://booking.indeepcleaningid.site/README.md`
  (subdomain tempat `.htaccess` ini hidup) harus balas **403/404**, bukan 200 —
  dicek manual setelah auto-deploy. Path lama `/app-booking/` sudah 404 permanen
  jadi bukan target valid.
- **File**: `booking/.htaccess`, `ENGINEER.md`.

### Test infra: suite idempoten (reset state terpusat) — issue #38

- **Apa**:
  - `scripts/reset-uji.php` (baru) — reset state uji terpusat & idempoten:
    `otps`, `login_attempts`, `api_rate_limits`, `slots`, dan data ber-email
    `*@test.dev` (booking + items + surcharges + alamat + user). Tidak menyentuh
    pricelist/surcharges/user asli.
  - Tiap suite `.mjs` (`uji-tahap2`, `uji-otp-tahap3`, `uji-admin-tahap4`,
    `uji-login-password`, `uji-security-tahap29`) memanggil reset di **awal** →
    bisa dijalankan beruntun tanpa gagal palsu.
  - Action `reset-state-uji` di `uji-admin-helper.php` (delegasi) +
    dokumentasi di README bagian Pengujian.
- **Kenapa**: Issue #38 — suite meninggalkan state (rate limit, cooldown OTP,
  counter slot, booking/user sisa) → run berikutnya gagal palsu; dulu butuh
  reset manual tak terdokumentasi, dan saat validasi PR sering salah baca
  sebagai regresi.
- **Bukti**: run **beruntun tanpa reset manual** — OTP **21/21** dua kali,
  Admin **33/33** dua kali, Security **23/23**, login **19/19**, Tahap 2
  **18/19** konsisten (hanya S2 pre-existing). Sebelum ini, run beruntun OTP
  gagal karena cooldown/rate limit sisa.
- **File**: `scripts/reset-uji.php` (baru), `scripts/uji-tahap2.mjs`,
  `scripts/uji-otp-tahap3.mjs`, `scripts/uji-admin-tahap4.mjs`,
  `scripts/uji-login-password.mjs`, `scripts/uji-security-tahap29.mjs`,
  `scripts/uji-admin-helper.php`, `README.md`, `ENGINEER.md`.

### Polish backend (Batch 2, penutup): N+1, index audit_logs, DRY read_json_body — issue #4

- **Apa**:
  - **N+1 di `admin/customers.php`** — 3 korelasi subquery per baris (COUNT
    bookings, default address, MAX slot_date) diganti subquery beragregasi +
    LEFT JOIN setelah halaman user di-LIMIT. Output tak berubah.
  - **Index `audit_logs(action)`** — ditambah di `scripts/schema.sql` (DB baru) +
    `scripts/migrate.php` (baru, **idempoten**, untuk DB yang sudah ada).
  - **`app/lib/request.php`** (baru) — `read_json_body(bool $requireArray)` &
    `request_date_ymd()`; dipakai di 8 endpoint yang sebelumnya menyalin pola
    `file_get_contents('php://input')` + `json_decode` (login, admin-login,
    otp-request/verify/email-confirm, quote, bookings-cancel, addresses).
- **Kenapa**: Issue #4 — N+1 query, `audit_logs.action` tanpa index (padahal
  difilter), boilerplate parsing body 16×.
- **Bukti**: `customers.php` GET tetap balas `total_bookings`/`default_address`/
  `last_booking`. Migrasi run 1 → `[ok] ditambahkan`, run 2 → `[skip]`. Suite:
  OTP **21/21**, login-password **19/19**, Admin **33/33**, Security **23/23**,
  Tahap 2 **18/19** (S2 pre-existing). `php -l` semua hijau.
- **File**: `app/lib/request.php` (baru), `app/lib/bootstrap.php`,
  `scripts/migrate.php` (baru), `scripts/schema.sql`, `public/api/admin/customers.php`,
  `public/api/{login,admin-login,otp-request,otp-verify,otp-email-confirm,quote,bookings-cancel,addresses}.php`,
  `ENGINEER.md`.
- **Keputusan tertunda (dicatat, bukan dikerjakan)**: standardisasi **error code**
  (`slot_penuh`/`slot_full`, `terlalu_sering`/`rate_limited`) & **envelope sukses**
  **tidak** diubah di batch ini. Alasan: tidak ada bug & tidak ada konsumen FE
  yang mengecek code itu (FE pakai `message`; hanya `double_submit` yang dicek
  eksplisit), sementara mengubahnya menyentuh banyak suite uji (OTP/login) —
  risiko > nilai. Kalau nanti perlu, kerjakan terpisah bersama update test.

### Polish backend (Batch 1): fix config() default, error_log, dead code, 405 guard — issue #4

- **Apa**:
  - **`config($key, $default)`** — signature kini punya argumen ke-2: kunci tidak
    ada → balas `$default` kalau dikasih (via `func_num_args() > 1`), else tetap
    throw. **Bug**: dulu signature cuma 1 param, jadi `security.php` &
    `google-callback.php` yang memanggil `config($k, fallback)` menyebabkan
    RuntimeException 500 saat kunci hilang, bukan fallback.
  - **`error_log` di catch `Throwable`** yang menyembunyikan error: `admin/customers.php`
    (delete), `admin/bookings.php` (delete + move), `addresses.php` (create) —
    biar debug produksi tidak buta.
  - **Dead code**: buang `current_role()` (`session.php`, 0 pemanggilan) &
    `recompute_profile_complete()` di `me-photo.php` (no-op: foto bukan kriteria
    `profile_complete`).
  - **405 guard** di `admin/dashboard.php`, `admin/logs.php`, `admin/reports.php`
    (dulu tidak cek method).
- **Kenapa**: Issue #4 — `config()` default diam-diam diabaikan (paling berbahaya);
  catch tanpa log; dead code; endpoint GET tanpa guard 405.
- **Bukti**: `config('X','')` → `''`, `config('X',null)` → `null`, tanpa default →
  tetap throw. 405 guard dengan session admin: `GET=200 / POST=405
  method_not_allowed` (dashboard/logs/reports). Regresi: Tahap 2 **17/18**
  (S2 pre-existing), Admin **33/33**, Security **23/23**. `php -l` hijau.
- **File**: `app/lib/config.php`, `app/lib/session.php`, `public/api/me-photo.php`,
  `public/api/admin/dashboard.php`, `public/api/admin/logs.php`,
  `public/api/admin/reports.php`, `public/api/admin/customers.php`,
  `public/api/admin/bookings.php`, `public/api/addresses.php`, `ENGINEER.md`.
- **Catatan**: Batch 1 dari #4. Sisa (Batch 2): standardisasi error code/envelope,
  N+1 (`admin/customers.php`, `bookings-mine.php`), index `audit_logs(action)`,
  ekstraksi `read_json_body()`/parser tanggal.

### Omzet: definisi tunggal dashboard==reports + panel PRD 12.1 — issue #9

- **Apa**:
  - `app/lib/omzet.php` (baru) — definisi omzet **tunggal**:
    `omzet_statuses()` = `confirmed, in_progress, completed`, plus
    `omzet_status_sql()` & `omzet_sum_between()`. Semua endpoint omzet WAJIB
    pakai ini (tak ada literal status).
  - `admin/dashboard.php` & `admin/reports.php` memakai definisi bersama →
    `dashboard.omzet_today` kini **=** `reports.omzet_estimasi` (dulu dashboard
    `confirmed+in_progress+completed`, reports `completed` saja → beda).
  - Panel PRD 12.1 ditambah: **`tomorrow_bookings`** (booking besok) &
    **`slots_full_week`** (slot penuh Senin–Minggu berjalan) di dashboard.
  - `Reports.jsx`: tambah kartu "Omzet Estimasi" + keterangan status; tabel
    harian ikut definisi tunggal. `Dashboard.jsx`: 2 kartu baru.
- **Kenapa**: Issue #9 — angka omzet dashboard ≠ laporan (keputusan bisnis pakai
  angka beda tergantung layar); PRD 12.1 belum terpenuhi. Keputusan Bang Rob:
  omzet = **confirmed + completed** (pending dikecualikan; completed tetap dihitung).
- **Bukti**: data uji (1 confirmed 100rb + 1 in_progress 200rb + 1 completed 300rb
  + 1 pending 888rb + 1 cancelled 999rb) → dashboard `omzet_today` **600000** =
  reports `omzet_estimasi` **600000** (konsisten; pending & cancelled tak dihitung).
  Suite: Tahap 2 **17/18** (S2 pre-existing), Admin **33/33**, Security **23/23**.
- **File**: `app/lib/omzet.php` (baru), `public/api/admin/dashboard.php`,
  `public/api/admin/reports.php`, `web/src/pages/admin/Dashboard.jsx`,
  `web/src/pages/admin/Reports.jsx`, bundle `public/assets/*` + `public/index.html`,
  `ENGINEER.md`.

### UI kit (Batch 2, penutup): Banner tunggal ganti 25 banner manual — issue #8

- **Apa**: komponen `components/Banner.jsx` (variant `error`/`success`/`info`/
  `warning`, `className`, `onClose`, `action`, `role` otomatis). **26 banner**
  manual (2 gaya berbeda) diganti di 17 file:
  `admin/Logs`, `admin/Dashboard`, `admin/Pricelist`, `admin/Reports`,
  `admin/Bookings` (termasuk `moveError` dalam Modal), `Login`, `LupaPassword`,
  `LengkapiProfil`, `Pricelist`, `AdminLogin`, `Profil`, `Riwayat`,
  `RiwayatDetail`, `components/profil/{AlamatPanel,GantiEmail,GantiPassword}`,
  `booking/StepIdentitas`.
- **Kenapa**: Issue #8 — banner error/success ditulis ulang di banyak tempat
  dengan 2 gaya. Sekarang satu komponen; ubah warna/copy cukup di satu file.
- **Bukti**: build Vite sukses (Banner jadi chunk sendiri ~0.72 kB). Verifikasi
  sumber **17/17 file pakai `<Banner>`**. Regresi API: Tahap 2 **17/18**
  (S2 pre-existing), Admin **33/33**, Security **23/23**.
- **Sengaja dibiarkan** (bukan banner seragam): blok "gagal memuat harga" di
  `Booking.jsx`/`StepItem`/`StepReview` (punya struktur + tombol action sendiri),
  teks kecil merah di dalam form, dan status teks halaman (`App.jsx`,
  `AdminRoute.jsx`, `Home.jsx`).
- **File**: `web/src/components/Banner.jsx` (baru) + 17 file pemakai + bundle
  `public/assets/*` + `public/index.html`, `ENGINEER.md`.
- **Keputusan**: tetap statis sampai state direset pemanggil (bukan auto-dismiss
  toast) — sesuai keputusan Bang Rob; toast auto-dismiss bisa jadi peningkatan terpisah.

### UI kit (Batch 1): Modal + ConfirmDialog + StatusBadge — issue #8

- **Apa**: komponen UI bersama baru di `components/`:
  - `Modal.jsx` — shell dialog umum (portal ke `document.body`, tutup via Esc +
    klik backdrop, `dismissible`, `busy` mengunci tutup, `footer` buat tombol).
  - `ConfirmDialog.jsx` — dibangun **di atas `Modal.jsx`**; fokus otomatis ke
    tombol utama, `variant: 'default' | 'destructive'`.
  - `StatusBadge.jsx` — badge status booking tunggal (pakai `statusBadgeClass()` +
    `statusLabel()` dari `lib/format.js`).
  - **10 modal manual diganti**: `admin/Bookings.jsx` (×3), `admin/Slots.jsx` (×3),
    `admin/Customers.jsx` (×2), `admin/Pricelist.jsx` (×1), `Riwayat.jsx` (×1).
  - Satu-satunya `window.confirm` yang tersisa (`components/profil/AlamatPanel.jsx`)
    diganti `ConfirmDialog`.
- **Kenapa**: Issue #8 — 10 modal ditulis manual dengan perilaku tidak konsisten
  (backdrop-click cuma 7/10, Esc 0×), `window.confirm` masih ada, badge status 2
  bentuk. Sekarang satu perilaku: Esc + backdrop + fokus.
- **Bukti**: `grep "fixed inset-0 z-50" web/src/pages/` → **0** (semua lewat Modal);
  `window.confirm` → **0**; build Vite sukses. Verifikasi sumber **17/17 lolos**.
  Regresi API: Tahap 2 **17/18** (S2 pre-existing), Admin **33/33**, Security **23/23**.
- **File**: `web/src/components/Modal.jsx` (baru),
  `web/src/components/ConfirmDialog.jsx` (baru),
  `web/src/components/StatusBadge.jsx` (baru),
  `web/src/pages/admin/Bookings.jsx`, `admin/Slots.jsx`, `admin/Customers.jsx`,
  `admin/Pricelist.jsx`, `web/src/pages/Riwayat.jsx`,
  `web/src/components/profil/AlamatPanel.jsx`, bundle `public/assets/*` +
  `public/index.html`, `ENGINEER.md`.
- **Catatan**: Batch 1 dari #8. Sisa: ganti 25 banner error/success yang masih
  ditulis manual (Batch 2, PR terpisah).

### Refactor FE (Batch 3, terakhir): pecah Profil.jsx — issue #7

- **Apa**: `pages/Profil.jsx` (**766 baris**) dipecah jadi halaman tipis + 5
  komponen di `components/profil/`:
  - `FotoProfil.jsx` — upload/ganti/hapus foto, state upload lokal.
  - `DataDiriForm.jsx` — form nama/WA/preferensi jam + PATCH `me.php`.
  - `AlamatPanel.jsx` — panel alamat (dulu nested `useAuth()`; kini terima prop
    `user` → mandiri). Pakai `AddressFields` dari Batch 1.
  - `GantiPassword.jsx` — alur OTP ganti password.
  - `GantiEmail.jsx` — alur dua OTP (email lama + baru).
  - `Profil.jsx` tinggal: guard auth + header + banner error/success bersama +
    menyusun 5 panel (banner dibagikan via prop `onError`/`onSuccess`).
- **Kenapa**: Issue #7 — `Profil.jsx` 885→766 baris dengan 3 sub-komponen dan
  17+ `useState` bercampur. Ini batch penutup.
- **Bukti**: `Profil.jsx` **766 → 70 baris**; build Vite sukses. Verifikasi
  struktur **19/19 lolos** (5 panel dipisah, guard tetap, alur OTP utuh, tanpa
  `window.confirm`/`useRef` di halaman). Regresi API: Tahap 2 **17/18**
  (S2 pre-existing), Admin **33/33**, Security **23/23**.
- **File**: `web/src/components/profil/FotoProfil.jsx` (baru),
  `DataDiriForm.jsx` (baru), `AlamatPanel.jsx` (baru), `GantiPassword.jsx` (baru),
  `GantiEmail.jsx` (baru), `web/src/pages/Profil.jsx`, bundle `public/assets/*`
  + `public/index.html`, `ENGINEER.md`.
- **Catatan**: Batch 3 menutup #7 (god components). Sisa banner/modal duplikat
  antar halaman (termasuk di panel baru ini) ditangani terpisah di #8 (UI kit).

### Refactor FE (Batch 2): pecah admin/Bookings.jsx — issue #7

- **Apa**: `pages/admin/Bookings.jsx` (**607 baris**) dipecah jadi 1 halaman +
  3 komponen:
  - `components/admin/BookingRow.jsx` — satu baris booking, dua tampilan
    (`variant: 'table' | 'card'`) dalam SATU komponen. `waLink()` dihitung
    **sekali** per baris (dulu 4×), markup tabel & kartu tak lagi digandakan.
  - `components/admin/BookingRowActions.jsx` — blok aksi (WA, transisi status,
    pindah, hapus) yang dulu diduplikasi antara tabel & kartu.
  - `components/admin/BookingItemsList.jsx` — rincian item + surcharge (dulu copy 2×).
  - Halaman kini render **satu** tampilan saja lewat `matchMedia('(min-width:1024px)')`
    → tidak lagi mount tabel DAN kartu sekaligus.
- **Kenapa**: Issue #7 — `admin/Bookings.jsx` 589 baris, tabel desktop & kartu
  mobile dua-duanya selalu ter-mount, blok aksi + `waLink()` diduplikasi.
  Perubahan perilaku dulu harus diedit di 2 tempat → bug "udah difix di tabel,
  di HP masih salah".
- **Bukti**: `Bookings.jsx` **607 → 422 baris**; bundle `Bookings` 16.37 → 15.96 kB.
  Build Vite sukses. Verifikasi sumber **11/11 lolos** (waLink lokal hilang,
  render kondisional, komponen dipakai). Regresi API: Tahap 2 **17/18**
  (S2 pre-existing), Admin **33/33**.
- **File**: `web/src/components/admin/BookingRow.jsx` (baru),
  `web/src/components/admin/BookingRowActions.jsx` (baru),
  `web/src/components/admin/BookingItemsList.jsx` (baru),
  `web/src/pages/admin/Bookings.jsx`, bundle `public/assets/*` + `public/index.html`,
  `ENGINEER.md`.
- **Catatan**: Batch 2 dari #7. Sisa: merapikan state `Profil.jsx` (17+ `useState`).

### Refactor FE (Batch 1): komponen form alamat bersama — issue #7

- **Apa**: form alamat yang dulu ditulis **3×** dengan kontrak & gaya berbeda
  kini satu komponen bersama:
  - `web/src/lib/addressForm.js` — `EMPTY_ADDRESS`, `REQUIRED_ADDRESS_FIELDS`,
    `validateAddress()`, `normalizeAddress()`, `formatAddressLine()` (satu sumber
    kontrak snake_case + aturan wajib/semi-validasi).
  - `web/src/components/AddressFields.jsx` — field alamat controlled
    (`value`/`onChange`, `idPrefix`, `variant: 'wizard' | 'plain'`,
    opsi `showLabel/showNote/showMaps/showDefault`).
  - Dipakai ulang di: `pages/booking/StepIdentitas.jsx` (wizard),
    `pages/Profil.jsx` (AlamatPanel), `pages/LengkapiProfil.jsx`.
  - Buang duplikasi: `EMPTY_ADDRESS` & validasi manual di StepIdentitas,
    `ALAMAT_KOSONG` + helper `Field` lokal di Profil.
- **Kenapa**: Issue #7 (god components) — form alamat 3× adalah akar dari bug
  "dua validasi alamat" (#16) dan bikin perubahan perilaku harus diedit di
  banyak tempat. Profil.jsx 885 baris; bagian ini yang paling aman diekstrak duluan.
- **Bukti**: build Vite sukses; bundle `Profil` turun **19.26 kB → 16.61 kB**.
  Skrip verifikasi sumber **27/27 lolos** (kontrak field tetap snake_case,
  validator & normalizer terpakai di 3 halaman, payload `/addresses.php` tak
  berubah). Suite API tak terpengaruh: Tahap 2 **17/18**, Admin **33/33**,
  Security **23/23**.
- **File**: `web/src/lib/addressForm.js` (baru),
  `web/src/components/AddressFields.jsx` (baru),
  `web/src/pages/booking/StepIdentitas.jsx`, `web/src/pages/Profil.jsx`,
  `web/src/pages/LengkapiProfil.jsx`, bundle `public/assets/*` + `public/index.html`,
  `ENGINEER.md`.
- **Catatan**: ini Batch 1 dari #7. Batch lanjutan (belum dikerjakan):
  `admin/Bookings.jsx` (BookingRowActions + satukan tabel/mobile) dan
  merapikan sisa state di `Profil.jsx`.

### Security retest: attempt cap OTP, IDOR horizontal/vertical, mass assignment, idempotency lintas user — issue #29

- **Apa**: skrip uji baru `scripts/uji-security-tahap29.mjs` +
  `scripts/uji-security-helper.php` — menguji 5 vektor lewat **endpoint asli**
  (bukan unit test): (1) attempt cap OTP pada akun **terdaftar**,
  (2) IDOR horizontal (booking/addresses/cancel milik user lain),
  (3) IDOR vertical (customer → `/api/admin/*`), (4) mass assignment
  `PATCH /me.php`, (5) `bookings-create` — reuse `idempotencyKey` lintas user +
  kepemilikan `skuId`/surcharge.
- **Kenapa**: Issue #29 — laporan pentest sebelumnya tidak valid: 250 request
  brute-force memakai email **tidak terdaftar** (berhenti di gate "user tidak
  ditemukan" sebelum `otp_verify()`), dan surface ter-autentikasi belum diuji.
- **Hasil (23/23 lolos)**: attempt cap akun terdaftar `400,400,400,400,429`
  (kunci); IDOR horizontal semuanya **404**; IDOR vertical **403**; mass
  assignment diabaikan (`role`/`id`/`email`/`password_hash` tetap, field sah
  diterapkan); `idempotencyKey` lintas user **409 double_submit**; `skuId` asing
  **400 sku_invalid**; surcharge asing ditolak.
- **Catatan**: tidak ada celah baru ditemukan. Attempt cap, IDOR, mass
  assignment, dan kepemilikan resource sudah aman seperti dugaan kode.
- **File**: `scripts/uji-security-tahap29.mjs` (baru),
  `scripts/uji-security-helper.php` (baru), `ENGINEER.md`.

### UX frontend: quote gagal jujur, surcharge ×qty, loading/empty/retry, navigasi basename — issue #6

- **Apa**:
  - **Quote gagal tidak lagi diam** (`Booking.jsx`): state baru `quoteError` +
    `quoteNonce` (retry). `StepItem` & `StepReview` menampilkan "Gagal memuat
    harga." + tombol **Coba lagi**; tombol lanjut `disabled` selama error —
    tidak lagi menyesatkan seolah user di bawah minimum order.
  - **Baris surcharge di Review dikali qty** (`StepReview.jsx`): dulu tampil
    `amount` satuan (mis. 40.000) padahal total di bawah ×2 (80.000). Kini
    `lineTotal = amount × qtyAffected` + label "+N × (Rp… / per)".
  - **Loading/empty/error tidak dead-end**: `Profil.jsx` guard `!user` → `<Navigate to="/login">`
    (dulu layar kosong) + state loading; `Dashboard.jsx`, `Reports.jsx`,
    `Pricelist.jsx` dapat tombol **Coba lagi** + state loading eksplisit.
  - **Navigasi basename-aware**: buang `window.location.assign(...)` di
    `Booking.jsx`, `StepSukses.jsx`, `Riwayat.jsx` → `useNavigate`. "Mulai
    booking baru" kini reset state wizard di tempat (bukan full reload).
- **Kenapa**: Issue #6 — celah UX yang bikin user tersesat/terkunci/misinformasi:
  quote gagal diam → info "minimum order" salah; baris surcharge tak dikali qty;
  layar kosong saat sesi habis; error tanpa jalan keluar; navigasi hard-code
  mengabaikan `VITE_BASENAME`.
- **Bukti**: build Vite sukses (bundle `public/` di-rebuild). Skrip verifikasi
  logika sumber + surcharge line total: **23/23 lolos**. Suite API regresi tidak
  terpengaruh: Tahap 2 **17/18** (S2 pre-existing #6-backend), Admin **33/33**.
- **File**: `web/src/pages/Booking.jsx`, `web/src/pages/booking/StepItem.jsx`,
  `web/src/pages/booking/StepReview.jsx`, `web/src/pages/booking/StepSukses.jsx`,
  `web/src/pages/Profil.jsx`, `web/src/pages/Riwayat.jsx`,
  `web/src/pages/admin/Dashboard.jsx`, `web/src/pages/admin/Reports.jsx`,
  `web/src/pages/Pricelist.jsx`, bundle `public/assets/*` + `public/index.html`,
  `ENGINEER.md`.

### Window booking: samakan semua jalur ke H+30 — issue #10

- **Apa**: aturan window jadwal diseragamkan ke **H+30 inklusif** (keputusan
  Bang Rob). `availability.php` (default `to`, clamp `$maxEnd`) dan
  `admin/slots.php` (kalender admin, `ADMIN_MAX_WINDOW_DAYS`) berhenti memakai
  `- 1` → kini sama persis dengan `bookings-create.php` & reschedule admin.
  `scripts/uji-tahap2.mjs` dapat Skenario 4b: create H+31 ditolak (`date_invalid`)
  + availability hari terakhir = H+30.
- **Kenapa**: Issue #10 — create mengizinkan H+30 tapi availability hanya
  menghitung H+29: booking H+30 lolos dibuat tapi **tidak pernah tampil** di
  kalender/date picker → customer bingung, admin tak bisa lihat. Aturan bisnis
  dikunci H+30 (konsisten dengan pesan error "maksimal 30 hari ke depan" dan
  rentang kalender).
- **Bukti**: `GET /availability.php` → `last = H+30` (31 hari termasuk H+0);
  `?to=H+31` di-clamp ke H+30. Create di H+30 lewat API → **201** lalu
  dibatalkan bersih. Suite Tahap 2 **17/18** (S2 surcharge = pre-existing #6);
  Suite Admin Tahap 4 **33/33**.
- **File**: `public/api/availability.php`, `public/api/admin/slots.php`,
  `scripts/uji-tahap2.mjs`, `ENGINEER.md`.

### Slot counter: satu strategi recount + semua write dalam transaksi — issue #11

- **Apa**: `slots.booked` sekarang **selalu** dihitung ulang dari tabel `bookings`
  lewat `slot_recount()` setelah tiap perubahan booking — tidak ada lagi
  aritmetika manual `booked ± 1`. Yang dibungkus transaksi + kunci baris:
  `bookings-create.php` (ensure → `SELECT … FOR UPDATE` → recount → insert →
  recount), `bookings-cancel.php`, `admin/bookings.php` (ubah status **dan**
  pindah jadwal), `scripts/expire-bookings.php`, plus PATCH & DELETE
  `admin/slots.php` (dulu cek-lalu-aksi tanpa lock). `scripts/uji-admin-helper.php`
  action `hapus-booking` ikut recount biar counter tak orphan antar-run.
  `scripts/uji-tahap2.mjs` S7b kini meng-assert counter (`booked === 1`).
- **Kenapa**: Issue #11 — counter di-update **dua strategi** (recount agregat vs
  decrement manual tersebar), ada update booking+slot yang jalan **tanpa
  transaksi**, dan hapus slot `cek-lalu-DELETE` tanpa lock (ghost count saat
  race). PRD 11.5 mewajibkan semua perubahan slot dalam transaksi.
- **Bonus penting — menutup regresi dari #12**: `slot_ensure()` diubah dari
  `INSERT IGNORE` → `INSERT … ON DUPLICATE KEY UPDATE id = id`. Sebab: pada baris
  slot yang **sudah ada**, `INSERT IGNORE` mengambil **shared lock**, yang lalu
  di-upgrade ke **exclusive** oleh `SELECT … FOR UPDATE` berikutnya → dua request
  bersamaan bisa **deadlock** (jalur umum di produksi: baris slot biasanya sudah
  dibuat kalender admin). ODKU langsung exclusive → terserialisasi rapi.
- **Bukti**: (a) Balapan slot 3 kondisi via `uji-race-tahap2.php` — baris kosong,
  baris ada (booked 0), baris penuh — semua **tanpa deadlock** (`MENANG|DITOLAK`
  lalu `DITOLAK|DITOLAK`). (b) Suite Tahap 2 **15/16** (S2 surcharge gagal
  pre-existing = #6). (c) Suite Admin Tahap 4 **33/33**. (d) Invarian
  `slots.booked == COUNT(bookings yang menghitung)` **bersih di seluruh slot**
  setelah operasi (satu-satunya sisa: orphan dari race-simulator yang memang
  tidak membuat baris booking — artefak #38; hilang setelah recount).
- **File**: `app/lib/slots.php`, `public/api/bookings-create.php`,
  `public/api/bookings-cancel.php`, `public/api/admin/bookings.php`,
  `public/api/admin/slots.php`, `scripts/expire-bookings.php`,
  `scripts/uji-admin-helper.php`, `scripts/uji-tahap2.mjs`, `ENGINEER.md`.

### Slot: satu helper ensure + GET publik berhenti menulis DB — issue #12

- **Apa**: `app/lib/slots.php` dapat helper baru `slot_times()`, `slot_ensure()`
  (INSERT IGNORE idempoten, kapasitas default dari config `SLOT_CAPACITY_DEFAULT`),
  dan `slot_ensure_range()`. `availability.php` (GET publik) **berhenti menulis
  DB** — baris slot yang belum ada disintesis di memori dari kapasitas default,
  respons tetap 2 slot/hari non-Selasa. `admin/slots.php` GET, pindah-slot
  `admin/bookings.php`, dan `bookings-create.php` memakai helper yang sama
  (kapasitas konsisten dari config, bukan hardcode 1). `scripts/uji-race-tahap2.php`
  ikut pakai `slot_ensure()` (urutan ensure-dulu-baru-lock).
- **Kenapa**: Issue #12 — "ensure baris slot" terduplikasi 3 jalur dengan
  kapasitas berbeda, dan GET publik `availability.php` menulis puluhan baris tiap
  request (traffic bot/scanner). Sekaligus menutup bug laten: pola
  `SELECT … FOR UPDATE` lalu `INSERT` saat baris belum ada bisa **deadlock** (dua
  gap lock + insert intention saling tunggu) — ketahuan saat suite Tahap 2 S7a
  dijalankan di DB bersih setelah GET tak lagi membuat baris slot.
- **Bukti**: DB bersih → `GET /api/availability.php` balas 200 dengan 2 slot/hari,
  `SELECT COUNT(*) FROM slots` tetap **0** (read-only terbukti). Suite Tahap 2
  **15/16** (S2 surcharge gagal pre-existing = issue #6) — S7a balapan kini
  konsisten `1 MENANG + 1 DITOLAK`. Suite Admin Tahap 4 **33/33 lolos**.
- **File**: `app/lib/slots.php`, `public/api/availability.php`,
  `public/api/admin/slots.php`, `public/api/admin/bookings.php`,
  `public/api/bookings-create.php`, `scripts/uji-race-tahap2.php`, `ENGINEER.md`.

### Security: attempt cap OTP di-serialize (transaksi + SELECT … FOR UPDATE) — tutup race #26

- **Apa**: `app/lib/otp.php` — `otp_verify()` ditulis ulang: seluruh
  baca-cek-tulis dijalankan dalam **SATU transaksi InnoDB**, dengan semua baris
  OTP aktif (email + purpose) dikunci lebih dulu lewat `SELECT … FOR UPDATE`.
  `commit()` dipanggil **sebelum** melempar error 400/429 supaya penambahan
  `attempts` tidak ikut ter-rollback; exception infra → `rollBack()` + rethrow.
  Snapshot lock (`$lockedRow`) & total attempts dihitung dari baris terkunci /
  nilai **setelah** UPDATE, bukan snapshot lama (`$aktif[0]['attempts'] + 1`).
  Dua script uji baru: `scripts/uji-race-otp.php` + `.mjs` (burst invariant) dan
  `scripts/uji-race-otp-lock.php` + `.mjs` (bukti tingkat lock).
- **Kenapa**: Issue #26 — attempt cap (5x salah → kunci 15 menit) diperiksa dan
  di-increment **non-atomik**: cek dari nilai yang dibaca PHP, increment UPDATE
  terpisah. Request paralel bisa sama-sama lolos gate sebelum counter ter-commit
  → tebakan yang sampai `password_verify()` bisa melebihi 5. Ini compensating
  control utama untuk OTP 6 digit, jadi remnya bocor.
- **Keputusan**: pakai **usulan #1 issue** (`SELECT … FOR UPDATE` dalam
  transaksi), bukan increment atomik (usulan #2). Alasan: atomik hanya menjamin
  counter benar, **tidak** mencegah banyak request menjalankan `password_verify()`
  di jendela yang sama; lock serialisasi menutup sumber masalahnya. Sejalan
  dengan pola transaksi yang sudah ada (`bookings-create.php`, `ratelimit.php`).
  Perubahan turunan: acuan total attempts kini `MAX(attempts)` baris aktif —
  konsisten dengan `otp_assert_not_locked()` yang mengecek `attempts >= max`
  per-baris (kode lama memakai kode terbaru saja, bagian dari bug-nya).
- **Bukti**: (a) **Uji tingkat lock** — dua koneksi paralel pada baris otps yang
  sama: `SELECT` biasa selesai `0.2ms | 0.1ms` (tanpa blocking = celah race),
  `SELECT … FOR UPDATE` = `0.2ms | 800.4ms` (koneksi kedua ter-serialize).
  (b) **Uji burst invariant** — 20 proses paralel `otp_verify()` kode salah:
  `attempts` akhir **tepat 5** (tidak lebih), 15 sisanya diblokir `429`.
  (c) **Regresi** — suite `uji-otp-tahap3.mjs` **21/21 lolos** setelah state
  dibersihkan (3 kegagalan awal terbukti polusi state antar-run = issue #38,
  bukan regresi).
- **File**: `app/lib/otp.php`, `scripts/uji-race-otp.php` (baru),
  `scripts/uji-race-otp.mjs` (baru), `scripts/uji-race-otp-lock.php` (baru),
  `scripts/uji-race-otp-lock.mjs` (baru), `ENGINEER.md`.

### Filter admin: hook bersama `useListQuery` — debounce search + abort request stale + hapus double-fetch — issue #14, PR #41 (merged `7ba9b435`)

- **Apa**: (1) Hook baru `web/src/lib/useListQuery.js` menyatukan pola fetch
  daftar ter-paginasi + filter yang sebelumnya diduplikasi di
  `admin/Bookings.jsx` & `admin/Logs.jsx`. Fitur: debounce per-key (konsep
  draft vs applied), `AbortController` (abort request lama + abaikan hasil
  stale), satu jalur fetch, pagination, `apply()`, `reload()`. (2)
  `admin/Bookings.jsx` — buang state list + `muat()` + `useCallback`;
  `search` live (debounced 350 ms), filter lain (status/date/jam) ke-apply
  saat tombol "Terapkan" → satu request (dulu `setPage(1)` + `muat()` =
  dua request). Semua `await muat()` di aksi tulis → `await reload()`. (3)
  `admin/Logs.jsx` — pola sama; tanpa tombol Terapkan, jadi semua filter
  live: `action` (dropdown) langsung, `booking_id` (teks) di-debounce.
  (4) Pesan error pemuatan daftar dipisah (`listError`) dari error aksi tulis
  (`error`), keduanya tetap tampil. (5) Bundle FE di-rebuild & di-commit.
- **Kenapa**: Issue #14 — (a) filter admin memanggil API tiap ketikan tanpa
  debounce (ketik 10 karakter = 10 request); (b) klik "Terapkan" memicu 2
  request (1 terbuang); (c) tanpa `AbortController` response lama bisa
  menimpa yang baru (daftar tak sesuai filter). Sekalian memenuhi usulan
  issue: "ekstrak helper fetch bersama".
- **Keputusan desain (Bang Rob — Opsi B)**: `search` live-debounced (enak
  dipakai, hemat), dropdown/date lewat tombol "Terapkan" (mengumpulkan
  perubahan → 1 request, bukan N). Logs tanpa tombol → semua live
  (`booking_id` debounced). Alternatif "semua live" ditolak karena ganti 3
  dropdown = 3 request (lebih boros dari model lama).
- **Catatan**: `api.js` **tidak diubah** — sudah meneruskan `...options` ke
  `fetch`, jadi `signal` AbortController langsung didukung. Kontrak endpoint
  backend diverifikasi cocok (bookings: `page/limit/status/date_from/date_to/
  slot_time/search`; logs: `page/limit/action/booking_id`; respons
  `{data:{data,total,page,totalPages}}`).
- **Verifikasi**: build sukses (chunk `Bookings` 16.37 KB, `Logs` ikut bundle
  admin). Endpoint lokal balas envelope benar (401 sebelum login). Uji
  interaktif dev server (debounce search, tombol Terapkan = 1 request,
  pagination) dilakukan via `npm run dev`.
- **File**: `web/src/lib/useListQuery.js` (baru),
  `web/src/pages/admin/Bookings.jsx`, `web/src/pages/admin/Logs.jsx`,
  `public/index.html` + `public/assets/*` (build), `ENGINEER.md`.

### Code splitting bundle FE: lazy route + dynamic import jsPDF + vendor chunk — issue #15, PR #40 (merged `0910b074`)

- **Apa**: (1) `web/src/App.jsx` — 20 import halaman statis diubah jadi
  `React.lazy(() => import(...))` dan seluruh `<Routes>` dibungkus
  `<Suspense fallback={<RouteFallback />}>` (fallback bergaya `AdminRoute`,
  teks "Memuat…"). Shell (AuthProvider, CustomerLayout, AdminLayout,
  AdminRoute) tetap statis di bundle awal. (2) `web/src/lib/strukPdf.js` —
  `import { jsPDF } from 'jspdf'` top-level dibuang → `const { jsPDF } = await
  import('jspdf')` di dalam `buildStrukPdf()`; signature `buildStrukPdf` /
  `downloadStrukPdf` tidak berubah, jadi `pages/Struk.jsx` &
  `pages/admin/Struk.jsx` tidak disentuh. (3) `web/vite.config.js` — tambah
  `build.rollupOptions.output.manualChunks` **berbentuk fungsi** (Vite 8/\
  Rolldown menolak object) memisahkan `react`/`react-dom`/`react-router` ke
  chunk `vendor`. (4) Bundle FE di-`public/` di-rebuild & di-commit.
- **Kenapa**: Issue #15 — semua halaman + jsPDF jadi satu bundle 822 KB
  (242 KB gzip), nol code splitting. Home mengunduh jsPDF (~343 KB) +
  seluruh route admin/booking yang tidak dipakai. Hasil: entry JS turun dari
  **822 KB → 13.5 KB** (3.96 KB gzip); first-load total JS (entry + runtime +
  vendor) ≈ **86 KB gzip** vs ±242 KB sebelumnya; jsPDF & optional-dep-nya
  (html2canvas/canvg/dompurify) jadi chunk terpisah yang hanya diunduh saat
  user benar-benar klik "Download PDF".
- **Bukti build ulang** (`VITE_WA_ADMIN=6287748244464 npm run build`):
  `index-*.js` 13.52 KB, `vendor-*.js` 259.49 KB (82.39 KB gzip),
  `jspdf.es.min-*.js` 398.95 KB, per-route chunk 0.7–27.9 KB. Entry chunk
  hanya meng-`import` runtime + vendor (jsPDF dkk **tidak** di first-load);
  `index.html` hasil build hanya preload entry + runtime + vendor + CSS.
  `vite preview` smoke: `/`, chunk `Home-*.js`, chunk `jspdf.es.min-*.js`
  semua balas 200.
- **Catatan**: optionalDependencies jsPDF (`html2canvas`, `canvg`,
  `dompurify`) tetap ter-emit sebagai chunk karena terpasang di
  `node_modules`, tetapi bukan bagian first-load — bukan regresi, hanya
  artefak optional dep. `prebuild` (`rm -rf ../public/assets`) membersihkan
  bundle lama tiap build.
- **File**: `web/src/App.jsx`, `web/src/lib/strukPdf.js`,
  `web/vite.config.js`, `public/index.html` + `public/assets/*` (build),
  `ENGINEER.md`.

### Validasi alamat disatukan: `address_validate` tunggal + label/postal opsional — issue #16, PR #39 (PR ini)

- **Apa**: (1) Fungsi validasi tunggal baru `app/lib/address.php`
  — `address_validate()` dipakai `addresses.php` (profil) DAN
  `bookings-create.php` (wizard); kontrak resmi **snake_case**, camelCase
  (`streetNo`/`mapsUrl`) masih diterima supaya bundle FE lama yang ke-cache
  tidak patah saat deploy. (2) Aturan diseragamkan ke versi longgar-waras:
  wajib jalan/kelurahan/kecamatan/kota/provinsi; **label opsional** ≤40;
  **postal opsional** tapi wajib 5 angka kalau diisi; `street_no` ≤190
  (sesuai kolom DB — dulu validator izinkan 255, bisa mentok strict mode).
  (3) FE: form alamat Profil label+postal jadi opsional + display fallback
  `a.label || 'Alamat'`; wizard `StepIdentitas` pindah ke kunci snake_case;
  `LengkapiProfil` maxLength street 190. (4) Suite tahap 2 +Skenario 9
  (4 cek kontrak alamat, termasuk **PATCH tanpa label/postal = bug kuncinya**);
  suite admin uji11 jadi self-healing via helper `recount-slot` (target
  pindah jadwal di-recount dari tabel bookings di awal uji — anti orphan
  counter antar-run, kelas issue #38). (5) README + bundle FE disinkronkan.
- **Kenapa**: Issue #16 — DUA aturan validasi untuk entitas yang sama:
  profil mewajibkan label ≤40 + postal 5 digit, wizard tidak pernah
  mengisinya. Alamat hasil booking (label/postal NULL) ditolak saat diedit
  dari profil → customer terkunci; FE profil bahkan mematikan tombol simpan.
  Akar masalah form alamat 3 tempat (juga nyambung ke #7).
- **Keputusan**: (a) aturan menang = **longgar** (label/postal opsional) —
  kunci matinya dihapus dari akar, bukan ditambal; postal yang diisi tetap
  divalidasi 5 angka. (b) **Migrasi data existing TIDAK dilakukan** — dengan
  aturan opsional, baris label/postal NULL lama VALID dan tidak terkunci;
  cukup display fallback di FE (rewrite data produksi tidak sepadan dengan
  risikonya). (c) komponen FE `AlamatForm` reusable = cakupan issue #7
  (god components), tidak dikerjakan di sini.
- **Hasil uji (docker lokal)**: `php -l` lolos; tahap 2 **15/16** (S2
  pre-existing #6; Skenario 9: POST tanpa label+postal 200, PATCH tanpa
  label+postal 200 = bug kuncinya, postal "12" → 400, tanpa kelurahan →
  400); suite admin **33/33 dua kali beruntun** (uji11 self-healing);
  suite login **19/19**; kontrak camelCase lama tetap diteruji lewat S1/S8.
- **File**: `app/lib/address.php` (baru), `public/api/addresses.php`,
  `public/api/bookings-create.php`, `web/src/pages/Profil.jsx`,
  `web/src/pages/booking/StepIdentitas.jsx`, `web/src/pages/LengkapiProfil.jsx`,
  `scripts/uji-tahap2.mjs`, `scripts/uji-admin-tahap4.mjs`,
  `scripts/uji-admin-helper.php`, `public/index.html` + `public/assets/*`
  (build), `README.md`, `ENGINEER.md`.

### Reschedule admin diikat aturan jadwal create (Selasa/lewat/H+30) + fix underflow `booked-1` — issue #17, PR #37 (merged `f0845ab`)

- **Apa**: (1) Aturan tanggal jadwal diekstrak jadi fungsi bersama
  `slot_assert_date_rules()` di `app/lib/slots.php` (format, tidak lewat,
  maks H+30, Selasa libur — kode error & pesan identik dengan perilaku lama
  create). (2) `bookings-create.php` memakai fungsi itu (menghapus blok
  duplikat inline). (3) Reschedule admin (`admin/bookings.php` mode pindah
  slot) kini memanggil fungsi yang sama — superadmin ikut aturan customer;
  format tanggal invalid pindah dari kode `bad_request` jadi `date_invalid`
  (diseragamkan). (4) FE `Bookings.jsx`: input tanggal pindah jadwal dapat
  `min`=hari ini & `max`=H+30, guard Selasa dengan pesan jelas (on change +
  saat submit), dan pesan error tampil **di dalam** dialog (dulu cuma di
  banner belakang overlay — tidak terlihat). (5) Bonus fix: 3 titik
  `GREATEST(booked - 1, 0)` (reschedule, cancel customer, cron expire)
  diganti `IF(booked > 0, booked - 1, 0)`. (6) Suite admin +5 cek jadi 33
  (`uji11_pindahJadwalAturan`); README disinkronkan; bundle FE di-rebuild.
- **Kenapa**: Issue #17 — reschedule admin hanya cek format/status/kapasitas;
  Selasa libur mutlak, tanggal lewat, dan window H+30 hanya dijalankan jalur
  customer, jadi admin bisa menaruh booking di Selasa atau masa lalu (aturan
  tidak konsisten, laporan/omzet bisa aneh). Bonus fix: `GREATEST(booked-1, 0)`
  meledak dengan underflow BIGINT UNSIGNED (SQLSTATE 22003) saat `booked = 0`
  — `booked - 1` dihitung dulu sebelum `GREATEST` sempat clamp — ketahuan
  saat uji happy-path pindah jadwal baru; pola sama di cancel customer
  (customer-facing) dan cron expire. Redesign strategi counter tetap urusan
  issue #11 — di sini hanya perbaikan underflow sesuai maksud kode lama.
- **Hasil uji (docker lokal)**: `php -l` lolos; suite admin **33/33** (uji11:
  admin biasa 403, Selasa→400 `hari_selasa`, lewat→400 `date_invalid`,
  H+31→400 `date_invalid`, hari valid→200 + slot berubah); tahap 2 **11/12**
  (S2 pre-existing #6 — refactor create tidak mengubah perilaku); bundle FE
  di-build dengan env produksi (`VITE_WA_ADMIN`).
- **File**: `app/lib/slots.php`, `public/api/bookings-create.php`,
  `public/api/admin/bookings.php`, `public/api/bookings-cancel.php`,
  `scripts/expire-bookings.php`, `scripts/uji-admin-tahap4.mjs`,
  `web/src/pages/admin/Bookings.jsx`, `public/index.html` +
  `public/assets/*` (build), `README.md`, `ENGINEER.md`.

### Timezone WIB diset dari kode: bootstrap + SET time_zone DB + jendela rate limit seragam PHP — issue #18, PR #36 (merged `4b24a6c`)

- **Apa**: (1) `app/lib/bootstrap.php` → `date_default_timezone_set('Asia/Jakarta')`
  sebelum require apa pun — berlaku untuk semua endpoint & skrip cron; (2)
  `app/lib/db.php` → `SET time_zone = '+07:00'` per koneksi PDO, jadi semua
  `NOW()`/`CURDATE()`/`DEFAULT CURRENT_TIMESTAMP` di MySQL = WIB (`updated_at`,
  window `login_attempts`, expire-bookings vs slot bisnis); (3)
  `app/lib/ratelimit.php` → `window_start` ditulis dari PHP `date()` (bukan
  `NOW()` DB) — jendela rate limit satu sumber (PHP), mengikuti pola
  `created_at` di `otp.php`. README ditempeli bagian **Konvensi waktu (WIB)**.
- **Kenapa**: Issue #18 — timezone tidak pernah di-set dari kode; satu-satunya
  set ada di Dockerfile (dev). Produksi Hostinger default UTC → "hari ini"
  dashboard, cutoff H-1 cancel, aturan Selasa, expiry/cooldown OTP, dan
  jendela rate limit bisa meleset 7 jam — kelas bug yang hanya muncul di
  produksi. Bukti campur sumber: rate limit tulis `NOW()` (DB) tapi cek
  `time()` (PHP); komentar historis `otp.php` soal bug UTC-vs-WIB.
- **Hasil audit `date()` vs `NOW()` vs `CURDATE()`**: tidak ada pemakaian
  `CURDATE()`. Jalur PHP (`dashboard` hari ini & rentang bulan, `availability`
  hari ini + clamp H+30, `bookings-cancel` cutoff H-1, expiry/cooldown OTP,
  window rate limit, header Date SMTP, cookie session) ikut timezone bootstrap;
  jalur SQL `NOW()` (`updated_at` bookings/google, window `login_attempts`,
  `expire-bookings` vs slot, insert slots) ikut `SET time_zone`. Pengecualian
  disengaja: `audit_logs.created_at = UTC_TIMESTAMP()` (PRD Bab 15) — dibiarkan
  dan didokumentasikan sebagai konvensi, bukan bug.
- **Keputusan**: (a) WIB dipaksakan dari **kode**, bukan `php_value` di
  .htaccess (shared hosting bisa abaikan); (b) `SET time_zone` pakai offset
  `'+07:00'` — bukan nama zona `Asia/Jakarta` yang butuh tabel timezone MySQL
  belum tentu ada di shared hosting; (b) jendela rate limit semua-PHP
  (checklist issue: satu sumber per konteks, jangan campur).
- **Hasil uji (docker lokal)**: `php -l` lolos; sinkron terbukti — PHP
  `date()` == MySQL `NOW()` selisih **0 detik**, `@@session.time_zone = +07:00`;
  bootstrap memaksa WIB walau server dipaksa `php -d date.timezone=UTC`;
  suite **login 19/19, admin 28/28, tahap 2 11/12** (S2 pre-existing #6),
  **OTP 21/21**; hammer rate limit 429 di req ke-21 + `Retry-After` (jendela
  baru ditulis PHP); cron `expire-bookings` & `cleanup-otp` jalan normal.
  Catatan: kegagalan S7a (balapan) pada run pertama terbukti pre-existing —
  counter slot Jumat 09.00 keisi `booked=1` jam 14:46 oleh run lain **sebelum**
  edit ini; hijau setelah reset data test (kelas polusi suite yang sama dengan
  OTP antar-run).
- **File**: `app/lib/bootstrap.php`, `app/lib/db.php`, `app/lib/ratelimit.php`,
  `README.md`, `ENGINEER.md`.

### Rate limit IP tepercaya di otp-request, otp-verify & otp-email-request-old (20/menit, key REMOTE_ADDR) — issue #25, PR #35 (merged `9fd56dc`)

- **Apa**: `rate_limit()` dapat parameter opsional `$ip` (default tetap
  `client_ip()` — endpoint publik tidak berubah); helper baru `trusted_ip()`
  di `security.php` (hanya `REMOTE_ADDR`, anti XFF spoof); tiga endpoint
  auth OTP dipasangi limit **20 request / 60 detik / IP**: bucket
  `auth:otp-request` dipanggil paling atas `otp-request.php`,
  `auth:otp-verify` paling atas `otp-verify.php`, `auth:otp-email-old`
  paling atas `otp-email-request-old.php` (semua sebelum validasi/auth —
  request invalid pun kehitung). Catatan Keterbatasan di README disesuaikan.
- **Kenapa**: Issue #25 (analisa pentest 14 Okt 2026) — kedua endpoint ini
  nol rate limit: 250 request beruntun ke otp-verify tanpa satu pun 429, dan
  8 email beda dari 1 IP semuanya 200 di otp-request (cooldown hanya per
  email) → pelaku bisa bakar kuota SMTP tanpa batas (OTP asli berhenti
  diterima pelanggan) + brute-force/DoS ringan. `client_ip()` percaya
  X-Forwarded-For yang bisa dipalsukan client, jadi bucket auth sengaja
  di-key `REMOTE_ADDR` — konsisten `admin-login.php`/`login.php`: rotasi
  XFF tidak membobol limit.
- **Keputusan**: 20/menit/IP per endpoint (rentang 10–20 sesuai saran
  issue) — longgar buat NAT kantor & suite uji (butuh 13 request + 9
  verify per run), tapi memblokir skenario pentest. Limit ditaruh paling
  atas file (sebelum validasi) supaya semua request dihitung. Keputusan
  dicatat di PRD Bab 18 (`Credential+plan/PRD-app-indeep.md`, di luar
  repo & gitignored — file lokal Bang Rob).
- **Hasil uji (docker lokal)**: suite OTP **21/21**, suite login **19/19**,
  `php -l` semua file lolos. Hammer: otp-verify 25x → 429 di req #21 +
  `Retry-After: 60`; otp-request 23x (email & XFF beda tiap req, skenario
  pentest) → 20x200 lalu `rate_limited` + `Retry-After: 59`; rotasi XFF
  tetap 429; otp-email-request-old 22x tanpa login (XFF beda tiap req) →
  20x401 lalu 429 (limit kehitung sebelum auth). 3 kegagalan awal uji8
  terbukti pre-existing (gagal identik di `main`) — polusi data suite
  antar run, bukan perubahan ini.
- **File**: `app/lib/ratelimit.php`, `app/lib/security.php`,
  `public/api/otp-request.php`, `public/api/otp-verify.php`,
  `public/api/otp-email-request-old.php`, `README.md`, `ENGINEER.md`.

### README disinkronkan dengan realita produksi (subdomain, Google aktif, CI mati, build base '/') — PR #34 (PR ini)

- **Apa**: `README.md` diperbaiki di titik-titik yang sudah tidak sesuai kondisi
  nyata: (1) repo yang benar `digital-assets-indeepcleaningid` (badge CI &
  perintah `git clone` lama menunjuk repo `indeep-booking` yang **tidak ada**);
  (2) alamat produksi = subdomain `booking.indeepcleaningid.site`
  (`/app-booking/` sudah 404) — termasuk diagram arsitektur, referensi
  `APP_URL`/`WEB_URL`, redirect URI Google, dan jalur cron; (3) build produksi
  pakai base `/` — instruksi `VITE_BASE_PATH=/app-booking/` dihapus (kalau
  diikuti, aset produksi 404); (4) Google OAuth ditandai **aktif** (diverifikasi
  `302` ke `accounts.google.com` dengan `client_id` terisi), bukan lagi "nunggu
  credential"; (5) CI ditandai **belum aktif** (workflow ada di
  `booking/.github/workflows/`, GitHub hanya baca root repo — `gh run list`
  kosong) di badge, tech stack, bagian deployment, dan tabel integrasi;
  (6) struktur repo dijelaskan sebagai **monorepo** (website + `booking/`);
  (7) klaim `app/models/` dihapus (foldernya kosong — issue #13); (8) bagian
  keamanan ditambah: `login-dev.php` lokal-saja, pengecualian anti-enumerasi
  `409 password_not_set` yang disengaja, dan catatan rate limit per-IP belum
  "tepercaya" (issue #25); (9) skenario 2 Tahap 2 ditandai gagal pre-existing.
- **Kenapa**: README jadi sumber kebingungan — menyuruh build dengan env yang
  salah dan mendokumentasikan status yang sudah berubah (Google OAuth, CI,
  URL produksi), padahal repo ini dibuka untuk inspeksi & bakal dipakai tim.
- **Verifikasi**: semua klaim baru dicek langsung — `404` di path lama, `302`
  Google di live, hash bundle produksi == hash bundle `main`, `gh run list`
  kosong, `ls app/models/` kosong, `gh repo view indeep-booking` tidak ada.
- **File**: `README.md`, `ENGINEER.md`.

### Login customer email + password manual: endpoint `/login.php` + form `Login.jsx` — issue #30, tutup #31, PR #33 (merged `9d4ad1b`)

- **Apa**: Dua bagian — (1) endpoint baru `POST /api/login.php`: validasi input,
  rate limit 5 percobaan / 10 menit / IP (tabel `login_attempts`, pola
  `admin-login.php`, basis `REMOTE_ADDR`), cari customer by email,
  `password_verify`, lalu `session_boot()` + `login_user()` (regenerate id) +
  `audit_log`. (2) form di `Login.jsx` diganti dari email+nama (panggilan
  `login-dev.php`) jadi **email + password** pakai `PasswordInput`, Google
  tetap di atas sebagai pintu utama, link "Lupa password?" dipindah ke sebelah
  field password. Suite uji baru `uji-login-password.mjs` (19 cek) +
  `uji-login-helper.php`. README (fitur, tabel login, tabel suite, keterbatasan)
  ikut disinkronkan; bundle `public/` di-rebuild.
- **Kenapa**: Issue #30 — jalur set/reset password sudah ada tapi tidak ada
  pintu masuknya, jadi reset password dead end dan customer tanpa Google tidak
  bisa masuk sama sekali di produksi. Alur ini juga menyelesaikan issue #31
  (form yang memanggil `login-dev.php` — sekarang 403 di produksi — sudah
  diganti, jadi `login-dev.php` murni alat dev lokal).
- **Keputusan produk**: (a) akun yang belum punya password (dibuat via Google)
  dibalas **409 `password_not_set`** dengan arahan ke Google / "Lupa password"
  — sadar membocorkan status akun, dipilih demi UX (issue #30); (b) gagal
  password salah vs email tidak terdaftar tetap **401 identik** (anti
  enumerasi); (c) rate limit basis `REMOTE_ADDR` (konsisten admin-login,
  tidak bisa dipalsukan header) — revisi "IP tepercaya" menyusul di #25.
- **Hasil uji (state DB fresh)**: login password **19/19**, OTP **21/21**,
  Admin **28/28**, Tahap 2 **11/12** (1 gagal S2 surcharge = pre-existing,
  sudah dibuktikan gagal juga di `main`).
- **File**: `public/api/login.php` (baru), `web/src/pages/Login.jsx`,
  `scripts/uji-login-helper.php` (baru), `scripts/uji-login-password.mjs`
  (baru), `README.md`, `public/index.html` + `public/assets/*` (hasil build),
  `ENGINEER.md`.

### Backdoor login-dev ditutup total di produksi: gate .htaccess + gate PHP dobel + audit trail — issue #27, PR #32 (merged)

- **Apa**: Tiga lapis penutupan `public/api/login-dev.php` — (1) `public/.htaccess`
  dan `.htaccess` root nge-block file ini dengan `[F,L]` sebelum PHP sempat
  jalan; (2) gate di PHP diperkuat jadi dobel: wajib `APP_URL` lokal **dan**
  `PHP_SAPI === 'cli-server'` (server `php -S` Docker lokal — Apache/LiteSpeed
  produksi gak mungkin punya SAPI ini); (3) `audit_log()` dipanggil tiap
  endpoint dipanggil (`login_dev_blocked` saat gate menahan, `login_dev`
  saat login lokal lolos).
- **Kenapa**: Issue #27 (hasil analisa pentest) — endpoint auto-provision akun
  (INSERT `role='customer'` + session tanpa bukti apa pun) ikut ter-deploy ke
  produksi dan gate tunggalnya cuma string `APP_URL`, jadi sekali config
  salah ketik backdoor nyala **senyap**. Usulan "exclude dari artefak deploy"
  gak bisa: Hostinger auto-deploy gak punya mekanisme exclude ("files
  committed to the repo are the files served"), jadi diganti gate di web
  server yang gak baca config sama sekali. Gate SAPI menggantikan usulan flag
  `DEV_LOGIN_ENABLED` — tanpa config key sama sekali (gak ada risiko
  `config()` lempar error karena kunci gak dikenal), dan gak perlu ngoprek
  config server. Dev lokal + suite uji tetap jalan: `php -S` gak baca
  `.htaccess`, dan SAPI-nya `cli-server`.
- **File**: `public/api/login-dev.php`, `public/.htaccess`, `.htaccess`,
  `ENGINEER.md`.

## 2026-10-13

### Persiapan flip public: README top-matter, LICENSE, CONTRIBUTING — PR #21 (PR ini)

- **Apa**: Tiga file presentasi disiapkan buat repo publik — README: badge CI
  + ringkasan Inggris singkat + framing "proprietary, source available for
  inspection" (baris "Status repo: private" dihapus, bagian Lisensi ikut);
  LICENSE: klausa "Repository is PRIVATE" diganti model source-available
  (Section 2 baru "Nature of this Release", pembatasan reuse diperkuat
  termasuk larangan layanan bersaing); CONTRIBUTING: preamble untuk pembaca
  publik (bug report welcome, security via SECURITY.md, kebijakan PR
  eksternal).
- **Kenapa**: Repo mau di-flip public buat porto & review tanpa minta akses —
  dokumen lama masih menjamin privasi repo yang sudah tidak berlaku, dan
  LICENSE lama justru melarang keras hal yang baru kita putuskan.
- **File**: `README.md`, `LICENSE`, `CONTRIBUTING.md`, `ENGINEER.md`.

### Go-public hygiene: jejak password default dihapus + SECURITY.md — PR #20 (merged `17a0070`)

- **Apa**: Persiapan repo sebelum di-flip public — 6 titik password default
  hardcoded dihapus dari `README` (2), `config.example.php`, `seed.php`,
  `dev.mjs`, dan `uji-admin-tahap4.mjs`. Seed kini **wajib** `SEED_ADMIN_*`
  diisi sendiri (guard `exit(1)`, tanpa echo password); test admin baca
  kredensial dari `config/config.php` lokal / env `UJI_ADMIN_*`. `SECURITY.md`
  baru: disclosure policy + pernyataan "tidak ada credential/PII di repo".
- **Kenapa**: Repo disiapkan jadi publik (porto + bisa direview tanpa minta
  akses). Password default terdokumentasi = petunjuk username + pola password
  buat attacker live site. Secret scan 14 commit history: **bersih** — string
  mirip token hanyalah integrity hash `package-lock.json`.
- **File**: `README.md`, `config/config.example.php`, `scripts/seed.php`,
  `scripts/dev.mjs`, `scripts/uji-admin-tahap4.mjs`, `SECURITY.md`, `ENGINEER.md`.

### Repo dikasih kerangka maintain: README, CONTRIBUTING, ENGINEER, LICENSE, CI — PR #1 (merged `54a8a6e`)

- **Apa**: Lima file fondasi — README (dokumentasi lengkap app), CONTRIBUTING
  (aturan wajib PR + review manual Bang Rob + wajib log), ENGINEER (log
  perubahan, diisi dari git log), LICENSE (proprietary), dan GitHub Actions CI
  pertama (`php -l` + build Vite + cek bundle `public/` sinkron sama source).
- **Kenapa**: `main` auto-deploy ke live, jadi perubahan gak boleh masuk tanpa
  review; repo juga disiapin jadi referensi tim dan template project porto.
- **File**: `README.md`, `CONTRIBUTING.md`, `ENGINEER.md`, `LICENSE`,
  `.github/workflows/ci.yml`.

### README versi Indonesia — PR #2 (PR ini)

- **Apa**: Seluruh isi `README.md` diterjemahkan ke bahasa Indonesia
  (struktur, tabel, kode identik — cuma bahasa prosa). Anchor internal
  `CONTRIBUTING.md` disesuaikan (`#testing` → `#pengujian`).
- **Kenapa**: Permintaan Bang Rob — repo dan tim pakai bahasa Indonesia biar
  gak ada salah paham. (Keputusan awal Inggris demi porto, ditukar belakangan.)
- **File**: `README.md`, `CONTRIBUTING.md`, `ENGINEER.md`.

### FE ganti email: validasi sebelum kirim — `c86b008`

- **Apa**: Form "Ganti Email" di `/profil` menolak email kosong dan format
  salah di frontend sebelum memanggil API (banner pesan + trim spasi pinggir).
  Tombol tidak lagi memicu request `newEmail` kosong.
- **Kenapa**: Gejala live — klik "Kirim dua kode OTP" tanpa isi email
  (form `noValidate` tidak memblokir) membuat backend membalas
  `400 invalid_email` "Email baru belum benar formatnya ya." sehingga fase
  input OTP tidak pernah terbuka.
- **File**: `web/src/pages/Profil.jsx`, bundle `public/assets/`.

## 2026-10-12

### OTP produksi: klien SMTP mentah Gmail — `392993c`

- **Apa**: Klien SMTP nol-dependensi baru `app/lib/smtp.php` (dialog
  EHLO → AUTH LOGIN → MAIL → RCPT → DATA, TLS implisit port 465) menggantikan
  PHPMailer sesuai amendmen PRD Bab 10.4. Produksi dengan SMTP kosong kini
  membalas `503 email_disabled` yang jujur (bukan sukses palsu ke file log).
  Ditambah `scripts/cleanup-otp.php` buat cron 10 menit.
- **Kenapa**: PRD asli mewajibkan PHPMailer, tapi keputusan Bang Rob:
  zero-dep ala EXP011, satu provider Gmail, tiap baris bisa ditrace.
- **File**: `app/lib/smtp.php` (baru), `app/lib/mailer.php`,
  `scripts/cleanup-otp.php` (baru), `config/config.example.php`.
- **Verifikasi**: uji protocol offline lawan fake SMTP TLS + suite OTP
  21/21 lolos + live `otp-request` membalas 200.

### PRD disinkronisasi ke realita (file internal, di luar git)

- **Apa**: 15 titik PRD diperbarui: PHPMailer → SMTP mentah, port 8000 →
  Docker 5011, upload manual → deploy auto push `main`, CSRF token per form →
  Origin allowlist, build `web/dist/` → `public/`, risiko SMTP ditutup,
  dedup risiko Node/PHP, footer Next ditujuin.
- **Kenapa**: PRD sempat jadi "harapan", bukan "realita kode".
- **File**: `Credential+plan/PRD-app-indeep.md` (tidak dicommit, sengaja).

### Seed produksi: pintu dibuka sekali lalu ditutup permanen — `335dd43`, `8c3095c`, `a0230a6`

- **Apa**: Seed jalan di Hostinger shared (tanpa SSH) lewat wrapper web
  sekali-pakai `seed-web.php` → 10 tabel, 44 SKU, 3 surcharge, admin Argon2id
  terisi. Pintu kemudian dihapus dan diblokir permanen di root `.htaccess`.
- **Kenapa**: Hostinger gak punya akses CLI; seeding wajib sekali di server.
- **File**: `scripts/seed.php`, `scripts/seed-web.php`, `.htaccess`.

### Fix path produksi: origin check, base API, prefix brand — `ea2394d`

- **Apa**: Semua request tulis tadinya kena `403` universal di produksi
  karena origin check membandingkan full URL vs origin. Diperbaiki via
  `origin_of()` (scheme://host[:port]). `api.js` kini turun dari
  `import.meta.env.BASE_URL` (gak perlu `VITE_API_URL`), prefix
  `/app-booking/` untuk link Google login dan URL foto profil, robots +
  sitemap ke domain asli.
- **Kenapa**: Deploy pertama bikin semua tulis (login, booking, OTP) gagal.
- **File**: `app/lib/security.php`, `app/lib/response.php`, `web/src/api.js`,
  4 file brand, `web/public/robots.txt`, `web/public/sitemap.xml`.

### Deploy auto: Vite outDir ke public/ + root .htaccess routing — `33ef6cf`, `8982f27`

- **Apa**: Build frontend jatuh langsung ke `public/` (bukan `web/dist/`),
  root `.htaccess` memblok file repo internal lalu mengarahkan sisanya ke
  `public/` dengan fallback SPA React Router untuk deploy sub-path.
- **Kenapa**: Hostinger auto-deploy menyinkronkan repo ke `public_html`;
  tanpa routing ini asset React 404 di hard-refresh route dalam.
- **File**: `web/vite.config.js`, `.htaccess`, `public/index.html`,
  `public/assets/*`.

### Bersihkan file uji struk PDF — `565282a`

- **Apa**: File hasil uji `web/struk-*.pdf` dihapus dan masuk `.gitignore`.
- **Kenapa**: File uji bukan bagian produk.

### Rilis v1 — `37d5fc0`

- **Apa**: Aplikasi lengkap sesuai PRD locked: booking 5 langkah, pricelist
  44 SKU, slot anti-tumpang-tindih (transaksi InnoDB + optimistic lock),
  dashboard admin, profil + OTP, struk PDF, auth Google + admin, seed,
  neobrutalism rounded. React 19 + Vite 8 + Tailwind 4 + PHP 8.3 zero-dep
  + MariaDB 11 Docker.
- **Kenapa**: Inisialisasi repo dari PRD (11 Okt 2026).

---

> Aturan: entry terbaru di atas. Jangan menghapus entry lama — riwayat ini
> yang dipakai saat audit, debugging "kenapa keputusan ini", dan onboarding tim.
