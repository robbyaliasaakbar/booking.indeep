<?php
/**
 * CLI: tandai booking pending kedaluwarsa (PRD Bab 18 — cron tiap 5 menit).
 *
 * Aturan (keputusan T8-B4):
 *   status = 'pending'  AND  slot_date + slot_time  <=  NOW()
 *   -> status 'expired', slot dibuka lagi, audit log tercatat.
 *
 * Pending yang sudah melewati jam slotnya tidak mungkin dikerjakan lagi —
 * admin kehilangan kesempatan konfirmasi, jadi booking dibatalkan sistem.
 *
 * Pemakaian lokal (Docker):
 *   docker compose exec -T php php /app/scripts/expire-bookings.php
 * Pemakaian produksi (Hostinger cron job, tiap 5 menit):
 *   php /home/USER/scripts/expire-bookings.php
 */

declare(strict_types=1);

require __DIR__ . '/../app/lib/bootstrap.php';
require __DIR__ . '/../app/lib/audit.php';
require __DIR__ . '/../app/lib/slots.php';

// Amankan: hanya boleh jalan dari CLI
if (PHP_SAPI !== 'cli') {
    fwrite(STDERR, "Hanya untuk CLI.\n");
    exit(1);
}

$pdo = db();

// Slot yang jamnya sudah lewat: "YYYY-MM-DD HH:MM" <= NOW
// slot_time format "09.00" -> "09:00" untuk datetime MySQL.
$rows = $pdo->query(
    "SELECT id, code, user_id, slot_date, slot_time
     FROM bookings
     WHERE status = 'pending'
       AND CONCAT(slot_date, ' ', REPLACE(slot_time, '.', ':')) <= NOW()
     ORDER BY id"
)->fetchAll();

if (!$rows) {
    echo "Tidak ada booking pending kedaluwarsa.\n";
    exit(0);
}

$count = 0;
foreach ($rows as $b) {
    $pdo->beginTransaction();
    try {
        $upd = $pdo->prepare(
            "UPDATE bookings SET status = 'expired', version = version + 1, updated_at = NOW()
             WHERE id = ? AND status = 'pending'"
        );
        $upd->execute([(int) $b['id']]);
        if ($upd->rowCount() > 0) {
            // Satu strategi counter (issue #11): recount dari source of truth
            // (bookings), bukan decrement manual booked-1.
            slot_recount($pdo, (string) $b['slot_date'], (string) $b['slot_time']);

            audit_log(0, 'system', 'booking_status', (int) $b['id'], 'pending', 'expired',
                'Otomatis kedaluwarsa: slot sudah lewat tanpa konfirmasi (cron)');
            $count++;
        }
        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        fwrite(STDERR, "Gagal expire booking {$b['code']}: {$e->getMessage()}\n");
    }
}

echo "Expired {$count} booking pending.\n";
