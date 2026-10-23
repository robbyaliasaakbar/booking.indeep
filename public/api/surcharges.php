<?php
/**
 * GET /api/surcharges.php — 3 aturan biaya tambahan aktif (PRD Bab 7 dan 16.1).
 * Publik, tanpa login. Dipakai wizard dan landing.
 */

require __DIR__ . '/../../app/lib/bootstrap.php';
require __DIR__ . '/../../app/lib/ratelimit.php';

rate_limit('pub:surcharges', 120, 60); // 120 hitungan / menit / IP (PRD Bab 18)

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    json_error(405, 'method_not_allowed', 'Metode ini tidak didukung.');
}

$stmt = db()->query(
    "SELECT code, title, note, amount, per
     FROM surcharges
     WHERE is_active = 1
     ORDER BY id ASC"
);

json_response(['data' => $stmt->fetchAll()]);
