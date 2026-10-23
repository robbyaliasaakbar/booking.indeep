# CONTRIBUTING — Aturan Kontribusi App InDeep Booking

> **Untuk pembaca publik:** ini sistem produksi bisnis tertentu — bukan library
> umum. **Laporan bug lewat issue terbuka sangat diterima**, terima kasih!
> Soal keamanan jangan lewat issue publik — ikuti [SECURITY.md](SECURITY.md).
> PR dari kontributor luar: perbaikan kecil dipertimbangkan setelah
> didiskusikan di issue dulu; perubahan besar atau fitur baru jarang diterima
> karena ini app operasional bisnis spesifik, bukan produk umum.
>
> Aturan di bawah berlaku untuk **siapa pun** yang menyentuh repo ini,
> termasuk maintainer. Baca dokumen ini sepenuhnya sebelum mengubah apa pun.

## ⚠️ Aturan Utama (wajib baca)

### 1. `main` = production, dilarang push langsung

Setiap push ke branch `main` **langsung ter-deploy otomatis ke Hostinger**
(`booking.indeepcleaningid.site`) dalam 15–20 detik. Karena itu:

- **Semua perubahan WAJIB lewat Pull Request (PR).**
- **Bang Rob mengecek manual dulu sebelum merge.** Jangan pernah merge PR
  sendiri, jangan pernah push langsung ke `main`, jangan pernah force-push.
- PR yang CI-nya merah jangan dilanjutkan review sampai hijau.

### 2. Setiap perubahan wajib dicatat di `ENGINEER.md`

Tiap PR **wajib** menambah entry baru di [`ENGINEER.md`](ENGINEER.md):

- Tanggal perubahan (YYYY-MM-DD)
- Judul singkat + commit/PR
- **Apa** yang berubah dan **kenapa**
- File yang kena (ringkas)

PR tanpa log `ENGINEER.md` = ditolak. Ini yang bikin riwayat sistem
terlacak saat ada tim nanti.

### 3. File yang TIDAK BOLEH pernah masuk repo

| File/folder | Alasan |
|---|---|
| `Credential+plan/` (PRD, rencana bisnis) | Rahasia bisnis, sudah .gitignore |
| `config/config.php` | Kredensial DB & SMTP asli server |
| `web/.env`, `web/.env.*.local` | Environment asli |
| `public/uploads/*` (selain `index.php`) | Data user (foto profil) |
| `storage/otp-dev.log`, `*.log` | Log berisi kode OTP |

Double-check `git status` sebelum `git add`. Kalau ada file yang ragu-ragu:
**jangan di-commit**, tanya dulu.

---

## Alur Kerja Standar

```bash
# 1. Ambil terbaru dari main
git checkout main && git pull origin main

# 2. Bikin branch (pakai prefix ini)
git checkout -b fitur/nama-singkat        # fitur baru
git checkout -b fix/nama-singkat          # perbaikan bug
git checkout -b docs/nama-singkat         # dokumentasi
git checkout -b chore/nama-singkat        # ritual (deps, CI, cleanup)

# 3. Kerjakan perubahan, lalu jalankan checklist di bawah

# 4. Update ENGINEER.md (wajib!), lalu commit
git add <file-yang-berubah>
git commit -m "Area: deskripsi singkat perubahan"

# 5. Push branch + buka PR
git push -u origin <branch>
gh pr create --title "Area: deskripsi" --body "Apa + kenapa + cara tes"

# 6. Tunggu CI hijau → tunggu Bang Rob review → BANG ROB yang merge
```

### Gaya commit message

Konsisten dengan riwayat repo: `Area: deskripsi singkat`

Contoh yang benar:

- `OTP produksi: raw SMTP ala EXP011 + wajib jujur kalo SMTP kosong`
- `FE ganti email: validasi sebelum kirim`
- `docs: README, CONTRIBUTING, ENGINEER, LICENSE, CI`

---

## Checklist Sebelum Buka PR

Jalankan yang relevan (semua wajib kecuali ditandai opsional):

- [ ] **PHP**: semua file lolos lint —
      `find public app scripts -name '*.php' -print0 | xargs -0 -n1 php -l`
      (atau biar CI yang jalan)
- [ ] **Frontend** (ada perubahan di `web/`): build sukses —
      `VITE_WA_ADMIN=628xxxxxxxxxxx npm run build`
      (base `/` — JANGAN isi `VITE_BASE_PATH`/`VITE_BASENAME`,
      itu sisa era sub-path `/app-booking/` yang sudah mati)
- [ ] **Auth/OTP/booking berubah**: jalankan suite uji terkait (lihat daftar
      di [README — Pengujian](README.md#pengujian))
- [ ] `git status` bersih dari file terlarang (Aturan 3)
- [ ] `ENGINEER.md` sudah dapat entry baru
- [ ] Bundle hasil build ikut ter-commit kalau `web/` berubah
      (hasil build jatuh ke `public/` — lihat README bagian Deployment dan CI/CD)

## Catatan CI

Setiap PR otomatis dijalankan GitHub Actions (`.github/workflows/ci.yml`):

1. **php-lint** — `php -l` semua file PHP (PHP 8.3)
2. **frontend-build** — `npm ci` + build Vite + verifikasi bundle di `public/`
   sesuai dengan source (menangkap "lupa rebuild setelah edit kode")

PR baru boleh direview setelah dua job ini hijau.

## Setelah Merge

1. Tunggu auto-deploy Hostinger (±15–20 detik).
2. Verifikasi cepat di live: buka app, cek halaman yang berubah,
   pastikan tidak ada error 500/404.
3. Kalau ada masalah: **revert via PR baru**, jangan force-push `main`.

## Pertanyaan

Kalau ragu soal cakupan perubahan, desain, atau dampak ke data production —
tanya Bang Rob dulu sebelum menulis kode. Lebih murah diskusi daripada
merewrite.
