<?php
/**
 * POST /api/otp-verify.php — verifikasi OTP + aksi final (PRD Bab 10.4, 16.2).
 *
 * Body JSON:
 *   purpose: "ganti_password" | "lupa_password"
 *   code:    6 digit
 *   newPassword: password baru (min 8 karakter)
 *   email:   wajib untuk lupa_password (publik); untuk ganti_password dari akun login.
 *
 * Verifikasi sukses langsung menerapkan password baru (keputusan T3-B1:
 * tanpa tabel token reset tambahan — cukup OTP sebagai bukti).
 */

require __DIR__ . '/../../app/lib/bootstrap.php';
require __DIR__ . '/../../app/lib/session.php';
require __DIR__ . '/../../app/lib/otp.php';
require __DIR__ . '/../../app/lib/audit.php';
require __DIR__ . '/../../app/lib/ratelimit.php';

// 20 percobaan / menit / IP tepercaya (REMOTE_ADDR, bukan XFF yang bisa
// dipalsukan) — defense in depth di atas attempt cap 5x salah (issue #25).
rate_limit('auth:otp-verify', 20, 60, trusted_ip());

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_error(405, 'method_not_allowed', 'Metode ini tidak didukung.');
}

$body = read_json_body();

$purpose    = trim((string) ($body['purpose'] ?? ''));
$code       = trim((string) ($body['code'] ?? ''));
$newPassword = (string) ($body['newPassword'] ?? '');
$email      = trim((string) ($body['email'] ?? ''));

if (!in_array($purpose, ['ganti_password', 'lupa_password'], true)) {
    json_error(400, 'purpose_invalid', 'Tujuan kode tidak dikenal ya.');
}
if (strlen($newPassword) < 8) {
    json_error(400, 'password_invalid', 'Password baru minimal 8 karakter ya.');
}
if (strlen($newPassword) > 200) {
    json_error(400, 'password_invalid', 'Password baru kepanjangan, maksimal 200 karakter ya.');
}

$pdo = db();

if ($purpose === 'ganti_password') {
    $user = require_login();
    $email = (string) $user['email'];
    $userId = (int) $user['id'];
    if ($email === '') {
        json_error(400, 'invalid_email', 'Akun ini belum punya email ya.');
    }
} else {
    // lupa_password: publik — cari customer dengan email itu
    if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        json_error(400, 'invalid_email', 'Emailnya belum benar formatnya ya.');
    }
    $stmt = $pdo->prepare("SELECT id FROM users WHERE email = ? AND role = 'customer'");
    $stmt->execute([strtolower($email)]);
    $found = $stmt->fetch();
    if (!$found) {
        // Generik — jangan bocorkan email terdaftar atau tidak
        json_error(400, 'otp_not_found', 'Kode tidak ditemukan. Minta kode baru ya.');
    }
    $userId = (int) $found['id'];
}

otp_verify($email, $purpose, $code);

// OTP cocok — terapkan password baru
$hash = password_hash($newPassword, PASSWORD_DEFAULT);
$pdo->prepare('UPDATE users SET password_hash = ? WHERE id = ?')
    ->execute([$hash, $userId]);

audit_log(
    $userId,
    'customer',
    $purpose === 'ganti_password' ? 'password_change' : 'password_reset',
    null, null, null,
    'OTP lolos verifikasi'
);

json_response(['data' => ['ok' => true]]);
