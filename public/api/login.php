<?php
/**
 * POST /api/login.php — login customer pakai email + password (issue #30).
 *
 * Pintu utama tetap Google OAuth. Endpoint ini pelengkap buat customer yang
 * sudah menyetel password lewat alur "Lupa password" (OTP) — sebelumnya
 * password itu bisa diset tapi tidak ada pintu masuknya.
 *
 * Rate limit: 5 percobaan / 10 menit / IP (tabel login_attempts, pola sama
 * dengan admin-login.php). Basis IP: REMOTE_ADDR — konsisten admin-login,
 * tidak bisa dipalsukan lewat header X-Forwarded-For.
 *
 * Pesan error satu pintu (401 generik) biar tidak membocorkan email mana yang
 * terdaftar. Pengecualian: akun yang belum pernah punya password (dibuat via
 * Google) dibalas pesan spesifik + arahan — keputusan produk, lihat issue #30.
 */

require __DIR__ . '/../../app/lib/bootstrap.php';
require __DIR__ . '/../../app/lib/session.php';
require __DIR__ . '/../../app/lib/audit.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_error(405, 'method_not_allowed', 'Metode ini tidak didukung.');
}

$body = read_json_body();

$email    = strtolower(trim((string) ($body['email'] ?? '')));
$password = (string) ($body['password'] ?? '');

if ($email === '' || $password === '') {
    json_error(400, 'missing_fields', 'Email dan password wajib diisi ya.');
}
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    json_error(400, 'invalid_email', 'Emailnya belum benar formatnya. Cek lagi ya.');
}

$ip = (string) ($_SERVER['REMOTE_ADDR'] ?? '0.0.0.0');

// --- Rate limit 5 percobaan / 10 menit / IP ---
$countStmt = db()->prepare(
    'SELECT COUNT(*) FROM login_attempts
     WHERE ip = ? AND attempted_at > (NOW() - INTERVAL 10 MINUTE)'
);
$countStmt->execute([$ip]);
$attempts = (int) $countStmt->fetchColumn();

if ($attempts >= 5) {
    json_error(429, 'rate_limited', 'Terlalu sering mencoba login. Coba lagi dalam beberapa menit ya.');
}

// Catat percobaan (sukses maupun gagal) — pola admin-login.php
$insertAttempt = db()->prepare(
    'INSERT INTO login_attempts (ip, username, attempted_at) VALUES (?, ?, NOW())'
);
$insertAttempt->execute([$ip, $email]);

// --- Cari customer + verifikasi password ---
$stmt = db()->prepare(
    "SELECT id, role, name, email, password_hash FROM users
     WHERE email = ? AND role = 'customer'"
);
$stmt->execute([$email]);
$row = $stmt->fetch();

if (!$row) {
    audit_log(null, 'guest', 'login_failed', null, null, null, 'Email tidak terdaftar: ' . $email);
    json_error(401, 'invalid_credentials', 'Email atau passwordnya belum cocok. Cek lagi ya.');
}

$hash = (string) ($row['password_hash'] ?? '');

// Akun dibuat lewat Google (belum punya password) — arahkan, jangan error teknis
if ($hash === '') {
    audit_log(
        (int) $row['id'],
        'customer',
        'login_failed',
        null, null, null,
        'Akun belum punya password (dibuat via Google): ' . $email
    );
    json_error(
        409,
        'password_not_set',
        'Akun ini dibuat pakai Google, jadi belum punya password. Masuk pakai Google ya, atau set password dulu lewat "Lupa password".'
    );
}

if (!password_verify($password, $hash)) {
    audit_log(
        (int) $row['id'],
        'customer',
        'login_failed',
        null, null, null,
        'Password salah: ' . $email
    );
    json_error(401, 'invalid_credentials', 'Email atau passwordnya belum cocok. Cek lagi ya.');
}

// --- Sukses: set session (regenerate id di login_user) + jejak audit ---
session_boot();
login_user((int) $row['id'], (string) $row['role']);

audit_log(
    (int) $row['id'],
    (string) $row['role'],
    'login_password',
    null, null, null,
    'Login email + password'
);

$meStmt = db()->prepare(
    'SELECT id, role, name, username, email, profile_complete FROM users WHERE id = ?'
);
$meStmt->execute([$row['id']]);

json_response(['data' => $meStmt->fetch()]);
