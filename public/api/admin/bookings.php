<?php
/**
 * GET    /api/admin/bookings.php — daftar semua booking + filter/pagination (PRD Bab 16.3).
 * PATCH  /api/admin/bookings.php — ubah status (admin) + pindah slot (superadmin, T7-B2).
 * DELETE /api/admin/bookings.php — hard delete booking (superadmin only, T7-B2).
 *
 * PATCH body (status):  { id, status, reason?, version }
 * PATCH body (slot)  :  { id, slot_date, slot_time, reason? } — pending/confirmed saja.
 * DELETE             :  ?id= atau body { id } — items+surcharges ikut, slot dibuka lagi.
 *
 * Transisi sah (PRD Bab 11):
 *   pending -> confirmed | rejected | cancelled
 *   confirmed -> in_progress | cancelled
 *   in_progress -> completed
 *   terminal (completed/cancelled/rejected/expired) -> tidak bisa diubah.
 */

require __DIR__ . '/../../../app/lib/bootstrap.php';
require __DIR__ . '/../../../app/lib/session.php';
require __DIR__ . '/../../../app/lib/audit.php';
require __DIR__ . '/../../../app/lib/slots.php';

$user = require_role('admin', 'superadmin');
$pdo = db();

$TRANSITIONS = [
    'pending'     => ['confirmed', 'rejected', 'cancelled'],
    'confirmed'   => ['in_progress', 'cancelled'],
    'in_progress' => ['completed'],
    'completed'   => [],
    'cancelled'   => [],
    'rejected'    => [],
    'expired'     => [],
];

// ============================ DELETE: hard delete booking ============================
if ($_SERVER['REQUEST_METHOD'] === 'DELETE') {
    if ($user['role'] !== 'superadmin') {
        json_error(403, 'forbidden', 'Hanya superadmin yang bisa menghapus booking ya.');
    }

    $id = (int) ($_GET['id'] ?? 0);
    if ($id <= 0) {
        $raw  = file_get_contents('php://input');
        $body = json_decode($raw ?: '', true);
        $id = is_array($body) ? (int) ($body['id'] ?? 0) : 0;
    }
    if ($id <= 0) {
        json_error(400, 'bad_request', 'Booking mana yang mau dihapus ya?');
    }

    $row = $pdo->prepare('SELECT id, code, status, slot_date, slot_time FROM bookings WHERE id = ?');
    $row->execute([$id]);
    $cur = $row->fetch();
    if (!$cur) {
        json_error(404, 'not_found', 'Booking tidak ditemukan ya.');
    }

    $pdo->beginTransaction();
    try {
        // Recount slot dari source of truth (tabel bookings) — booking completed
        // ikut terhapus tapi sebelumnya tidak melepas count (bugfix ghost count)
        $pdo->prepare('DELETE FROM booking_items WHERE booking_id = ?')->execute([$id]);
        $pdo->prepare('DELETE FROM booking_surcharges WHERE booking_id = ?')->execute([$id]);
        $pdo->prepare('DELETE FROM bookings WHERE id = ?')->execute([$id]);
        slot_recount($pdo, (string) $cur['slot_date'], (string) $cur['slot_time']);
        $pdo->commit();
    } catch (Throwable $e) {
        $pdo->rollBack();
        error_log('[admin/bookings delete] ' . $e->getMessage() . ' @ ' . $e->getFile() . ':' . $e->getLine());
        json_error(500, 'delete_failed', 'Gagal menghapus booking. Coba lagi ya.');
    }

    audit_log((int) $user['id'], $user['role'], 'booking_delete', $id, $cur['status'], null,
        "Booking {$cur['code']} (status {$cur['status']}) dihapus permanen oleh superadmin");

    json_response(['data' => ['ok' => true, 'id' => $id]]);
}

