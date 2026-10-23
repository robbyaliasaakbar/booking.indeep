<?php
/**
 * GET /api/bookings-mine.php — daftar booking milik sendiri, terbaru dulu (PRD Bab 16.2).
 */

require __DIR__ . '/../../app/lib/bootstrap.php';
require __DIR__ . '/../../app/lib/session.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    json_error(405, 'method_not_allowed', 'Metode ini tidak didukung.');
}

$user = require_login();

$stmt = db()->prepare(
    'SELECT b.id, b.code, b.status, b.slot_date, b.slot_time, b.subtotal, b.surcharge_total, b.total,
            b.created_at,
            (SELECT COUNT(*) FROM booking_items bi WHERE bi.booking_id = b.id) AS item_count
     FROM bookings b
     WHERE b.user_id = ?
     ORDER BY b.created_at DESC'
);
$stmt->execute([(int) $user['id']]);
$rows = $stmt->fetchAll();

foreach ($rows as &$r) {
    $r['id'] = (int) $r['id'];
    $r['subtotal'] = (int) $r['subtotal'];
    $r['surcharge_total'] = (int) $r['surcharge_total'];
    $r['total'] = (int) $r['total'];
    $r['item_count'] = (int) $r['item_count'];
}
unset($r);

json_response(['data' => $rows]);
