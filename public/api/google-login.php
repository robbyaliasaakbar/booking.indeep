<?php
/**
 * GET /api/google-login.php — pintu masuk login Google (PRD Bab 10.1).
 * Redirect browser ke halaman persetujuan Google dengan state acak (anti-CSRF).
 * Selesai di Google -> balik ke /api/google-callback.php.
 */

require __DIR__ . '/../../app/lib/bootstrap.php';
require __DIR__ . '/../../app/lib/session.php';

if (config('GOOGLE_CLIENT_ID') === '') {
    json_error(503, 'google_disabled', 'Login Google belum aktif. Pakai email dev dulu ya.');
}

session_boot();

// State acak disimpan di session — diverifikasi di callback
$state = bin2hex(random_bytes(16));
$_SESSION['google_oauth_state'] = $state;

$redirectUri = rtrim((string) config('APP_URL'), '/') . '/api/google-callback.php';

$params = http_build_query([
    'client_id'     => config('GOOGLE_CLIENT_ID'),
    'redirect_uri'  => $redirectUri,
    'response_type' => 'code',
    'scope'         => 'openid email profile',
    'state'         => $state,
    'prompt'        => 'select_account', // biar bisa pilih akun lain
]);

header('Location: https://accounts.google.com/o/oauth2/v2/auth?' . $params, true, 302);
exit;
