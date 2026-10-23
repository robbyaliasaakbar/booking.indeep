<?php
/**
 * Helper CLI buat uji keamanan (issue #29).
 * Dipakai scripts/uji-security-tahap29.mjs lewat `docker compose exec`.
 *
 * Pemakaian:
 *   php scripts/uji-security-helper.php seed-customer <email> <nama> <wa>
 *   php scripts/uji-security-helper.php latest-otp-code <email> <purpose>
 *   php scripts/uji-security-helper.php read-otp-log <email> <purpose>
 *   php scripts/uji-security-helper.php user-id <email>
 *   php scripts/uji-security-helper.php count-bookings <user_id>
 *   php scripts/uji-security-helper.php cleanup-customer <email>
 *   php scripts/uji-security-helper.php reset-security-state
 */

declare(strict_types=1);

require __DIR__ . '/../app/lib/bootstrap.php';

$action = $argv[1] ?? '';
$pdo = db();

switch ($action) {
    // Bikin (atau pakai kalau ada) customer test dengan email unik.
    case 'seed-customer':
        [$email, $name, $wa] = [$argv[2], $argv[3] ?? 'Uji Security', $argv[4] ?? '081200009999'];
        $email = strtolower($email);
        $st = $pdo->prepare('SELECT id FROM users WHERE email = ?');
        $st->execute([$email]);
        if ($row = $st->fetch()) {
            echo $row['id'] . PHP_EOL;
            break;
        }
        $pdo->prepare(
            "INSERT INTO users (email, name, role, phone_primary, profile_complete)
             VALUES (?, ?, 'customer', ?, 1)"
        )->execute([$email, $name, $wa]);
        echo $pdo->lastInsertId() . PHP_EOL;
        break;

    // Baca kode OTP aktif (dev mode: hanya untuk uji lokal) dari hash store.
    // Kita TIDAK bisa membalik hash — jadi fungsi ini buat memastikan ada baris
    // aktif, bukan mengungkap kode. Untuk ambil kode asli dipakai read-otp-log.
    case 'latest-otp-code':
        $email = strtolower($argv[2]);
        $purpose = $argv[3];
        $st = $pdo->prepare(
            'SELECT COUNT(*) FROM otps WHERE email = ? AND purpose = ? AND consumed = 0 AND expires_at > NOW()'
        );
        $st->execute([$email, $purpose]);
        echo $st->fetchColumn() . PHP_EOL;
        break;

    // Baca kode OTP dari storage/otp-dev.log (mode lokal, SMTP kosong).
    case 'read-otp-log':
        $email = strtolower($argv[2]);
        $purpose = $argv[3];
        $path = dirname(__DIR__) . '/storage/otp-dev.log';
        if (!is_file($path)) {
            echo 'NONE' . PHP_EOL;
            break;
        }
        $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
        $found = 'NONE';
        foreach ($lines as $ln) {
            if (str_contains($ln, "TO={$email}") && str_contains($ln, "PURPOSE={$purpose}")) {
                if (preg_match('/CODE=(\d{6})/', $ln, $m)) {
                    $found = $m[1]; // baris terakhir menang (kode terbaru)
                }
            }
        }
        echo $found . PHP_EOL;
        break;

    case 'user-id':
        $st = $pdo->prepare('SELECT id FROM users WHERE email = ?');
        $st->execute([strtolower($argv[2])]);
        echo ($st->fetchColumn() ?: '0') . PHP_EOL;
        break;

    case 'count-bookings':
        $st = $pdo->prepare('SELECT COUNT(*) FROM bookings WHERE user_id = ?');
        $st->execute([(int) $argv[2]]);
        echo $st->fetchColumn() . PHP_EOL;
        break;

    case 'cleanup-customer':
        $email = strtolower($argv[2]);
        $st = $pdo->prepare('SELECT id FROM users WHERE email = ?');
        $st->execute([$email]);
        $uid = (int) ($st->fetchColumn() ?: 0);
        if ($uid > 0) {
            $pdo->prepare('DELETE FROM booking_items WHERE booking_id IN (SELECT id FROM bookings WHERE user_id = ?)')->execute([$uid]);
            $pdo->prepare('DELETE FROM booking_surcharges WHERE booking_id IN (SELECT id FROM bookings WHERE user_id = ?)')->execute([$uid]);
            $pdo->prepare('DELETE FROM bookings WHERE user_id = ?')->execute([$uid]);
            $pdo->prepare('DELETE FROM addresses WHERE user_id = ?')->execute([$uid]);
            $pdo->prepare('DELETE FROM users WHERE id = ?')->execute([$uid]);
        }
        echo "ok\n";
        break;

    case 'reset-security-state':
        $pdo->exec('DELETE FROM otps');
        $pdo->exec('DELETE FROM login_attempts');
        $pdo->exec('DELETE FROM api_rate_limits');
        echo "ok\n";
        break;

    default:
        fwrite(STDERR, "aksi tidak dikenal: $action\n");
        exit(1);
}
