<?php
/**
 * GET /api/google-callback.php — penerima callback Google OAuth (PRD Bab 10.1).
 *
 * Alur: code + state -> tukar token -> ambil email/nama/google_id ->
 * cocokkan atau buat user -> set session -> redirect balik ke frontend.
 * Menggunakan file_get_contents (allow_url_fopen) — tanpa ext-curl, zero-dep.
 */

require __DIR__ . '/../../app/lib/bootstrap.php';
require __DIR__ . '/../../app/lib/session.php';

if (config('GOOGLE_CLIENT_ID') === '') {
    json_error(503, 'google_disabled', 'Login Google belum aktif.');
}

session_boot();

$webUrl = rtrim((string) config('WEB_URL', 'http://localhost:5173'), '/');

$code  = (string) ($_GET['code'] ?? '');
$state = (string) ($_GET['state'] ?? '');
$errGoogle = (string) ($_GET['error'] ?? '');

// User menekan "Batal" di layar Google
if ($errGoogle !== '') {
    header('Location: ' . $webUrl . '/login?google=cancelled', true, 302);
    exit;
}

// --- Validasi state (anti-CSRF) ---
$saved = $_SESSION['google_oauth_state'] ?? '';
unset($_SESSION['google_oauth_state']);
if ($code === '' || $saved === '' || !hash_equals($saved, $state)) {
    header('Location: ' . $webUrl . '/login?google=invalid_state', true, 302);
    exit;
}

// --- Tukar code -> access token (Google token endpoint) ---
$tokenBody = http_build_query([
    'code'          => $code,
    'client_id'     => config('GOOGLE_CLIENT_ID'),
    'client_secret' => config('GOOGLE_CLIENT_SECRET'),
    'redirect_uri'  => rtrim((string) config('APP_URL'), '/') . '/api/google-callback.php',
    'grant_type'    => 'authorization_code',
]);

$tokenResp = google_http_post('https://oauth2.googleapis.com/token', $tokenBody);
$accessToken = $tokenResp['access_token'] ?? '';
if ($accessToken === '') {
    header('Location: ' . $webUrl . '/login?google=token_failed', true, 302);
    exit;
}

// --- Ambil profil (email, nama, sub) ---
$profile = google_http_get('https://openidconnect.googleapis.com/v1/userinfo', $accessToken);
$email = strtolower(trim((string) ($profile['email'] ?? '')));
$name  = trim((string) ($profile['name'] ?? ''));
$sub   = (string) ($profile['sub'] ?? '');

if ($email === '' || $sub === '') {
    header('Location: ' . $webUrl . '/login?google=profile_failed', true, 302);
    exit;
}

// --- Cocokkan user: (1) google_id, (2) email existing -> link, (3) buat baru ---
$pdo = db();

$stmt = $pdo->prepare('SELECT id, role FROM users WHERE google_id = ?');
$stmt->execute([$sub]);
$user = $stmt->fetch();

if (!$user) {
    $stmt = $pdo->prepare('SELECT id, role FROM users WHERE email = ?');
    $stmt->execute([$email]);
    $user = $stmt->fetch();
}

if ($user) {
    // Link google_id + email_verified (email Google sudah terverifikasi Google)
    $pdo->prepare('UPDATE users SET google_id = ?, email = ?, email_verified_at = COALESCE(email_verified_at, NOW()) WHERE id = ?')
        ->execute([$sub, $email, (int) $user['id']]);
} else {
    $displayName = $name !== '' ? $name : explode('@', $email)[0];
    $pdo->prepare(
        "INSERT INTO users (role, name, email, google_id, email_verified_at, profile_complete)
         VALUES ('customer', ?, ?, ?, NOW(), 0)"
    )->execute([$displayName, $email, $sub]);
    $user = ['id' => (int) $pdo->lastInsertId(), 'role' => 'customer'];
}

login_user((int) $user['id'], (string) $user['role']);

header('Location: ' . $webUrl . '/login?google=ok', true, 302);
exit;

// ---------------------------------------------------------------- helpers

function google_http_post(string $url, string $body): array
{
    $ctx = stream_context_create(['http' => [
        'method'  => 'POST',
        'header'  => "Content-Type: application/x-www-form-urlencoded\r\nContent-Length: " . strlen($body) . "\r\n",
        'content' => $body,
        'timeout' => 15,
    ]]);
    $raw = @file_get_contents($url, false, $ctx);
    $json = json_decode($raw ?: '', true);
    return is_array($json) ? $json : [];
}

function google_http_get(string $url, string $accessToken): array
{
    $ctx = stream_context_create(['http' => [
        'method'  => 'GET',
        'header'  => "Authorization: Bearer $accessToken\r\nAccept: application/json\r\n",
        'timeout' => 15,
    ]]);
    $raw = @file_get_contents($url, false, $ctx);
    $json = json_decode($raw ?: '', true);
    return is_array($json) ? $json : [];
}
