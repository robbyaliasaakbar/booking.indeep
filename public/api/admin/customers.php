<?php
/**
 * GET    /api/admin/customers.php?page=&limit=&search= — daftar customer + ringkasan (PRD Bab 16.3).
 * PATCH  /api/admin/customers.php — edit profil customer (superadmin only, T7-B2).
 * DELETE /api/admin/customers.php?id= — hard delete cascade (superadmin only, T7-B2).
 *
 * PATCH body : { id, name?, phone_primary?, phone_secondary?, preferred_time? }
 * DELETE     : ?id= atau body { id } — hapus booking (items+surcharges)+alamat+user, 1 transaksi.
 */

require __DIR__ . '/../../../app/lib/bootstrap.php';
require __DIR__ . '/../../../app/lib/session.php';
require __DIR__ . '/../../../app/lib/audit.php';
require __DIR__ . '/../../../app/lib/slots.php';

$pdo = db();

// ============================ PATCH: edit profil customer ============================
if ($_SERVER['REQUEST_METHOD'] === 'PATCH') {
    $me = require_role('superadmin'); // full CRUD khusus superadmin (T7-B1)

    $raw  = file_get_contents('php://input');
    $body = json_decode($raw ?: '', true);
    if (!is_array($body)) {
        json_error(400, 'bad_request', 'Data yang dikirim belum benar.');
    }

    $id = (int) ($body['id'] ?? 0);
    if ($id <= 0) {
        json_error(400, 'bad_request', 'Customer mana yang mau diedit ya?');
    }

    $row = $pdo->prepare("SELECT id, role, name, phone_primary, phone_secondary, preferred_time FROM users WHERE id = ?");
    $row->execute([$id]);
    $cur = $row->fetch();
    if (!$cur) {
        json_error(404, 'not_found', 'Customer tidak ditemukan ya.');
    }
    if ($cur['role'] !== 'customer') {
        json_error(400, 'not_customer', 'Hanya customer yang bisa diedit lewat halaman ini ya.');
    }

    $sets = [];
    $params = [];
    $logParts = [];

    if (array_key_exists('name', $body) && $body['name'] !== null) {
        $name = trim((string) $body['name']);
        if ($name === '' || mb_strlen($name) > 100) {
            json_error(400, 'name_invalid', 'Nama 1-100 karakter ya.');
        }
        if ($name !== $cur['name']) {
            $sets[] = 'name = ?';
            $params[] = $name;
            $logParts[] = "nama->{$name}";
        }
    }
    foreach (['phone_primary', 'phone_secondary'] as $col) {
        if (array_key_exists($col, $body) && $body[$col] !== null) {
            $val = trim((string) $body[$col]);
            if ($val !== '' && !preg_match('/^[0-9+\-\s]{5,30}$/', $val)) {
                json_error(400, 'phone_invalid', 'Format nomor HP belum benar ya.');
            }
            $valOrNull = $val === '' ? null : $val;
            if ($valOrNull !== $cur[$col]) {
                $sets[] = "$col = ?";
                $params[] = $valOrNull;
                $logParts[] = "$col->" . ($valOrNull ?? '(kosong)');
            }
        }
    }
    if (array_key_exists('preferred_time', $body) && $body['preferred_time'] !== null) {
        $pt = trim((string) $body['preferred_time']);
        if (!in_array($pt, ['09.00', '13.00'], true)) {
            json_error(400, 'preferred_time_invalid', 'Preferensi jam harus 09.00 atau 13.00 ya.');
        }
        if ($pt !== $cur['preferred_time']) {
            $sets[] = 'preferred_time = ?';
            $params[] = $pt;
            $logParts[] = "preferensi->{$pt}";
        }
    }

    if ($sets === []) {
        json_error(400, 'bad_request', 'Tidak ada perubahan yang dikirim ya.');
    }

    $params[] = $id;
    $pdo->prepare('UPDATE users SET ' . implode(', ', $sets) . ' WHERE id = ?')->execute($params);

    audit_log((int) $me['id'], $me['role'], 'customer_update', null, null, null,
        "Customer #{$id}: " . implode(', ', $logParts));

    $row->execute([$id]);
    $fresh = $row->fetch();
    $fresh['id'] = (int) $fresh['id'];
    json_response(['data' => $fresh]);
}

