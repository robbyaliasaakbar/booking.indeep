<?php
/**
 * POST /api/bookings-create.php — buat booking (PRD Bab 16.2, 11).
 *
 * Body JSON:
 *   addressId: int (alamat tersimpan milik sendiri)
 *   ATAU address: { label?, streetNo, village, district, city, province, postal?, note?, mapsUrl? }
 *   items:      [{ skuId, qty }, ...]
 *   surcharges: [{ code, qtyAffected }, ...]  (opsional)
 *   date: "YYYY-MM-DD", time: "09.00" | "13.00"
 *   idempotencyKey: string 8..64 (anti double klik)
 *
 * Jaminan (Bab 11): transaksi InnoDB + SELECT ... FOR UPDATE pada baris slot,
 * booked atomik, harga dihitung ulang dari DB, idempotency unik.
 */

require __DIR__ . '/../../app/lib/bootstrap.php';
require __DIR__ . '/../../app/lib/session.php';
require __DIR__ . '/../../app/lib/quote.php';
require __DIR__ . '/../../app/lib/audit.php';
require __DIR__ . '/../../app/lib/slots.php';
require __DIR__ . '/../../app/lib/address.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_error(405, 'method_not_allowed', 'Metode ini tidak didukung.');
}

$user = require_login();

// Session di endpoint ini read-only (tidak ada login/logout di sini).
// Lepas lock file session sekarang juga supaya request paralel customer lain
// tidak saling menunggu — krusial buat balapan slot (PRD Bab 11).
session_write_close();

// Customer role saja — admin mengelola lewat modul Tahap 4.
if ($user['role'] !== 'customer') {
    json_error(403, 'forbidden', 'Form booking ini khusus pelanggan ya.');
}

$raw  = file_get_contents('php://input');
$body = json_decode($raw ?: '', true);
if (!is_array($body)) {
    json_error(400, 'bad_request', 'Data yang dikirim belum benar.');
}

$pdo = db();
$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

// ============================================================
// 1. Idempotency — kalau key sudah pernah dipakai, tampilkan booking lama (Bab 17: 409)
// ============================================================
$idemKey = trim((string) ($body['idempotencyKey'] ?? ''));
if (strlen($idemKey) < 8 || strlen($idemKey) > 64) {
    json_error(400, 'idempotency_invalid', 'Kunci pemesanan tidak sah. Muat ulang halaman ya.');
}

$stmt = $pdo->prepare('SELECT id, code, status FROM bookings WHERE idempotency_key = ?');
$stmt->execute([$idemKey]);
$existing = $stmt->fetch();
if ($existing) {
    json_error(409, 'double_submit', 'Pesanan yang sama sudah tercatat. Tampilkan yang lama ya.', [
        'id'   => (int) $existing['id'],
        'code' => $existing['code'],
        'status' => $existing['status'],
    ]);
}

// ============================================================
// 2. Validasi tanggal & jam (BR01, BR02, BR02a, maks H+30) — backend jangan percaya frontend
// ============================================================
$dateRaw = trim((string) ($body['date'] ?? ''));
$timeRaw = trim((string) ($body['time'] ?? ''));

// Selasa libur, tidak lewat, maks H+30 — aturan BERSAMA dengan reschedule
// admin lewat slot_assert_date_rules() (app/lib/slots.php, issue #17).
slot_assert_date_rules($dateRaw);

$today = new DateTimeImmutable('now'); // WIB — bootstrap
$todayStr = $today->format('Y-m-d');

if (!in_array($timeRaw, ['09.00', '13.00'], true)) {
    json_error(400, 'jam_tidak_tersedia', 'Jam cuci hanya tersedia 09.00 atau 13.00 ya.');
}

