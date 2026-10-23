<?php
/**
 * GET    /api/admin/slots.php?from=&to= — daftar slot hari ini s/d H+30 untuk kalender admin (PRD Bab 16.3).
 * PATCH  /api/admin/slots.php — kunci/buka slot + ubah kapasitas (D1).
 * POST   /api/admin/slots.php — tambah slot manual (superadmin, T7-B2).
 * DELETE /api/admin/slots.php?id= — hapus slot kosong (superadmin, T7-B2).
 *
 * PATCH  body: { id, is_locked?: bool, capacity?: int }
 * POST   body: { slot_date, slot_time, capacity? }
 * DELETE     : ?id= atau body { id } — hanya slot booked = 0.
 * Baris slot dipastikan ada lewat helper bersama (slot_ensure_range) supaya
 * kapasitas default konsisten dengan config, bukan hardcode 1 (issue #12).
 */

require __DIR__ . '/../../../app/lib/bootstrap.php';
require __DIR__ . '/../../../app/lib/session.php';
require __DIR__ . '/../../../app/lib/audit.php';
require __DIR__ . '/../../../app/lib/slots.php';

$user = require_role('admin', 'superadmin');
$pdo = db();

// ============================ POST: tambah slot manual ============================
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if ($user['role'] !== 'superadmin') {
        json_error(403, 'forbidden', 'Hanya superadmin yang bisa menambah slot manual ya.');
    }

    $raw  = file_get_contents('php://input');
    $body = json_decode($raw ?: '', true);
    if (!is_array($body)) {
        json_error(400, 'bad_request', 'Data yang dikirim belum benar.');
    }

    $date = trim((string) ($body['slot_date'] ?? ''));
    $time = trim((string) ($body['slot_time'] ?? ''));
    $cap  = (int) ($body['capacity'] ?? 1);

    $d = DateTimeImmutable::createFromFormat('Y-m-d', $date);
    $err = DateTimeImmutable::getLastErrors();
    if (!$d || ($err !== false && ($err['warning_count'] > 0 || $err['error_count'] > 0))) {
        json_error(400, 'bad_request', 'Format tanggal harus YYYY-MM-DD ya.');
    }
    if (!in_array($time, ['09.00', '13.00'], true)) {
        json_error(400, 'bad_request', 'Jam harus 09.00 atau 13.00 ya.');
    }
    if ((int) $d->format('N') === 2) {
        json_error(400, 'bad_request', 'Selasa libur mutlak — tidak bisa bikin slot di Selasa ya.');
    }
    if ($cap < 1 || $cap > 50) {
        json_error(400, 'capacity_invalid', 'Kapasitas 1-50 ya.');
    }

    $st = $pdo->prepare('SELECT id, capacity, booked FROM slots WHERE slot_date = ? AND slot_time = ?');
    $st->execute([$date, $time]);
    if ($existing = $st->fetch()) {
        json_error(409, 'slot_exists', "Slot {$date} {$time} sudah ada (id {$existing['id']}). Ubah kapasitasnya saja ya.");
    }

    $pdo->prepare('INSERT INTO slots (slot_date, slot_time, capacity, booked) VALUES (?, ?, ?, 0)')
        ->execute([$date, $time, $cap]);

    audit_log((int) $user['id'], $user['role'], 'slot_create', null, null, null,
        "Slot manual {$date} {$time} kapasitas {$cap} dibuat oleh superadmin");

    $id = (int) $pdo->lastInsertId();
    json_response(['data' => ['ok' => true, 'id' => $id, 'slot_date' => $date, 'slot_time' => $time, 'capacity' => $cap, 'booked' => 0, 'is_locked' => false]]);
}

// ============================ DELETE: hapus slot kosong ============================
if ($_SERVER['REQUEST_METHOD'] === 'DELETE') {
    if ($user['role'] !== 'superadmin') {
        json_error(403, 'forbidden', 'Hanya superadmin yang bisa menghapus slot ya.');
    }

    $id = (int) ($_GET['id'] ?? 0);
    if ($id <= 0) {
        $raw  = file_get_contents('php://input');
        $body = json_decode($raw ?: '', true);
        $id = is_array($body) ? (int) ($body['id'] ?? 0) : 0;
    }
    if ($id <= 0) {
        json_error(400, 'bad_request', 'Slot mana yang mau dihapus ya?');
    }

    // Kunci baris dulu (issue #11: dulu cek-lalu-DELETE tanpa lock → race bisa
    // menghapus slot yang barusan terisi). Recount biar cek "kosong" pakai
    // angka jujur dari tabel bookings.
    $pdo->beginTransaction();
    try {
        $row = $pdo->prepare('SELECT id, slot_date, slot_time, booked FROM slots WHERE id = ? FOR UPDATE');
        $row->execute([$id]);
        $cur = $row->fetch();
        if (!$cur) {
            $pdo->rollBack();
            json_error(404, 'not_found', 'Slot tidak ditemukan ya.');
        }

        slot_recount($pdo, (string) $cur['slot_date'], (string) $cur['slot_time']);
        $row->execute([$id]);
        $cur = $row->fetch();

        if ((int) $cur['booked'] > 0) {
            $pdo->rollBack();
            json_error(400, 'slot_not_empty', "Slot {$cur['slot_date']} {$cur['slot_time']} masih ada {$cur['booked']} booking. Pindahkan atau batalkan booking dulu ya.");
        }

        $pdo->prepare('DELETE FROM slots WHERE id = ?')->execute([$id]);

        audit_log((int) $user['id'], $user['role'], 'slot_delete', null, null, null,
            "Slot {$cur['slot_date']} {$cur['slot_time']} (kosong) dihapus oleh superadmin");
        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $e;
    }

    json_response(['data' => ['ok' => true, 'id' => $id]]);
}

