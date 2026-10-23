<?php
/**
 * Session PHP native buat auth (PRD Bab 10.1):
 * - Cookie HttpOnly, SameSite Lax, Secure otomatis kalau APP_URL https.
 * - session_regenerate_id() tiap login (anti session fixation).
 * - Logout semua device = hapus baris session (lanjut saat tabel sessions dibutuhkan).
 */

declare(strict_types=1);

function session_boot(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }

    $secure = str_starts_with((string) config('APP_URL'), 'https://');

    // Session aktif 1 jam (3600 detik) — baik cookie maupun server-side GC
    $lifetime = 3600;

    ini_set('session.use_strict_mode', '1');
    ini_set('session.gc_maxlifetime', (string) $lifetime);
    session_name('INDEEPSESSID');
    session_set_cookie_params([
        'lifetime' => $lifetime,
        'path'     => '/',
        'domain'   => '',
        'secure'   => $secure,
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
    session_start();
}

function current_user_id(): ?int
{
    return isset($_SESSION['user_id']) ? (int) $_SESSION['user_id'] : null;
}

function login_user(int $userId, string $role): void
{
    session_regenerate_id(true);
    $_SESSION['user_id'] = $userId;
    $_SESSION['role']    = $role;
}

function logout_user(): void
{
    $_SESSION = [];

    if (ini_get('session.use_cookies') === '1') {
        $params = session_get_cookie_params();
        setcookie(session_name(), '', [
            'expires'  => time() - 42000,
            'path'     => $params['path'],
            'domain'   => $params['domain'],
            'secure'   => $params['secure'],
            'httponly' => $params['httponly'],
            'samesite' => $params['samesite'],
        ]);
    }

    if (session_status() === PHP_SESSION_ACTIVE) {
        session_destroy();
    }
}

/**
 * Wajib sudah login. Balas row user publik, atau 401.
 */
function require_login(): array
{
    session_boot();

    $id = current_user_id();
    if ($id === null) {
        json_error(401, 'unauthorized', 'Silakan login dulu ya.');
    }

    $stmt = db()->prepare(
        'SELECT id, role, name, email, username, phone_primary, phone_secondary, photo_path, profile_complete
         FROM users WHERE id = ?'
    );
    $stmt->execute([$id]);
    $user = $stmt->fetch();

    if (!$user) {
        logout_user();
        json_error(401, 'unauthorized', 'Sesi sudah tidak berlaku. Silakan login ulang ya.');
    }

    return $user;
}

/**
 * Wajib login dengan role tertentu. Balas row user, atau 401/403.
 */
function require_role(string ...$roles): array
{
    $user = require_login();

    if (!in_array($user['role'], $roles, true)) {
        json_error(403, 'forbidden', 'Bagian ini khusus tim InDeep ya.');
    }

    return $user;
}

/**
 * Hitung ulang flag profile_complete (PRD Bab 10.1):
 * lengkap = nama ada + WA utama ada + punya minimal satu alamat default.
 * Dipanggil setiap kali nama/WA diubah (PATCH me) atau alamat tersimpan.
 */
function recompute_profile_complete(int $userId): bool
{
    $stmt = db()->prepare(
        "SELECT
            (SELECT COUNT(*) FROM addresses WHERE user_id = ? AND is_default = 1) AS default_addresses
         FROM users WHERE id = ?"
    );
    $stmt->execute([$userId, $userId]);
    $row = $stmt->fetch();

    if (!$row) {
        return false;
    }

    $stmt = db()->prepare(
        'SELECT (name <> "") AS has_name, (phone_primary IS NOT NULL AND phone_primary <> "") AS has_phone
         FROM users WHERE id = ?'
    );
    $stmt->execute([$userId]);
    $u = $stmt->fetch();

    $complete = $u && (int) $u['has_name'] === 1 && (int) $u['has_phone'] === 1
        && (int) $row['default_addresses'] >= 1;

    $upd = db()->prepare('UPDATE users SET profile_complete = ? WHERE id = ?');
    $upd->execute([$complete ? 1 : 0, $userId]);

    return (bool) $complete;
}