// Cutoff hari H: slot 09.00 lock 02.00, slot 13.00 lock 06.00 (BR02a)
$cutoff = new DateTimeImmutable($dateRaw . ' ' . substr($timeRaw, 0, 2) . ':' . substr($timeRaw, 3, 2) . ':00');
$cutoff = $cutoff->modify('-7 hours');
if ($dateRaw === $todayStr && $today >= $cutoff) {
    json_error(409, 'slot_unavailable', 'Slot hari itu sudah lewat batas pemesanan. Pilih tanggal atau jam lain ya.');
}

// ============================================================
// 3. Alamat: addressId ATAU alamat baru (FR C02 — 5 wajib)
// ============================================================
$addressId = isset($body['addressId']) ? (int) $body['addressId'] : null;
$newAddress = isset($body['address']) && is_array($body['address']) ? $body['address'] : null;

$addressRow = null;

if ($addressId !== null && $addressId > 0) {
    $stmt = $pdo->prepare(
        'SELECT id, label, street_no, village, district, city, province, postal, note, maps_url
         FROM addresses WHERE id = ? AND user_id = ?'
    );
    $stmt->execute([$addressId, (int) $user['id']]);
    $addressRow = $stmt->fetch();
    if (!$addressRow) {
        json_error(400, 'address_invalid', 'Alamat tidak ditemukan. Pilih atau isi ulang alamat ya.');
    }
} elseif ($newAddress !== null) {
    // Aturan seragam dengan profil (app/lib/address.php, issue #16) —
    // kontrak snake_case, camelCase (streetNo/mapsUrl) masih diterima
    // untuk bundle FE lama yang ke-cache.
    $data = address_validate($newAddress);

    // Alamat baru jadi default otomatis kalau user belum punya alamat default sama sekali.
    $hasDefault = $pdo->prepare('SELECT COUNT(*) AS c FROM addresses WHERE user_id = ? AND is_default = 1');
    $hasDefault->execute([(int) $user['id']]);
    $isDefault = (int) $hasDefault->fetch()['c'] === 0 ? 1 : 0;

    $ins = $pdo->prepare(
        'INSERT INTO addresses (user_id, label, street_no, village, district, city, province, postal, note, maps_url, is_default)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );
    $ins->execute([
        (int) $user['id'],
        $data['label'], $data['street_no'], $data['village'], $data['district'],
        $data['city'], $data['province'], $data['postal'], $data['note'],
        $data['maps_url'], $isDefault,
    ]);
    $newId = (int) $pdo->lastInsertId();

    $stmt = $pdo->prepare(
        'SELECT id, label, street_no, village, district, city, province, postal, note, maps_url
         FROM addresses WHERE id = ?'
    );
    $stmt->execute([$newId]);
    $addressRow = $stmt->fetch();
} else {
    json_error(400, 'address_invalid', 'Pilih alamat tersimpan atau isi alamat baru dulu ya.');
}

// Profil wajib lengkap sebelum booking (PRD Bab 10.1)
if ((int) $user['profile_complete'] !== 1) {
    // Bisa jadi alamat barusan baru bikin lengkap — cek ulang.
    recompute_profile_complete((int) $user['id']);
    $recheck = $pdo->prepare('SELECT profile_complete FROM users WHERE id = ?');
    $recheck->execute([(int) $user['id']]);
    if ((int) $recheck->fetch()['profile_complete'] !== 1) {
        json_error(403, 'profil_belum_lengkap', 'Lengkapi nama dan nomor WhatsApp dulu ya.');
    }
}

// ============================================================
// 4. Hitung ulang harga dari DB (BR07) + minimum order (BR06)
// ============================================================
$itemsInput      = $body['items'] ?? [];
$surchargeInput  = $body['surcharges'] ?? [];

if (!is_array($itemsInput) || $itemsInput === []) {
    json_error(400, 'items_empty', 'Pilih minimal satu barang dulu ya.');
}
if (!is_array($surchargeInput)) {
    $surchargeInput = [];
}

$calc = quote_calc($itemsInput, $surchargeInput);

$minOrder = (int) config('MIN_ORDER_IDR');
if ($calc['total'] < $minOrder) {
    json_error(422, 'minimum_order', sprintf(
        'Minimum order Rp%s. Tambah item dulu biar tim jalan worth it ya.',
        number_format($minOrder, 0, ',', '.')
    ));
}

// ============================================================
// 5. Transaksi InnoDB: kunci slot -> cek kapasitas -> booked atomik -> insert booking
// ============================================================
$capacityDefault = (int) config('SLOT_CAPACITY_DEFAULT');
$userId = (int) $user['id'];

$pdo->beginTransaction();

try {
    // Pastikan baris slot ada (idempoten, kapasitas dari config), lalu kunci
    // barisnya. INSERT IGNORE + SELECT … FOR UPDATE: yang kalah balapan melihat
    // booked terbaru → slot_penuh (PRD Bab 11).
    slot_ensure($pdo, $dateRaw, $timeRaw, $capacityDefault);

    $slotStmt = $pdo->prepare(
        'SELECT id, capacity, booked, is_locked FROM slots WHERE slot_date = ? AND slot_time = ? FOR UPDATE'
    );
    $slotStmt->execute([$dateRaw, $timeRaw]);
    $slot = $slotStmt->fetch();

    // Satu strategi counter (issue #11): booked = recount dari tabel bookings,
    // bukan aritmetika manual. Recount dulu supaya cek kapasitas pakai angka jujur.
    slot_recount($pdo, $dateRaw, $timeRaw);
    $slotStmt->execute([$dateRaw, $timeRaw]);
    $slot = $slotStmt->fetch();

    if ((int) $slot['is_locked'] === 1) {
        throw new RuntimeException('slot_locked');
    }
    if ((int) $slot['booked'] >= (int) $slot['capacity']) {
        throw new RuntimeException('slot_full');
    }

    // Kode booking: IDP-YYYYMMDD-NNNN (nomor urut per tanggal jadwal)
    $slotDateCompact = str_replace('-', '', $dateRaw);
    $code = null;
    $codeStmt = $pdo->prepare(
        'SELECT COUNT(*) AS c FROM bookings WHERE slot_date = ?'
    );
    $countStmt = $pdo->prepare(
        'INSERT INTO bookings (
            code, user_id,
            name_snapshot, phone_primary_snapshot, phone_secondary_snapshot,
            address_snapshot_label, address_snapshot_street_no, address_snapshot_village,
            address_snapshot_district, address_snapshot_city, address_snapshot_province,
            address_snapshot_postal, address_snapshot_note, address_snapshot_maps_url,
            subtotal, surcharge_total, total, slot_date, slot_time, status, version, idempotency_key
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, "pending", 1, ?)'
    );

    for ($attempt = 0; $attempt < 5; $attempt++) {
        $codeStmt->execute([$dateRaw]);
        $seq = (int) $codeStmt->fetch()['c'] + 1;
        $code = sprintf('IDP-%s-%04d', $slotDateCompact, $seq);

        try {
            $countStmt->execute([
                $code, $userId,
                $user['name'], $user['phone_primary'], $user['phone_secondary'],
                $addressRow['label'], $addressRow['street_no'], $addressRow['village'],
                $addressRow['district'], $addressRow['city'], $addressRow['province'],
                $addressRow['postal'], $addressRow['note'], $addressRow['maps_url'],
                $calc['subtotal'], $calc['surchargeTotal'], $calc['total'],
                $dateRaw, $timeRaw,
                $idemKey,
            ]);
            break;
        } catch (PDOException $e) {
            // Kode bentrok (dua booking slot beda di hari sama) — coba nomor berikutnya.
            if ($attempt === 4 || (int) ($e->errorInfo[1] ?? 0) !== 1062) {
                throw $e;
            }
        }
    }

    $bookingId = (int) $pdo->lastInsertId();

    // Recount setelah booking masuk — source of truth counter (issue #11)
    slot_recount($pdo, $dateRaw, $timeRaw);

    // Items + surcharges (snapshot harga untuk riwayat jujur)
    $insItem = $pdo->prepare(
        'INSERT INTO booking_items (booking_id, sku_id, name_snapshot, size_snapshot, price_snapshot, qty, unit, line_total)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    );
    foreach ($calc['items'] as $it) {
        $insItem->execute([
            $bookingId, $it['skuId'], $it['name'], $it['size'], $it['price'],
            $it['qty'], $it['unit'], $it['lineTotal'],
        ]);
    }

    $insSur = $pdo->prepare(
        'INSERT INTO booking_surcharges (booking_id, code, title_snapshot, amount_snapshot, qty_affected, line_total)
         VALUES (?, ?, ?, ?, ?, ?)'
    );
    foreach ($calc['surcharges'] as $s) {
        $insSur->execute([
            $bookingId, $s['code'], $s['title'], $s['amount'], $s['qtyAffected'], $s['lineTotal'],
        ]);
    }

    audit_log($userId, 'customer', 'booking_create', $bookingId, null, 'pending', null);

    $pdo->commit();
} catch (RuntimeException $e) {
    $pdo->rollBack();
    if ($e->getMessage() === 'slot_full') {
        json_error(409, 'slot_penuh', 'Slot baru saja terisi, pilih tanggal atau jam lain ya.');
    }
    if ($e->getMessage() === 'slot_locked') {
        json_error(409, 'slot_unavailable', 'Slot itu sudah dikunci. Pilih tanggal atau jam lain ya.');
    }
    throw $e;
} catch (Throwable $e) {
    $pdo->rollBack();

    // Balapan idempotency: dua request key sama menang di unique constraint
    if ((int) ($e->errorInfo[1] ?? 0) === 1062 && str_contains($e->getMessage(), 'uq_bookings_idempotency')) {
        $again = $pdo->prepare('SELECT id, code, status FROM bookings WHERE idempotency_key = ?');
        $again->execute([$idemKey]);
        $row = $again->fetch();
        if ($row) {
            json_error(409, 'double_submit', 'Pesanan yang sama sudah tercatat. Tampilkan yang lama ya.', [
                'id'     => (int) $row['id'],
                'code'   => $row['code'],
                'status' => $row['status'],
            ]);
        }
    }
    throw $e;
}

// ============================================================
// 6. Balas sukses 201 + data lengkap buat halaman sukses & struk
// ============================================================
$stmt = $pdo->prepare('SELECT * FROM bookings WHERE id = ?');
$stmt->execute([$bookingId]);
$booking = $stmt->fetch();

$stmt = $pdo->prepare(
    'SELECT sku_id, name_snapshot, size_snapshot, price_snapshot, qty, unit, line_total
     FROM booking_items WHERE booking_id = ? ORDER BY id ASC'
);
$stmt->execute([$bookingId]);
$items = $stmt->fetchAll();

$stmt = $pdo->prepare(
    'SELECT code, title_snapshot, amount_snapshot, qty_affected, line_total
     FROM booking_surcharges WHERE booking_id = ? ORDER BY id ASC'
);
$stmt->execute([$bookingId]);
$surcharges = $stmt->fetchAll();

json_response([
    'data' => [
        'id'     => (int) $booking['id'],
        'code'   => $booking['code'],
        'status' => $booking['status'],
        'slot_date' => $booking['slot_date'],
        'slot_time' => $booking['slot_time'],
        'subtotal' => (int) $booking['subtotal'],
        'surchargeTotal' => (int) $booking['surcharge_total'],
        'total'   => (int) $booking['total'],
        'name'    => $booking['name_snapshot'],
        'phone_primary' => $booking['phone_primary_snapshot'],
        'phone_secondary' => $booking['phone_secondary_snapshot'],
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
        'created_at' => $booking['created_at'],
    ],
], 201);
