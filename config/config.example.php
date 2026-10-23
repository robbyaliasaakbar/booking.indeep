<?php
/**
 * Config contoh App InDeep Booking
 *
 * Pakai: salin jadi config/config.php lalu isi nilai asli.
 * File config/config.php ASLI tidak boleh dicommit (sudah masuk .gitignore).
 * Sesuai PRD Bab 14.3.
 *
 * Catatan dev (keputusan Bang Rob, 11 Okt 2026):
 * - Backend PHP jalan via Docker, port 5011 (port 8000 dipakai app lain).
 * - MySQL lokal via Docker MariaDB, jadi DB_HOST = nama service docker 'db'.
 * - Produksi: ganti DB_HOST + APP_URL dengan milik Hostinger.
 */

return [
    // --- Database (PRD Bab 14.3) ---
    'DB_HOST' => 'db',                 // lokal docker: 'db' | Hostinger: host MySQL dari hPanel
    'DB_NAME' => 'indeep_booking',
    'DB_USER' => 'indeep',
    'DB_PASS' => 'isi_password_lokal', // ganti di config.php asli

    // --- URL ---
    'APP_URL' => 'http://localhost:5011', // base backend PHP (port keputusan: 5011)
    'WEB_URL' => 'http://localhost:5173', // Vite dev, boleh auto geser bila port penuh

    // --- Google OAuth login customer (PRD Bab 10.1) ---
    // Diisi di config.php asli (gitignored). Redirect URI yang terdaftar di
    // Google Console: {APP_URL}/api/google-callback.php
    'GOOGLE_CLIENT_ID' => '',
    'GOOGLE_CLIENT_SECRET' => '',

    // --- SMTP untuk OTP email (PRD Bab 10.4 — amendmen: Gmail, raw SMTP) ---
    // Produksi (keputusan Bang Rob): Gmail App Password.
    //   SMTP_HOST = 'smtp.gmail.com' | SMTP_USER = email Gmail | SMTP_PASS = App Password 16 karakter
    // (Butuh 2-Step Verification aktif dulu di akun Google.)
    // Lokal: kosongkan semua -> kode OTP ditulis ke storage/otp-dev.log.
    'SMTP_HOST' => '',
    'SMTP_USER' => '',
    'SMTP_PASS' => '',

    // --- Seed admin (PRD Bab 10.2) ---
    // Wajib diisi sendiri — repo TIDAK menyimpan default password.
    'SEED_ADMIN_USERNAME' => 'admin indeep',
    'SEED_ADMIN_PASSWORD' => '',

    // --- Aturan bisnis default (PRD Bab 8) ---
    'MIN_ORDER_IDR' => 250000,     // BR06
    'SLOT_CAPACITY_DEFAULT' => 1,  // BR03
];