// ============================ PATCH: kunci/buka/kapasitas ============================
if ($_SERVER['REQUEST_METHOD'] === 'PATCH') {
    $raw  = file_get_contents('php://input');
    $body = json_decode($raw ?: '', true);
    if (!is_array($body)) {
        json_error(400, 'bad_request', 'Data yang dikirim belum benar.');
    }

    $id = (int) ($body['id'] ?? 0);
    if ($id <= 0) {
        json_error(400, 'bad_request', 'Slot mana yang mau diubah ya?');
    }

    // Semua perubahan slot dalam transaksi + kunci baris (PRD 11.5, issue #11).
    $pdo->beginTransaction();
    try {
        $row = $pdo->prepare('SELECT id, slot_date, slot_time, capacity, booked, is_locked FROM slots WHERE id = ? FOR UPDATE');
        $row->execute([$id]);
        $cur = $row->fetch();
        if (!$cur) {
            $pdo->rollBack();
            json_error(404, 'not_found', 'Slot tidak ditemukan ya.');
        }

        // Recount dulu: validasi kapasitas >= booked pakai angka jujur
        slot_recount($pdo, (string) $cur['slot_date'], (string) $cur['slot_time']);
        $row->execute([$id]);
        $cur = $row->fetch();

        $sets = [];
        $params = [];
        $logParts = [];

        if (array_key_exists('is_locked', $body) && $body['is_locked'] !== null) {
            $lock = $body['is_locked'] ? 1 : 0;
            $sets[] = 'is_locked = ?';
            $params[] = $lock;
            $logParts[] = $lock ? 'dikunci' : 'dibuka';
        }
        if (array_key_exists('capacity', $body) && $body['capacity'] !== null) {
            $cap = (int) $body['capacity'];
            if ($cap < 1) {
                $pdo->rollBack();
                json_error(400, 'capacity_invalid', 'Kapasitas minimal 1 ya.');
            }
            if ($cap < (int) $cur['booked']) {
                $pdo->rollBack();
                json_error(400, 'capacity_invalid', "Kapasitas tidak boleh kurang dari jumlah yang sudah booked ({$cur['booked']}) ya.");
            }
            $sets[] = 'capacity = ?';
            $params[] = $cap;
            $logParts[] = "kapasitas {$cur['capacity']}->$cap";
        }

        if ($sets === []) {
            $pdo->rollBack();
            json_error(400, 'bad_request', 'Tidak ada perubahan yang dikirim ya.');
        }

        $params[] = $id;
        $pdo->prepare('UPDATE slots SET ' . implode(', ', $sets) . ' WHERE id = ?')->execute($params);

        audit_log((int) $user['id'], $user['role'], 'slot_update', null, null, null,
            "Slot {$cur['slot_date']} {$cur['slot_time']}: " . implode(', ', $logParts));

        $row->execute([$id]);
        $fresh = $row->fetch();
        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $e;
    }

    $fresh['id'] = (int) $fresh['id'];
    $fresh['capacity'] = (int) $fresh['capacity'];
    $fresh['booked'] = (int) $fresh['booked'];
    $fresh['is_locked'] = (bool) $fresh['is_locked'];
    json_response(['data' => $fresh]);
}

// ============================ GET: daftar slot ============================
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    json_error(405, 'method_not_allowed', 'Metode ini tidak didukung.');
}

const ADMIN_MAX_WINDOW_DAYS = 30;

function admin_date_or_fail(string $raw, string $fallback): string
{
    $raw = $raw !== '' ? $raw : $fallback;
    $d = DateTimeImmutable::createFromFormat('Y-m-d', $raw);
    $err = DateTimeImmutable::getLastErrors();
    if (!$d || ($err !== false && ($err['warning_count'] > 0 || $err['error_count'] > 0))) {
        json_error(400, 'bad_request', 'Format tanggal harus YYYY-MM-DD ya.');
    }
    return $d->format('Y-m-d');
}

$today = (new DateTimeImmutable('today'))->format('Y-m-d');
$from  = admin_date_or_fail(trim((string) ($_GET['from'] ?? '')), $today);
$toRaw = trim((string) ($_GET['to'] ?? ''));
$maxTo = (new DateTimeImmutable($today))->modify('+' . ADMIN_MAX_WINDOW_DAYS . ' days')->format('Y-m-d');
$to = admin_date_or_fail($toRaw, $maxTo);
if ($to > $maxTo) {
    $to = $maxTo;
}
if ($to < $from) {
    json_error(400, 'bad_request', 'Tanggal akhir tidak boleh sebelum tanggal awal ya.');
}

// Pastikan baris slot ada (kalender admin butuh id buat aksi kunci/kapasitas).
// Selasa libur mutlak. Kapasitas default dari config lewat helper (issue #12).
slot_ensure_range($pdo, $from, $to);

$st = $pdo->prepare(
    'SELECT id, slot_date, slot_time, capacity, booked, is_locked
     FROM slots WHERE slot_date BETWEEN ? AND ?
     ORDER BY slot_date ASC, slot_time ASC'
);
$st->execute([$from, $to]);
$rows = $st->fetchAll();
foreach ($rows as &$r) {
    $r['id'] = (int) $r['id'];
    $r['capacity'] = (int) $r['capacity'];
    $r['booked'] = (int) $r['booked'];
    $r['is_locked'] = (bool) $r['is_locked'];
}
unset($r);

json_response(['data' => ['from' => $from, 'to' => $to, 'count' => count($rows), 'data' => $rows]]);
