<?php
/**
 * POST /api/quote.php — hitung estimasi tanpa login (PRD Bab 5.6, 5.7, 16.1).
 *
 * Body JSON:
 *   items:      [{ "skuId": 1, "qty": 2 }, ...]
 *   surcharges: [{ "code": "LATEX", "qtyAffected": 2 }, ...]  (opsional)
 *
 * Logika hitung dan validasi dipakai bareng dengan bookings-create
 * lewat app/lib/quote.php — harga SELALU dari DB (BR07).
 */

require __DIR__ . '/../../app/lib/bootstrap.php';
require __DIR__ . '/../../app/lib/quote.php';
require __DIR__ . '/../../app/lib/ratelimit.php';

rate_limit('pub:quote', 60, 60); // 60 hitungan / menit / IP (PRD Bab 18)

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_error(405, 'method_not_allowed', 'Metode ini tidak didukung.');
}

$body = read_json_body();

$items = $body['items'] ?? [];
if (!is_array($items) || $items === []) {
    json_error(400, 'items_empty', 'Pilih minimal satu barang dulu ya.');
}

$calc = quote_calc($items, is_array($body['surcharges'] ?? null) ? $body['surcharges'] : []);

$minOrder = (int) config('MIN_ORDER_IDR');

json_response([
    'data' => $calc + [
        'minOrder'       => $minOrder,
        'isBelowMinimum' => $calc['total'] < $minOrder,
        'gapToMinimum'   => max(0, $minOrder - $calc['total']),
    ],
]);
