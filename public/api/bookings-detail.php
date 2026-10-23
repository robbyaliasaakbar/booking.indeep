<?php
/**
 * GET /api/bookings-detail.php?id= — detail satu booking milik sendiri (PRD Bab 16.2).
 * Pakai juga buat halaman struk.
 */

require __DIR__ . '/../../app/lib/bootstrap.php';
require __DIR__ . '/../../app/lib/session.php';

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    json_error(405, 'method_not_allowed', 'Metode ini tidak didukung.');
}

$user = require_login();

$id = (int) ($_GET['id'] ?? 0);
if ($id <= 0) {
    json_error(400, 'bad_request', 'Nomor booking tidak dikenal ya.');
}

// Customer: hanya booking milik sendiri. Admin/superadmin: semua booking
// (dipakai klik baris di admin-bookings -> lihat struk, permintaan Bang Rob).
if (in_array($user['role'], ['admin', 'superadmin'], true)) {
    $stmt = db()->prepare('SELECT * FROM bookings WHERE id = ?');
    $stmt->execute([$id]);
} else {
    $stmt = db()->prepare('SELECT * FROM bookings WHERE id = ? AND user_id = ?');
    $stmt->execute([$id, (int) $user['id']]);
}
$booking = $stmt->fetch();

if (!$booking) {
    json_error(404, 'not_found', 'Booking tidak ditemukan ya.');
}

$stmt = db()->prepare(
    'SELECT sku_id, name_snapshot, size_snapshot, price_snapshot, qty, unit, line_total
     FROM booking_items WHERE booking_id = ? ORDER BY id ASC'
);
$stmt->execute([$id]);
$items = $stmt->fetchAll();

$stmt = db()->prepare(
    'SELECT code, title_snapshot, amount_snapshot, qty_affected, line_total
     FROM booking_surcharges WHERE booking_id = ? ORDER BY id ASC'
);
$stmt->execute([$id]);
$surcharges = $stmt->fetchAll();

json_response([
    'data' => [
        'id'     => (int) $booking['id'],
        'code'   => $booking['code'],
        'status' => $booking['status'],
        'version' => (int) $booking['version'],
        'slot_date' => $booking['slot_date'],
        'slot_time' => $booking['slot_time'],
        'subtotal' => (int) $booking['subtotal'],
        'surchargeTotal' => (int) $booking['surcharge_total'],
        'total'   => (int) $booking['total'],
        'name'    => $booking['name_snapshot'],
        'phone_primary' => $booking['phone_primary_snapshot'],
        'phone_secondary' => $booking['phone_secondary_snapshot'],
        'cancel_reason' => $booking['cancel_reason'],
        'admin_note' => $booking['admin_note'],
        'created_at' => $booking['created_at'],
        'updated_at' => $booking['updated_at'],
        'address' => [
            'label'    => $booking['address_snapshot_label'],
            'street_no' => $booking['address_snapshot_street_no'],
            'village'  => $booking['address_snapshot_village'],
            'district' => $booking['address_snapshot_district'],
            'city'     => $booking['address_snapshot_city'],
            'province' => $booking['address_snapshot_province'],
            'postal'   => $booking['address_snapshot_postal'],
            'note'     => $booking['address_snapshot_note'],
            'maps_url' => $booking['address_snapshot_maps_url'],
        ],
        'items'      => $items,
        'surcharges' => $surcharges,
    ],
]);
