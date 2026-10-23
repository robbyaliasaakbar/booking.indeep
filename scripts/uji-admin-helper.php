<?php
/**
 * Helper CLI buat uji admin Tahap 4 (T4-B4).
 * Dipakai scripts/uji-admin-tahap4.mjs lewat docker compose exec.
 *
 * Pemakaian:
 *   php scripts/uji-admin-helper.php seed-booking-pending <email> <tanggal> <jam>
 *   php scripts/uji-admin-helper.php get-booking <id>
 *   php scripts/uji-admin-helper.php hapus-booking <id>
 *   php scripts/uji-admin-helper.php seed-admin-biasa <email>
 *   php scripts/uji-admin-helper.php restore-pricelist <id> <harga>
 *   php scripts/uji-admin-helper.php restore-slot <id> <kapasitas> <locked>
 *   php scripts/uji-admin-helper.php count-audit <action> <booking_id>
 */

require __DIR__ . '/../app/lib/bootstrap.php';
require __DIR__ . '/../app/lib/slots.php';

$action = $argv[1] ?? '';
$pdo = db();

switch ($action) {
    case 'seed-booking-pending':
        [$email, $tanggal, $jam] = [$argv[2], $argv[3], $argv[4]];
        $st = $pdo->prepare('SELECT id, name, phone_primary FROM users WHERE email = ?');
        $st->execute([$email]);
        $u = $st->fetch();
        if (!$u) { fwrite(STDERR, "user $email tidak ada\n"); exit(1); }

        $kode = 'IDP-UJI4-' . strtoupper(bin2hex(random_bytes(3)));
        $pdo->prepare(
            'INSERT INTO bookings (code,user_id,name_snapshot,phone_primary_snapshot,
             address_snapshot_street_no,address_snapshot_village,address_snapshot_district,
             address_snapshot_city,address_snapshot_province,subtotal,surcharge_total,total,
             slot_date,slot_time,status,idempotency_key)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)'
        )->execute([
            $kode, $u['id'], $u['name'] ?: 'Uji Admin', $u['phone_primary'] ?: '0812000000',
            'Jl Uji Admin', 'Kel Uji', 'Kec Uji', 'Depok', 'Jawa Barat',
            150000, 0, 150000, $tanggal, $jam, 'pending', 'uji4-' . $kode,
        ]);
        echo $pdo->lastInsertId() . ' ' . $kode . PHP_EOL;
        break;

    case 'get-booking':
        $st = $pdo->prepare('SELECT id, code, status, version, total FROM bookings WHERE id = ?');
        $st->execute([(int) $argv[2]]);
        $r = $st->fetch();
        if ($r) {
            echo "{$r['id']} {$r['code']} {$r['status']} {$r['version']} {$r['total']}\n";
        } else {
            echo "tidak ada\n";
        }
        break;

    case 'hapus-booking':
        // Recount slot setelah hapus (issue #11): production hard delete sudah
        // recount, helper uji ikut supaya counter tidak orphan antar-run.
        $bid = (int) $argv[2];
        $st = $pdo->prepare('SELECT slot_date, slot_time FROM bookings WHERE id = ?');
        $st->execute([$bid]);
        $b = $st->fetch();
        $pdo->prepare('DELETE FROM bookings WHERE id = ?')->execute([$bid]);
        if ($b) {
            slot_recount($pdo, (string) $b['slot_date'], (string) $b['slot_time']);
        }
        echo "ok\n";
        break;

    case 'recount-slot':
        // Recount booked dari source of truth (tabel bookings) — bersihkan
        // counter orphan antar-run (issue #38; dipakai uji11 pindah jadwal)
        [$tanggal, $jam] = [$argv[2], $argv[3]];
        $pdo->prepare(
            "UPDATE slots s SET booked = (
                SELECT COUNT(*) FROM bookings b
                WHERE b.slot_date = s.slot_date AND b.slot_time = s.slot_time
                  AND b.status IN ('pending','confirmed','in_progress','completed')
             ) WHERE s.slot_date = ? AND s.slot_time = ?"
        )->execute([$tanggal, $jam]);
        echo "ok\n";
        break;

    case 'seed-admin-biasa':
        $email = $argv[2];
        $cek = $pdo->prepare('SELECT id FROM users WHERE email = ?');
        $cek->execute([$email]);
        if ($cek->fetch()) { echo "sudah ada\n"; break; }
        $pdo->prepare(
            "INSERT INTO users (email,name,role,password_hash) VALUES (?,?,'admin',NULL)"
        )->execute([$email, 'Admin Biasa Uji']);
        echo $pdo->lastInsertId() . PHP_EOL;
        break;

    case 'restore-pricelist':
        $pdo->prepare('UPDATE pricelist SET price = ?, is_active = 1, version = version + 1 WHERE id = ?')
            ->execute([(int) $argv[3], (int) $argv[2]]);
        echo "ok\n";
        break;

    case 'restore-slot':
        $pdo->prepare('UPDATE slots SET capacity = ?, is_locked = ? WHERE id = ?')
            ->execute([(int) $argv[2], (int) $argv[3], (int) $argv[4]]);
        echo "ok\n";
        break;

    case 'count-audit':
        $st = $pdo->prepare('SELECT COUNT(*) FROM audit_logs WHERE action = ? AND booking_id = ?');
        $st->execute([$argv[2], (int) $argv[3]]);
        echo $st->fetchColumn() . PHP_EOL;
        break;

    case 'clear-login-attempts':
        $pdo->exec('DELETE FROM login_attempts');
        echo "ok\n";
        break;

    case 'reset-state-uji':
        // Teruskan ke reset terpusat (issue #38)
        require __DIR__ . '/reset-uji.php';
        break;

    default:
        fwrite(STDERR, "aksi tidak dikenal: $action\n");
        exit(1);
}
