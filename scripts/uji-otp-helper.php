<?php
/**
 * Helper CLI buat uji OTP Tahap 3 (T3-B5).
 * Dipanggil dari scripts/uji-otp-tahap3.mjs lewat docker compose exec.
 *
 * Pemakaian:
 *   php scripts/uji-otp-helper.php clear <email> <purpose>
 *   php scripts/uji-otp-helper.php bypass-cooldown <email> <purpose> <detik>
 *   php scripts/uji-otp-helper.php expire <email> <purpose>
 *   php scripts/uji-otp-helper.php check-password <email> <plaintext>
 *   php scripts/uji-otp-helper.php reset-email <email_lama> <email_baru>
 */

require __DIR__ . '/../app/lib/bootstrap.php';

$action = $argv[1] ?? '';
$pdo = db();

switch ($action) {
    case 'clear':
        $st = $pdo->prepare('DELETE FROM otps WHERE email = ? AND purpose = ?');
        $st->execute([$argv[2], $argv[3]]);
        echo 'ok ' . $st->rowCount() . PHP_EOL;
        break;

    case 'bypass-cooldown':
        // Mundurkan created_at supaya cooldown 60 detik terlewati
        $st = $pdo->prepare(
            'UPDATE otps SET created_at = DATE_SUB(created_at, INTERVAL ? SECOND)
             WHERE email = ? AND purpose = ? AND consumed = 0'
        );
        $st->execute([(int) $argv[4], $argv[2], $argv[3]]);
        echo 'ok ' . $st->rowCount() . PHP_EOL;
        break;

    case 'expire':
        // Set semua kode aktif jadi kedaluwarsa
        $st = $pdo->prepare(
            'UPDATE otps SET expires_at = DATE_SUB(NOW(), INTERVAL 1 SECOND)
             WHERE email = ? AND purpose = ? AND consumed = 0'
        );
        $st->execute([$argv[2], $argv[3]]);
        echo 'ok ' . $st->rowCount() . PHP_EOL;
        break;

    case 'check-password':
        $st = $pdo->prepare('SELECT password_hash FROM users WHERE email = ?');
        $st->execute([$argv[2]]);
        $row = $st->fetch();
        if ($row && password_verify($argv[3], $row['password_hash'])) {
            echo 'cocok' . PHP_EOL;
        } else {
            echo 'tidak' . PHP_EOL;
        }
        break;

    case 'reset-email':
        $st = $pdo->prepare('UPDATE users SET email = ? WHERE email = ?');
        $st->execute([$argv[3], $argv[2]]);
        echo 'ok ' . $st->rowCount() . PHP_EOL;
        break;

    default:
        fwrite(STDERR, "aksi tidak dikenal: $action\n");
        exit(1);
}
