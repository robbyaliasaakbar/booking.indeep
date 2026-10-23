<?php
/**
 * POST /api/bookings-cancel.php — batal sendiri (PRD Bab 9.3, BR09, BR10).
 *
 * Body JSON: { id: int, reason: string }
 *
 * Syarat: booking milik sendiri, status pending atau confirmed,
 * dan masih sebelum hari jadwal (H-1 atau lebih awal).
 * Slot otomatis dibebaskan lewat recount counter dari tabel bookings,
 * semuanya dalam satu transaksi (issue #11).
 */

require __DIR__ . '/../../app/lib/bootstrap.php';
require __DIR__ . '/../../app/lib/session.php';
require __DIR__ . '/../../app/lib/audit.php';
require __DIR__ . '/../../app/lib/slots.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_error(405, 'method_not_allowed', 'Metode ini tidak didukung.');
}

$user = require_login();
session_write_close(); // read-only session, lepas lock (lihat catatan di bookings-create)

$body = read_json_body();

$id = (int) ($body['id'] ?? 0);
$reason = trim((string) ($body['reason'] ?? ''));

if ($id <= 0) {
    json_error(400, 'bad_request', 'Nomor booking tidak dikenal ya.');
}
if (mb_strlen($reason) < 3) {
    json_error(400, 'reason_invalid', 'Tulis alasan pembatalan dulu ya, minimal beberapa huruf.');
}
if (mb_strlen($reason) > 500) {
    json_error(400, 'reason_invalid', 'Alasannya kepanjangan, maksimal 500 karakter ya.');
}

$pdo = db();

// Ambil booking + kunci barisnya dalam transaksi
$pdo->beginTransaction();
try {
    $stmt = $pdo->prepare(
        'SELECT id, code, user_id, status, slot_date, slot_time, version
         FROM bookings WHERE id = ? FOR UPDATE'
    );
    $stmt->execute([$id]);
    $booking = $stmt->fetch();

    if (!$booking || (int) $booking['user_id'] !== (int) $user['id']) {
        $pdo->rollBack();
        json_error(404, 'not_found', 'Booking tidak ditemukan ya.');
    }

    // BR09: hanya pending atau confirmed
    if (!in_array($booking['status'], ['pending', 'confirmed'], true)) {
        $pdo->rollBack();
        json_error(400, 'status_tidak_bisa_batal', 'Booking itu sudah tidak bisa dibatalkan ya.');
    }

    // BR09: hanya sebelum hari jadwal (H-1 atau lebih awal)
    $today = (new DateTimeImmutable('now'))->format('Y-m-d');
    if ($today >= $booking['slot_date']) {
        $pdo->rollBack();
        json_error(400, 'terlambat_batal', 'Pembatalan hanya bisa dilakukan sebelum hari jadwal ya.');
    }

    // Update booking: cancelled + alasan + version naik
    $pdo->prepare(
        'UPDATE bookings SET status = "cancelled", cancel_reason = ?, version = version + 1 WHERE id = ?'
    )->execute([$reason, $id]);

    // Satu strategi counter (issue #11): recount dari source of truth (bookings),
    // bukan decrement manual yang bisa drift / underflow.
    slot_recount($pdo, (string) $booking['slot_date'], (string) $booking['slot_time']);

    audit_log(
        (int) $user['id'], (string) $user['role'], 'booking_cancel',
        (int) $id, $booking['status'], 'cancelled', $reason
    );

    $pdo->commit();
} catch (Throwable $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    throw $e;
}

$stmt = $pdo->prepare('SELECT id, code, status, slot_date, slot_time, total, cancel_reason, version FROM bookings WHERE id = ?');
$stmt->execute([$id]);
$fresh = $stmt->fetch();

json_response([
    'data' => [
        'id'       => (int) $fresh['id'],
        'code'     => $fresh['code'],
        'status'   => $fresh['status'],
        'slot_date' => $fresh['slot_date'],
        'slot_time' => $fresh['slot_time'],
        'total'    => (int) $fresh['total'],
        'cancel_reason' => $fresh['cancel_reason'],
        'version'  => (int) $fresh['version'],
    ],
]);
