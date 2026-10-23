<?php
/**
 * Uji balapan attempt cap OTP (issue #26) — dipanggil N proses paralel.
 * Pakai: php uji-race-otp.php <email> <purpose>
 *
 * otp_verify() keluar lewat json_error() (echo JSON + exit) saat gagal, jadi
 * output proses ini adalah JSON respons yang sama dengan endpoint produksi.
 * Driver (uji-race-otp.mjs) membaca output ini dan menghitung kode respons:
 *   otp_salah      → sampai password_verify(), masih ada jatah
 *   terlalu_sering → cap tercapai / lock aktif
 *   otp_not_found / otp_kedaluwarsa → tidak ada kode aktif
 *
 * Tujuan: dengan N proses paralel memakai kode SALAH, jumlah langkah yang
 * benar-benar sampai password_verify() harus <= OTP_MAX_ATTEMPTS (5).
 */

require __DIR__ . '/../app/lib/bootstrap.php';
require __DIR__ . '/../app/lib/otp.php';

$email   = strtolower(trim($argv[1] ?? ''));
$purpose = trim($argv[2] ?? '');

if ($email === '' || $purpose === '') {
    fwrite(STDERR, "pemakaian: php uji-race-otp.php <email> <purpose>\n");
    exit(1);
}

// Kode 6 digit dijamin tidak cocok dengan kode test.
otp_verify($email, $purpose, '000000');

// Tidak tercapai: otp_verify selalu exit lewat json_error() pada kode salah,
// atau return true (yang tidak diharapkan pada uji ini).
fwrite(STDERR, "tak terduga: otp_verify kembali tanpa error\n");
exit(1);
