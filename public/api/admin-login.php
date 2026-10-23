<?php
/**
 * POST /api/admin-login.php — login admin khusus username + password (PRD Bab 10.2).
 * Tanpa email. Rate limit: 5 kali per 10 menit per IP (tabel login_attempts).
 * Password verify Argon2id / bcrypt — hasil seed.
 */

require __DIR__ . '/../../app/lib/bootstrap.php';
require __DIR__ . '/../../app/lib/session.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_error(405, 'method_not_allowed', 'Metode ini tidak didukung.');
}

$body = read_json_body();

$username = trim((string) ($body['username'] ?? ''));
$password = (string) ($body['password'] ?? '');

if ($username === '' || $password === '') {
    json_error(400, 'missing_fields', 'Username dan password wajib diisi ya.');
}

$ip = (string) ($_SERVER['REMOTE_ADDR'] ?? '0.0.0.0');

// --- Rate limit 5 percobaan / 10 menit / IP (PRD Bab 10.2) ---
$countStmt = db()->prepare(
    'SELECT COUNT(*) FROM login_attempts
     WHERE ip = ? AND attempted_at > (NOW() - INTERVAL 10 MINUTE)'
);
$countStmt->execute([$ip]);
$attempts = (int) $countStmt->fetchColumn();

if ($attempts >= 5) {
    json_error(429, 'rate_limited', 'Terlalu sering mencoba login. Coba lagi dalam beberapa menit ya.');
}

// Catat percobaan (sukses maupun gagal)
$insertAttempt = db()->prepare(
    'INSERT INTO login_attempts (ip, username, attempted_at) VALUES (?, ?, NOW())'
);
$insertAttempt->execute([$ip, $username]);

// --- Cari admin + verifikasi ---
$stmt = db()->prepare(
    "SELECT id, role, password_hash FROM users
     WHERE username = ? AND role IN ('admin', 'superadmin')"
);
$stmt->execute([$username]);
$row = $stmt->fetch();

// Pesan satu pintu biar tidak bocor mana yang salah (PRD Bab 17: pesan sopan)
if (!$row || !password_verify($password, (string) $row['password_hash'])) {
    json_error(401, 'invalid_credentials', 'Username atau passwordnya belum cocok. Cek lagi ya.');
}

// --- Sukses: set session + regenerate id ---
session_boot();
login_user((int) $row['id'], (string) $row['role']);

$meStmt = db()->prepare(
    'SELECT id, role, name, username, email, profile_complete FROM users WHERE id = ?'
);
$meStmt->execute([$row['id']]);

json_response(['data' => $meStmt->fetch()]);