// ============================ DELETE: hard delete cascade ============================
if ($_SERVER['REQUEST_METHOD'] === 'DELETE') {
    $me = require_role('superadmin');

    $id = (int) ($_GET['id'] ?? 0);
    if ($id <= 0) {
        $raw  = file_get_contents('php://input');
        $body = json_decode($raw ?: '', true);
        $id = is_array($body) ? (int) ($body['id'] ?? 0) : 0;
    }
    if ($id <= 0) {
        json_error(400, 'bad_request', 'Customer mana yang mau dihapus ya?');
    }

    $row = $pdo->prepare("SELECT id, role, name, email FROM users WHERE id = ?");
    $row->execute([$id]);
    $target = $row->fetch();
    if (!$target) {
        json_error(404, 'not_found', 'Customer tidak ditemukan ya.');
    }
    if ($target['role'] !== 'customer') {
        json_error(400, 'not_customer', 'Akun tim tidak bisa dihapus lewat sini ya.');
    }

    $pdo->beginTransaction();
    try {
        $st = $pdo->prepare('SELECT COUNT(*) FROM bookings WHERE user_id = ?');
        $st->execute([$id]);
        $cntBookings = (int) $st->fetchColumn();

        $st = $pdo->prepare('SELECT COUNT(*) FROM addresses WHERE user_id = ?');
        $st->execute([$id]);
        $cntAddresses = (int) $st->fetchColumn();

        // Kumpulkan semua slot yang dipakai booking customer ini SEBELUM dihapus
        // (bookings simpan slot_date+slot_time, tanpa FK slot_id)
        $st2 = $pdo->prepare('SELECT slot_date, slot_time FROM bookings WHERE user_id = ?');
        $st2->execute([$id]);
        $slotPairs = $st2->fetchAll();

        $pdo->prepare('DELETE bi FROM booking_items bi JOIN bookings b ON b.id = bi.booking_id WHERE b.user_id = ?')->execute([$id]);
        $pdo->prepare('DELETE bs FROM booking_surcharges bs JOIN bookings b ON b.id = bs.booking_id WHERE b.user_id = ?')->execute([$id]);
        $pdo->prepare('DELETE FROM bookings WHERE user_id = ?')->execute([$id]);
        $pdo->prepare('DELETE FROM addresses WHERE user_id = ?')->execute([$id]);
        $pdo->prepare('DELETE FROM users WHERE id = ?')->execute([$id]);

        // Recount slot dari source of truth — semua booking customer sudah habis,
        // jadi count harus ikut habis (bugfix ghost count: dulu booking completed
        // terhapus tapi count-nya tidak dilepas, slot kebaca penuh selamanya)
        slot_recount_many($pdo, $slotPairs);

        $pdo->commit();
    } catch (Throwable $e) {
        $pdo->rollBack();
        error_log('[admin/customers delete] ' . $e->getMessage() . ' @ ' . $e->getFile() . ':' . $e->getLine());
        json_error(500, 'delete_failed', 'Gagal menghapus customer. Coba lagi ya.');
    }

    audit_log((int) $me['id'], $me['role'], 'customer_delete', null, null, null,
        "Customer #{$id} ({$target['email']}) dihapus permanen: {$cntBookings} booking, {$cntAddresses} alamat ikut terhapus");

    json_response(['data' => ['ok' => true, 'deleted_bookings' => $cntBookings, 'deleted_addresses' => $cntAddresses]]);
}

// ============================ GET: daftar customer ============================
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    json_error(405, 'method_not_allowed', 'Metode ini tidak didukung.');
}

require_role('admin', 'superadmin');

$page  = max(1, (int) ($_GET['page'] ?? 1));
$limit = min(100, max(1, (int) ($_GET['limit'] ?? 20)));
$offset = ($page - 1) * $limit;
$search = trim((string) ($_GET['search'] ?? ''));

$where = "u.role = 'customer'";
$params = [];
if ($search !== '') {
    $where .= ' AND (u.name LIKE ? OR u.email LIKE ? OR u.phone_primary LIKE ?)';
    $like = '%' . $search . '%';
    $params[] = $like;
    $params[] = $like;
    $params[] = $like;
}

$cnt = $pdo->prepare("SELECT COUNT(*) FROM users u WHERE $where");
$cnt->execute($params);
$total = (int) $cnt->fetchColumn();
$totalPages = max(1, (int) ceil($total / $limit));
if ($page > $totalPages) {
    $page = $totalPages;
    $offset = ($page - 1) * $limit;
}

// Halaman user dulu (LIMIT), lalu agregat-nya di-join lewat subquery beragregasi
// — hindari 3 korelasi subquery per baris (issue #4: N+1).
$st = $pdo->prepare(
    "SELECT page.id, page.name, page.email, page.phone_primary, page.profile_complete,
            COALESCE(bk.total_bookings, 0) AS total_bookings,
            ad.default_address,
            bk.last_booking
     FROM (
         SELECT u.id, u.name, u.email, u.phone_primary, u.profile_complete
         FROM users u
         WHERE $where
         ORDER BY u.id DESC
         LIMIT $limit OFFSET $offset
     ) AS page
     LEFT JOIN (
         SELECT user_id, COUNT(*) AS total_bookings, MAX(slot_date) AS last_booking
         FROM bookings GROUP BY user_id
     ) AS bk ON bk.user_id = page.id
     LEFT JOIN (
         SELECT user_id, MIN(label) AS default_address
         FROM addresses WHERE is_default = 1 GROUP BY user_id
     ) AS ad ON ad.user_id = page.id"
);
$st->execute($params);
$rows = $st->fetchAll();
foreach ($rows as &$r) {
    $r['id'] = (int) $r['id'];
    $r['total_bookings'] = (int) $r['total_bookings'];
    $r['profile_complete'] = (bool) $r['profile_complete'];
}
unset($r);

json_response(['data' => [
    'total' => $total,
    'page' => $page,
    'limit' => $limit,
    'totalPages' => $totalPages,
    'count' => count($rows),
    'data' => $rows,
]]);
