<?php
/**
 * GET /api/pricelist.php?search=&category=
 * Daftar SKU aktif dari database pricelist resmi (PRD Bab 16.1).
 * Harga selalu dari DB — frontend hanya display (BR07).
 */

require __DIR__ . '/../../app/lib/bootstrap.php';
require __DIR__ . '/../../app/lib/ratelimit.php';

rate_limit('pub:pricelist', 120, 60); // 120 hitungan / menit / IP (PRD Bab 18)

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    json_error(405, 'method_not_allowed', 'Metode ini tidak didukung.');
}

$search   = trim((string) ($_GET['search'] ?? ''));
$category = trim((string) ($_GET['category'] ?? ''));

$sql    = 'SELECT sku_id, service, name, size, price, unit, category
           FROM pricelist
           WHERE is_active = 1';
$params = [];

if ($search !== '') {
    $sql .= ' AND (name LIKE ? OR size LIKE ? OR service LIKE ?)';
    $like = '%' . $search . '%';
    array_push($params, $like, $like, $like);
}

if ($category !== '') {
    $sql .= ' AND category = ?';
    $params[] = $category;
}

$sql .= ' ORDER BY sku_id ASC';

$stmt = db()->prepare($sql);
$stmt->execute($params);

json_response(['data' => $stmt->fetchAll()]);