// ============================ PATCH: ubah status / pindah slot ============================
if ($_SERVER['REQUEST_METHOD'] === 'PATCH') {
    $raw  = file_get_contents('php://input');
    $body = json_decode($raw ?: '', true);
    if (!is_array($body)) {
        json_error(400, 'bad_request', 'Data yang dikirim belum benar.');
    }

    $id = (int) ($body['id'] ?? 0);
    $status = (string) ($body['status'] ?? '');
    $reason = trim((string) ($body['reason'] ?? ''));
    $expectedVersion = (int) ($body['version'] ?? 0);

    if ($id <= 0) {
        json_error(400, 'bad_request', 'Id booking tidak valid ya.');
    }

    // --- Mode pindah slot (superadmin, T7-B2): body punya slot_date+slot_time, tanpa status ---
    $newDate = trim((string) ($body['slot_date'] ?? ''));
    $newTime = trim((string) ($body['slot_time'] ?? ''));
    if ($newDate !== '' || $newTime !== '') {
        if ($user['role'] !== 'superadmin') {
            json_error(403, 'forbidden', 'Hanya superadmin yang bisa memindah jadwal booking ya.');
        }
        if ($newDate === '' || !in_array($newTime, ['09.00', '13.00'], true)) {
            json_error(400, 'bad_request', 'Tanggal (YYYY-MM-DD) dan jam (09.00/13.00) wajib diisi ya.');
        }
        // Aturan jadwal BERSAMA dengan create customer: Selasa libur, tidak
        // lewat, maks H+30 (issue #17) — superadmin ikut aturan yang sama.
        slot_assert_date_rules($newDate);

        $row = $pdo->prepare('SELECT id, code, status, slot_date, slot_time, version FROM bookings WHERE id = ?');
        $row->execute([$id]);
        $cur = $row->fetch();
        if (!$cur) {
            json_error(404, 'not_found', 'Booking tidak ditemukan ya.');
        }
        if (!in_array($cur['status'], ['pending', 'confirmed'], true)) {
            json_error(400, 'invalid_status', 'Hanya booking pending/confirmed yang bisa dipindah jadwal ya.');
        }
        if ($newDate === $cur['slot_date'] && $newTime === $cur['slot_time']) {
            json_error(400, 'bad_request', 'Jadwal baru sama dengan jadwal lama ya.');
        }

        $oldDate = (string) $cur['slot_date'];
        $oldTime = (string) $cur['slot_time'];

        $pdo->beginTransaction();
        try {
            // Kunci dua baris slot (lama & baru) dalam urutan tetap (tanggal, jam
            // naik) supaya dua pemindahan bersamaan tidak saling deadlock.
            $locks = [['d' => $oldDate, 't' => $oldTime], ['d' => $newDate, 't' => $newTime]];
            usort($locks, static fn(array $a, array $b): int => [$a['d'], $a['t']] <=> [$b['d'], $b['t']]);
            foreach ($locks as $L) {
                slot_ensure($pdo, $L['d'], $L['t']);
                $pdo->prepare('SELECT id FROM slots WHERE slot_date = ? AND slot_time = ? FOR UPDATE')
                    ->execute([$L['d'], $L['t']]);
            }

            // Satu strategi counter (issue #11): recount dari bookings sebelum
            // cek kapasitas, biar tidak bergantung sisa counter yang bisa drift.
            slot_recount($pdo, $oldDate, $oldTime);
            slot_recount($pdo, $newDate, $newTime);

            $st = $pdo->prepare('SELECT id, capacity, booked, is_locked FROM slots WHERE slot_date = ? AND slot_time = ?');
            $st->execute([$newDate, $newTime]);
            $newSlot = $st->fetch();
            if (!$newSlot || (int) $newSlot['is_locked'] === 1 || (int) $newSlot['booked'] >= (int) $newSlot['capacity']) {
                $pdo->rollBack();
                json_error(409, 'slot_full', 'Slot tujuan sudah penuh atau dikunci ya. Pilih jadwal lain.');
            }

            $pdo->prepare(
                'UPDATE bookings SET slot_date = ?, slot_time = ?, version = version + 1, updated_at = NOW() WHERE id = ?'
            )->execute([$newDate, $newTime, $id]);

            // Recount lagi setelah booking pindah (tanpa aritmetika booked±1)
            slot_recount($pdo, $oldDate, $oldTime);
            slot_recount($pdo, $newDate, $newTime);
            $pdo->commit();
        } catch (Throwable $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            error_log('[admin/bookings move] ' . $e->getMessage() . ' @ ' . $e->getFile() . ':' . $e->getLine());
            json_error(500, 'move_failed', 'Gagal memindah jadwal. Coba lagi ya.');
        }

        audit_log((int) $user['id'], $user['role'], 'booking_move', $id, "{$cur['slot_date']} {$cur['slot_time']}", "{$newDate} {$newTime}",
            $reason !== '' ? $reason : "Pindah jadwal oleh superadmin ({$cur['code']})");

        json_response(['data' => ['ok' => true, 'id' => $id, 'slot_date' => $newDate, 'slot_time' => $newTime, 'version' => (int) $cur['version'] + 1]]);
    }

    // --- Mode ubah status (dari) ---
    if ($expectedVersion <= 0) {
        json_error(400, 'bad_request', 'Id atau versi booking tidak valid ya.');
    }

    $row = $pdo->prepare('SELECT id, status, version, slot_date, slot_time FROM bookings WHERE id = ?');
    $row->execute([$id]);
    $cur = $row->fetch();
    if (!$cur) {
        json_error(404, 'not_found', 'Booking tidak ditemukan ya.');
    }

    $from = $cur['status'];
    if (!in_array($status, $TRANSITIONS[$from] ?? [], true)) {
        json_error(400, 'invalid_transition', "Status tidak bisa diubah dari $from ke $status ya.");
    }
    if (in_array($status, ['cancelled', 'rejected'], true) && $reason === '') {
        json_error(400, 'reason_required', 'Alasan wajib diisi untuk membatalkan atau menolak booking ya.');
    }

    // Update booking + sinkron counter slot ATOMIK dalam satu transaksi
    // (issue #11: dulu dua write terpisah — crash di tengah = counter nyasar).
    $pdo->beginTransaction();
    try {
        // Optimistic lock: hanya update kalau versi masih sama (Bab 11 poin 7)
        $upd = $pdo->prepare(
            "UPDATE bookings
             SET status = ?, version = version + 1,
                 cancel_reason = COALESCE(?, cancel_reason), updated_at = NOW()
             WHERE id = ? AND version = ?"
        );
        $upd->execute([$status, $reason !== '' ? $reason : null, $id, $expectedVersion]);
        if ($upd->rowCount() === 0) {
            $pdo->rollBack();
            json_error(409, 'conflict', 'Booking baru saja diubah orang lain. Muat ulang dulu ya.');
        }

        // Cancel/reject membebaskan slot. Status yang tetap menghitung booked
        // (confirmed/in_progress/completed) tidak perlu recount. Recount dari
        // source of truth (bookings) — satu strategi (issue #11).
        if (in_array($status, ['cancelled', 'rejected'], true)) {
            slot_recount($pdo, (string) $cur['slot_date'], (string) $cur['slot_time']);
        }

        audit_log((int) $user['id'], $user['role'], 'booking_status', $id, $from, $status, $reason !== '' ? $reason : null);
        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $e;
    }

    json_response(['data' => ['ok' => true, 'id' => $id, 'status' => $status, 'version' => $expectedVersion + 1]]);
}

