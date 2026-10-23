<?php
/**
 * POST /api/login-dev.php — fallback login customer via email (PRD Bab 10.1).
 *
 * Login Google adalah pintu utama. Login dev ini HANYA untuk dev lokal.
 *
 * Dua gate (issue #27):
 * - Gate 1 (web server): .htaccess memblokir file ini di produksi — request
 *   berhenti sebelum PHP sempat jalan.
 * - Gate 2 (gate ini): wajib APP_URL localhost DAN server php -S (SAPI
 *   'cli-server') yang cuma dipakai Docker lokal. Produksi jalan di
 *   Apache/LiteSpeed, jadi walau APP_URL config salah/ketuker (mis. ke-copy
 *   dari config.example), endpoint ini tetap mati — gak ada yang bisa
 *   mengaktifkan lewat config.
 * - Tiap pemanggilan dicatat audit_log biar ada jejak.
 */

require __DIR__ . '/../../app/lib/bootstrap.php';
require __DIR__ . '/../../app/lib/session.php';
require __DIR__ . '/../../app/lib/audit.php';

$appUrl  = (string) config('APP_URL');
$isLocal = str_contains($appUrl, 'localhost') || str_contains($appUrl, '127.0.0.1');
// php -S (server dev lokal) punya SAPI 'cli-server'; Apache/LiteSpeed tidak.
$isDevServer = PHP_SAPI === 'cli-server';

if (!$isLocal || !$isDevServer) {
    audit_log(
        null,
        'system',
        'login_dev_blocked',
        null, null, null,
        'APP_URL=' . $appUrl . ' | SAPI=' . PHP_SAPI
    );
    json_error(403, 'dev_disabled', 'Login dev hanya tersedia di lingkungan lokal.');
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_error(405, 'method_not_allowed', 'Metode ini tidak didukung.');
}

$raw  = file_get_contents('php://input');
$body = json_decode($raw ?: '', true);
if (!is_array($body)) {
    json_error(400, 'bad_request', 'Data yang dikirim belum benar.');
}

$email = strtolower(trim((string) ($body['email'] ?? '')));
$name  = trim((string) ($body['name'] ?? ''));

if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    json_error(400, 'invalid_email', 'Emailnya belum benar formatnya. Cek lagi ya.');
}

// --- Cari user yang sudah ada (role apa pun — biar bisa login dev sebagai
// admin/superadmin juga untuk uji panel; kalau baru, bikin customer) ---
$stmt = db()->prepare(
    "SELECT id, role, name, email, username, phone_primary, phone_secondary, photo_path, profile_complete
     FROM users WHERE email = ?"
);
$stmt->execute([$email]);
$user = $stmt->fetch();

// --- Belum ada: buat row customer baru (profil belum lengkap) ---
if (!$user) {
    $displayName = $name !== '' ? $name : ('Customer ' . substr($email, 0, strpos($email, '@') ?: 0));
    if ($displayName === '' || $displayName === 'Customer ') {
        $displayName = 'Customer';
    }

    $insert = db()->prepare(
        "INSERT INTO users (role, name, email, profile_complete) VALUES ('customer', ?, ?, 0)"
    );
    $insert->execute([$displayName, $email]);

    // Ambil ulang row baru — pakai email yang sama, bukan id (stmt asli query by email)
    $stmt->execute([$email]);
    $user = $stmt->fetch();
}

session_boot();
login_user((int) $user['id'], (string) $user['role']);

audit_log(
    (int) $user['id'],
    (string) $user['role'],
    'login_dev',
    null, null, null,
    'Login dev lokal (email ' . $email . ')'
);

json_response(['data' => $user]);
