<?php
/**
 * POST /api/otp-email-request-old.php — kirim OTP ke email LAMA (PRD Bab 10.4).
 * Butuh login. Bagian 1 dari alur ganti email (bagian 2: email baru via
 * otp-request.php purpose=ganti_email, penutup: otp-email-confirm.php).
 */

require __DIR__ . '/../../app/lib/bootstrap.php';
require __DIR__ . '/../../app/lib/session.php';
require __DIR__ . '/../../app/lib/otp.php';
require __DIR__ . '/../../app/lib/ratelimit.php';

// 20 request / menit / IP tepercaya (REMOTE_ADDR, bukan XFF yang bisa
// dipalsukan) — endpoint ini ikut kirim OTP (bakar kuota SMTP), pasang
// bareng otp-request/otp-verify (issue #25).
rate_limit('auth:otp-email-old', 20, 60, trusted_ip());

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_error(405, 'method_not_allowed', 'Metode ini tidak didukung.');
}

$user = require_login();
$email = (string) $user['email'];
if ($email === '') {
    json_error(400, 'invalid_email', 'Akun ini belum punya email ya.');
}

$info = otp_request_send($email, 'ganti_email');

json_response(['data' => $info]);