// ============================ GET: daftar booking ============================
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    json_error(405, 'method_not_allowed', 'Metode ini tidak didukung.');
}

$page  = max(1, (int) ($_GET['page'] ?? 1));
$limit = min(100, max(1, (int) ($_GET['limit'] ?? 20)));
$offset = ($page - 1) * $limit;

$fStatus   = trim((string) ($_GET['status'] ?? ''));
$dateFrom  = trim((string) ($_GET['date_from'] ?? ''));
$dateTo    = trim((string) ($_GET['date_to'] ?? ''));
$slotTime  = trim((string) ($_GET['slot_time'] ?? ''));
$search    = trim((string) ($_GET['search'] ?? ''));

$where = [];
$params = [];
if ($fStatus !== '' && array_key_exists($fStatus, $TRANSITIONS)) {
    $where[] = 'b.status = ?';
    $params[] = $fStatus;
}
if ($dateFrom !== '') {
    $where[] = 'b.slot_date >= ?';
    $params[] = $dateFrom;
}
if ($dateTo !== '') {
    $where[] = 'b.slot_date <= ?';
    $params[] = $dateTo;
}
if ($slotTime !== '' && in_array($slotTime, ['09.00', '13.00'], true)) {
    $where[] = 'b.slot_time = ?';
    $params[] = $slotTime;
}
if ($search !== '') {
    $where[] = '(b.code LIKE ? OR b.name_snapshot LIKE ? OR b.phone_primary_snapshot LIKE ?)';
    $like = '%' . $search . '%';
    $params[] = $like;
    $params[] = $like;
    $params[] = $like;
}
$whereSql = $where ? 'WHERE ' . implode(' AND ', $where) : '';

