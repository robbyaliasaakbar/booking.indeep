<?php
/**
 * GET   /api/admin/pricelist.php — semua SKU termasuk nonaktif (PRD Bab 16.3).
 * POST  /api/admin/pricelist.php — tambah SKU baru (superadmin dashboard, Batch 1).
 * PATCH /api/admin/pricelist.php — edit harga/nama/ukuran/satuan/kategori + toggle nonaktif (D1).
 * Tidak ada hard-delete (PRD Bab 8: hapus permanen dilarang).
 *
 * POST body:  { name, size, price, unit, category, service? }
 * PATCH body: { id | sku_id, price?, is_active?, name?, size?, unit?, category?, service? }
 */

require __DIR__ . '/../../../app/lib/bootstrap.php';
require __DIR__ . '/../../../app/lib/session.php';
require __DIR__ . '/../../../app/lib/audit.php';

$user = require_role('admin', 'superadmin');
$pdo = db();

// enum kolom `unit` di DB (PRD Bab 8) — validasi di server, bukan cuma di form
const PRICELIST_UNITS = ['pcs', 'm2', 'anak tangga'];

// ============================ POST: tambah SKU baru ============================
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $raw  = file_get_contents('php://input');
    $body = json_decode($raw ?: '', true);
    if (!is_array($body)) {
        json_error(400, 'bad_request', 'Data yang dikirim belum benar.');
    }

    $name     = trim((string) ($body['name'] ?? ''));
    $size     = trim((string) ($body['size'] ?? ''));
    $category = trim((string) ($body['category'] ?? ''));
    $unit     = trim((string) ($body['unit'] ?? ''));
    $service  = trim((string) ($body['service'] ?? 'wet clean'));

    if ($name === '' || $size === '' || $category === '') {
        json_error(400, 'missing_fields', 'Nama, ukuran, dan kategori wajib diisi ya.');
    }
    if (mb_strlen($name) > 100 || mb_strlen($size) > 50 || mb_strlen($category) > 50 || mb_strlen($service) > 50) {
        json_error(400, 'field_too_long', 'Ada kolom yang kepanjangan ya. Maks: nama 100, lainnya 50 karakter.');
    }
    if ($service === '') {
        $service = 'wet clean';
    }
    if (!in_array($unit, PRICELIST_UNITS, true)) {
        json_error(400, 'unit_invalid', 'Satuan harus salah satu dari: pcs, m2, anak tangga.');
    }
    $price = (int) ($body['price'] ?? -1);
    if ($price < 0) {
        json_error(400, 'price_invalid', 'Harga wajib diisi dan tidak boleh negatif ya.');
    }

    // sku_id unik manual (bukan auto_increment) — lanjut dari yang terbesar
    $skuId = (int) $pdo->query('SELECT COALESCE(MAX(sku_id), 0) + 1 FROM pricelist')->fetchColumn();

    $pdo->prepare(
        'INSERT INTO pricelist (sku_id, service, name, size, price, unit, category, is_active, version)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1, 1)'
    )->execute([$skuId, $service, $name, $size, $price, $unit, $category]);

    audit_log((int) $user['id'], $user['role'], 'pricelist_create', null, null, null,
        "SKU baru {$skuId} {$name} ({$size}) {$price}/{$unit} kategori {$category}");

    $fresh = $pdo->query(
        'SELECT id, sku_id, service, name, size, price, unit, category, is_active, version
         FROM pricelist WHERE sku_id = ' . $skuId
    )->fetch();
    $fresh['id'] = (int) $fresh['id'];
    $fresh['sku_id'] = (int) $fresh['sku_id'];
    $fresh['price'] = (int) $fresh['price'];
    $fresh['is_active'] = (bool) $fresh['is_active'];
    $fresh['version'] = (int) $fresh['version'];
    json_response(['data' => $fresh], 201);
}

