<?php
/**
 * POST /api/otp-request.php — minta kode OTP (PRD Bab 10.4, 16.2).
 *
 * Body JSON:
 *   purpose: "ganti_password" | "lupa_password" | "ganti_email"
 *   email:   wajib untuk lupa_password (publik);
 *            untuk ganti_password/ganti_email dipakai email akun login.
 *   newEmail: wajib kalau purpose = ganti_email (alamat email BARU).
 *
 * Selalu balas generik (kode tidak pernah ikut di response — hanya via mailer).
 */

require __DIR__ . '/../../app/lib/bootstrap.php';
require __DIR__ . '/../../app/lib/session.php';
require __DIR__ . '/../../app/lib/otp.php';
require __DIR__ . '/../../app/lib/ratelimit.php';

// 20 request / menit / IP tepercaya (REMOTE_ADDR, bukan XFF yang bisa
// dipalsukan) — pembatasan kedua setelah cooldown per-email (issue #25).
rate_limit('auth:otp-request', 20, 60, trusted_ip());

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_error(405, 'method_not_allowed', 'Metode ini tidak didukung.');
}

$body = read_json_body();

$purpose = trim((string) ($body['purpose'] ?? ''));
$email   = trim((string) ($body['email'] ?? ''));
$newEmail = trim((string) ($body['newEmail'] ?? ''));

switch ($purpose) {
    case 'lupa_password':
        // Publik — email diambil dari body
        if ($email === '') {
            json_error(400, 'invalid_email', 'Isi email dulu ya.');
        }
        break;

    case 'ganti_password':
        // Butuh login — email dari akun sendiri
        $user = require_login();
        $email = (string) $user['email'];
        if ($email === '') {
            json_error(400, 'invalid_email', 'Akun ini belum punya email. Lengkapi dulu ya.');
        }
        break;

    case 'ganti_email':
        // Butuh login — OTP dikirim ke email BARU (OTP ke email lama lewat
        // endpoint khusus otp-email-request-old.php)
        $user = require_login();
        $old = (string) $user['email'];
        if ($old === '') {
            json_error(400, 'invalid_email', 'Akun ini belum punya email. Lengkapi dulu ya.');
        }
        if ($newEmail === '' || !filter_var($newEmail, FILTER_VALIDATE_EMAIL)) {
            json_error(400, 'invalid_email', 'Email baru belum benar formatnya ya.');
        }
        if (strtolower($newEmail) === strtolower($old)) {
            json_error(400, 'invalid_email', 'Email baru sama dengan email lama ya. Pakai email lain.');
        }
        // Cek bentrok dengan akun lain
        $chk = db()->prepare('SELECT id FROM users WHERE email = ? AND id <> ?');
        $chk->execute([strtolower($newEmail), (int) $user['id']]);
        if ($chk->fetch()) {
            json_error(400, 'invalid_email', 'Email itu sudah dipakai akun lain ya.');
        }
        $email = strtolower($newEmail);
        $purpose = 'ganti_email';
        break;

    default:
        json_error(400, 'purpose_invalid', 'Tujuan kode tidak dikenal ya.');
}

$info = otp_request_send($email, $purpose);

json_response(['data' => $info]);