$cnt = $pdo->prepare("SELECT COUNT(*) FROM bookings b $whereSql");
$cnt->execute($params);
$total = (int) $cnt->fetchColumn();
$totalPages = max(1, (int) ceil($total / $limit));
if ($page > $totalPages) {
    $page = $totalPages;
    $offset = ($page - 1) * $limit;
}

$st = $pdo->prepare(
    "SELECT b.id, b.code, b.name_snapshot AS name, b.phone_primary_snapshot AS phone,
            b.slot_date, b.slot_time, b.status, b.total, b.version,
            b.address_snapshot_city AS city, b.created_at
     FROM bookings b
     $whereSql
     ORDER BY b.slot_date DESC, b.slot_time DESC, b.id DESC
     LIMIT $limit OFFSET $offset"
);
$st->execute($params);
$rows = $st->fetchAll();
foreach ($rows as &$r) {
    $r['id'] = (int) $r['id'];
    $r['total'] = (int) $r['total'];
    $r['version'] = (int) $r['version'];
}
unset($r);

// Rincian item + surcharge per booking di halaman ini — admin perlu lihat
// barang yang dicuci, bukan cuma nominal (permintaan Bang Rob pas E2E)
$bookingIds = array_map(static fn(array $r): int => (int) $r['id'], $rows);
$itemsBy = [];
$surchBy = [];
if ($bookingIds) {
    $ph = implode(',', array_fill(0, count($bookingIds), '?'));
    $it = $pdo->prepare(
        "SELECT booking_id, qty, line_total, name_snapshot, size_snapshot, unit
         FROM booking_items
         WHERE booking_id IN ($ph)
         ORDER BY id"
    );
    $it->execute($bookingIds);
    foreach ($it->fetchAll() as $i) {
        $itemsBy[(int) $i['booking_id']][] = [
            'name'  => (string) $i['name_snapshot'],
            'size'  => (string) $i['size_snapshot'],
            'qty'   => (float) $i['qty'],
            'unit'  => (string) $i['unit'],
            'total' => (int) $i['line_total'],
        ];
    }
    $su = $pdo->prepare(
        "SELECT booking_id, title_snapshot, qty_affected, line_total
         FROM booking_surcharges
         WHERE booking_id IN ($ph)
         ORDER BY id"
    );
    $su->execute($bookingIds);
    foreach ($su->fetchAll() as $s) {
        $surchBy[(int) $s['booking_id']][] = [
            'title' => (string) $s['title_snapshot'],
            'qty'   => (float) $s['qty_affected'],
            'total' => (int) $s['line_total'],
        ];
    }
}
foreach ($rows as &$r) {
    $r['items']      = $itemsBy[$r['id']] ?? [];
    $r['surcharges'] = $surchBy[$r['id']] ?? [];
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