// ============================ PATCH: edit harga / toggle ============================
if ($_SERVER['REQUEST_METHOD'] === 'PATCH') {
    $raw  = file_get_contents('php://input');
    $body = json_decode($raw ?: '', true);
    if (!is_array($body)) {
        json_error(400, 'bad_request', 'Data yang dikirim belum benar.');
    }

    $id = (int) ($body['id'] ?? 0);
    $skuId = (int) ($body['sku_id'] ?? 0);

    $row = $pdo->prepare('SELECT id, sku_id, name, size, unit, category, service, price, is_active, version FROM pricelist WHERE ' . ($id > 0 ? 'id = ?' : 'sku_id = ?'));
    $row->execute([$id > 0 ? $id : $skuId]);
    $cur = $row->fetch();
    if (!$cur) {
        json_error(404, 'not_found', 'SKU tidak ditemukan ya.');
    }

    $sets = [];
    $params = [];
    $logParts = [];

    if (array_key_exists('price', $body) && $body['price'] !== null) {
        $price = (int) $body['price'];
        if ($price < 0) {
            json_error(400, 'price_invalid', 'Harga tidak boleh negatif ya.');
        }
        if ($price !== (int) $cur['price']) {
            $sets[] = 'price = ?';
            $params[] = $price;
            $logParts[] = "harga {$cur['price']}->$price";
        }
    }
    if (array_key_exists('is_active', $body) && $body['is_active'] !== null) {
        $act = $body['is_active'] ? 1 : 0;
        $sets[] = 'is_active = ?';
        $params[] = $act;
        $logParts[] = $act ? 'diaktifkan' : 'dinonaktifkan';
    }

    // Edit kolom teks (Batch 1): nama, ukuran, satuan, kategori, service
    $textFields = [
        'name'     => ['col' => 'name',     'label' => 'nama',     'max' => 100],
        'size'     => ['col' => 'size',     'label' => 'ukuran',   'max' => 50],
        'category' => ['col' => 'category', 'label' => 'kategori', 'max' => 50],
        'service'  => ['col' => 'service',  'label' => 'service',  'max' => 50],
    ];
    foreach ($textFields as $key => $meta) {
        if (!array_key_exists($key, $body) || $body[$key] === null) {
            continue;
        }
        $val = trim((string) $body[$key]);
        if ($val === '') {
            json_error(400, 'missing_fields', 'Kolom ' . $meta['label'] . ' tidak boleh kosong ya.');
        }
        if (mb_strlen($val) > $meta['max']) {
            json_error(400, 'field_too_long', 'Kolom ' . $meta['label'] . ' maks ' . $meta['max'] . ' karakter ya.');
        }
        if ($val !== (string) $cur[$meta['col']]) {
            $sets[] = $meta['col'] . ' = ?';
            $params[] = $val;
            $logParts[] = $meta['label'] . " '{$cur[$meta['col']]}'->'{$val}'";
        }
    }
    if (array_key_exists('unit', $body) && $body['unit'] !== null) {
        $unit = trim((string) $body['unit']);
        if (!in_array($unit, PRICELIST_UNITS, true)) {
            json_error(400, 'unit_invalid', 'Satuan harus salah satu dari: pcs, m2, anak tangga.');
        }
        if ($unit !== $cur['unit']) {
            $sets[] = 'unit = ?';
            $params[] = $unit;
            $logParts[] = "satuan {$cur['unit']}->$unit";
        }
    }

    if ($sets === []) {
        json_error(400, 'bad_request', 'Tidak ada perubahan yang dikirim ya.');
    }

    $sets[] = 'version = version + 1';
    $params[] = (int) $cur['id'];
    $pdo->prepare('UPDATE pricelist SET ' . implode(', ', $sets) . ' WHERE id = ?')->execute($params);

    audit_log((int) $user['id'], $user['role'], 'pricelist_update', null, null, null,
        "SKU {$cur['sku_id']} {$cur['name']} {$cur['size']}: " . implode(', ', $logParts));

    $row->execute([$id > 0 ? $id : $skuId]);
    $fresh = $row->fetch();
    $fresh['id'] = (int) $fresh['id'];
    $fresh['sku_id'] = (int) $fresh['sku_id'];
    $fresh['price'] = (int) $fresh['price'];
    $fresh['is_active'] = (bool) $fresh['is_active'];
    $fresh['version'] = (int) $fresh['version'];
    json_response(['data' => $fresh]);
}

// ============================ GET: semua SKU ============================
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    json_error(405, 'method_not_allowed', 'Metode ini tidak didukung.');
}

$st = $pdo->query(
    'SELECT id, sku_id, service, name, size, price, unit, category, is_active, version
     FROM pricelist ORDER BY category ASC, name ASC, size ASC'
);
$rows = $st->fetchAll();
foreach ($rows as &$r) {
    $r['id'] = (int) $r['id'];
    $r['sku_id'] = (int) $r['sku_id'];
    $r['price'] = (int) $r['price'];
    $r['is_active'] = (bool) $r['is_active'];
    $r['version'] = (int) $r['version'];
}
unset($r);

json_response(['data' => ['count' => count($rows), 'data' => $rows]]);
