<?php
/**
 * Helper CLI buat uji login email + password (issue #30).
 * Dipakai scripts/uji-login-password.mjs lewat docker compose exec.
 *
 * Pemakaian:
 *   php scripts/uji-login-helper.php seed-customer <email> [nama]
 *   php scripts/uji-login-helper.php set-password <email> <password>
 *   php scripts/uji-login-helper.php clear-password <email>
 *   php scripts/uji-login-helper.php password-state <email>   -> set|null|tidak-ada
 *   php scripts/uji-login-helper.php clear-attempts
 *   php scripts/uji-login-helper.php count-audit <action> <potongan-reason>
 */

require __DIR__ . '/../app/lib/bootstrap.php';

$action = $argv[1] ?? '';
$pdo = db();

switch ($action) {
    case 'seed-customer':
        [$email, $name] = [$argv[2] ?? '', $argv[3] ?? 'Customer Uji Login'];
        if ($email === '') {
            fwrite(STDERR, "email kosong\n");
            exit(1);
        }
        $pdo->prepare(
            "INSERT IGNORE INTO users (role, name, email, profile_complete)
             VALUES ('customer', ?, ?, 0)"
        )->execute([$name, strtolower($email)]);
        $st = $pdo->prepare('SELECT id FROM users WHERE email = ?');
        $st->execute([strtolower($email)]);
        echo $st->fetchColumn() . PHP_EOL;
        break;

    case 'set-password':
        [$email, $password] = [$argv[2] ?? '', $argv[3] ?? ''];
        if ($email === '' || $password === '') {
            fwrite(STDERR, "email/password kosong\n");
            exit(1);
        }
        // Sama dengan otp-verify.php: PASSWORD_DEFAULT (bcrypt/argon sesuai PHP)
        $hash = password_hash($password, PASSWORD_DEFAULT);
        $st = $pdo->prepare('UPDATE users SET password_hash = ? WHERE email = ?');
        $st->execute([$hash, strtolower($email)]);
        echo $st->rowCount() . PHP_EOL;
        break;

    case 'clear-password':
        $st = $pdo->prepare('UPDATE users SET password_hash = NULL WHERE email = ?');
        $st->execute([strtolower($argv[2] ?? '')]);
        echo $st->rowCount() . PHP_EOL;
        break;

    case 'password-state':
        $st = $pdo->prepare('SELECT password_hash FROM users WHERE email = ?');
        $st->execute([strtolower($argv[2] ?? '')]);
        $row = $st->fetch();
        if ($row === false) {
            echo "tidak-ada\n";
        } else {
            echo ($row['password_hash'] === null || $row['password_hash'] === '') ? "null\n" : "set\n";
        }
        break;

    case 'clear-attempts':
        $pdo->exec('DELETE FROM login_attempts');
        echo "ok\n";
        break;

    case 'count-audit':
        $st = $pdo->prepare('SELECT COUNT(*) FROM audit_logs WHERE action = ? AND reason LIKE ?');
        $st->execute([$argv[2] ?? '', '%' . ($argv[3] ?? '') . '%']);
        echo $st->fetchColumn() . PHP_EOL;
        break;

    default:
        fwrite(STDERR, "aksi tidak dikenal: $action\n");
        exit(1);
}
