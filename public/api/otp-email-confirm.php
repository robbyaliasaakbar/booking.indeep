<?php
/**
 * POST /api/otp-email-confirm.php — tutup alur ganti email (PRD Bab 10.4).
 * Butuh login. Body: { newEmail, oldCode, newCode }.
 * Dua-duanya lolos baru email berubah.
 */

require __DIR__ . '/../../app/lib/bootstrap.php';
require __DIR__ . '/../../app/lib/session.php';
require __DIR__ . '/../../app/lib/otp.php';
require __DIR__ . '/../../app/lib/audit.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_error(405, 'method_not_allowed', 'Metode ini tidak didukung.');
}

$user = require_login();

$body = read_json_body();

$oldEmail = (string) $user['email'];
$newEmail = strtolower(trim((string) ($body['newEmail'] ?? '')));
$oldCode  = trim((string) ($body['oldCode'] ?? ''));
$newCode  = trim((string) ($body['newCode'] ?? ''));

if ($oldEmail === '') {
    json_error(400, 'invalid_email', 'Akun ini belum punya email ya.');
}
if ($newEmail === '' || !filter_var($newEmail, FILTER_VALIDATE_EMAIL)) {
    json_error(400, 'invalid_email', 'Email baru belum benar formatnya ya.');
}
if ($newEmail === strtolower($oldEmail)) {
    json_error(400, 'invalid_email', 'Email baru sama dengan email lama ya.');
}

// Bentrok dengan akun lain?
$chk = db()->prepare('SELECT id FROM users WHERE email = ? AND id <> ?');
$chk->execute([$newEmail, (int) $user['id']]);
if ($chk->fetch()) {
    json_error(400, 'invalid_email', 'Email itu sudah dipakai akun lain ya.');
}

// 1. OTP email lama
otp_verify($oldEmail, 'ganti_email', $oldCode);

// 2. OTP email baru
otp_verify($newEmail, 'ganti_email', $newCode);

// Dua-duanya lolos — ganti email (timestamp eksplisit WIB, lihat catatan di otp.php)
db()->prepare('UPDATE users SET email = ?, email_verified_at = ? WHERE id = ?')
    ->execute([$newEmail, date('Y-m-d H:i:s'), (int) $user['id']]);

audit_log(
    (int) $user['id'],
    'customer',
    'email_change',
    null, null, null,
    'Dua OTP lolos verifikasi: ' . $oldEmail . ' -> ' . $newEmail
);

json_response(['data' => ['ok' => true, 'email' => $newEmail]]);
