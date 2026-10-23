<?php
/**
 * GET /api/availability.php?from=&to= — ketersediaan slot hari ini s/d H+30 (PRD Bab 5.4, 5.5, 11, 16.1).
 *
 * - Selasa selalu libur mutlak (BR01), tanpa baris slot.
 * - GET ini READ-ONLY (issue #12): baris slot yang belum ada disintesis di
 *   memori dari kapasitas default, TIDAK menulis DB. Baris asli dibuat saat
 *   booking/admin terjadi (slot_ensure() di app/lib/slots.php).
 * - Status per slot:
 *   libur    -> Selasa atau dikunci admin (is_locked).
 *   penuh    -> booked >= capacity.
 *   terkunci -> hari H tapi sudah lewat cutoff 7 jam (BR02a, UX date picker).
 *   tersedia -> sisanya.
 * - Window default: hari ini sampai H+30 (inklusif) — SAMA dengan aturan
 *   create & reschedule (issue #10: dulu create izinkan H+30 tapi di sini
 *   cuma sampai H+29 → booking H+30 tak pernah tampil di kalender).
 */

require __DIR__ . '/../../app/lib/bootstrap.php';
require __DIR__ . '/../../app/lib/ratelimit.php';
require __DIR__ . '/../../app/lib/slots.php';

rate_limit('pub:availability', 120, 60); // 120 hitungan / menit / IP (PRD Bab 18)

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    json_error(405, 'method_not_allowed', 'Metode ini tidak didukung.');
}

const MAX_WINDOW_DAYS = 30;

/** Nama hari Bahasa Indonesia tanpa perlu ext-intl. 1=Senin .. 7=Minggu */
function day_name_id(int $isoDay): string
{
    static $names = [
        1 => 'Senin', 2 => 'Selasa', 3 => 'Rabu', 4 => 'Kamis',
        5 => 'Jumat', 6 => 'Sabtu', 7 => 'Minggu',
    ];
    return $names[$isoDay] ?? '';
}

function avail_date_or_fail(string $raw, string $fallback): string
{
    $raw = $raw !== '' ? $raw : $fallback;
    $d = DateTimeImmutable::createFromFormat('Y-m-d', $raw);
    $err = DateTimeImmutable::getLastErrors();
    if (!$d || ($err !== false && ($err['warning_count'] > 0 || $err['error_count'] > 0))) {
        json_error(400, 'bad_request', 'Format tanggal harus YYYY-MM-DD ya.');
    }
    return $d->format('Y-m-d');
}

$today = new DateTimeImmutable('now'); // container sudah Asia/Jakarta (WIB)

$from = avail_date_or_fail(trim((string) ($_GET['from'] ?? '')), $today->format('Y-m-d'));
$to   = avail_date_or_fail(trim((string) ($_GET['to'] ?? '')), (new DateTimeImmutable($today->format('Y-m-d') . ' +' . MAX_WINDOW_DAYS . ' days'))->format('Y-m-d'));

if ($to < $from) {
    json_error(400, 'bad_request', 'Tanggal selesai tidak boleh sebelum tanggal mulai ya.');
}

// Clamp maksimal H+30 — sama dengan create/reschedule (issue #10), kalender
// jangan liar (PRD 5.4).
$maxEnd = new DateTimeImmutable($today->format('Y-m-d') . ' +' . MAX_WINDOW_DAYS . ' days');
if ($to > $maxEnd->format('Y-m-d')) {
    $to = $maxEnd->format('Y-m-d');
}

$capacityDefault = (int) config('SLOT_CAPACITY_DEFAULT');
$times = slot_times(); // BR02 — satu sumber (app/lib/slots.php)

// GET publik tidak menulis DB (issue #12). Baris slot yang belum ada cukup
// disintesis di memori; baris asli dibuat saat booking/admin benar terjadi.
$pdo = db();
$curEnd = new DateTimeImmutable($to);

// --- Ambil baris slot yang ada ---
$stmt = $pdo->prepare(
    'SELECT slot_date, slot_time, capacity, booked, is_locked
     FROM slots
     WHERE slot_date BETWEEN ? AND ?
     ORDER BY slot_date ASC, slot_time ASC'
);
$stmt->execute([$from, $to]);
$rows = $stmt->fetchAll();

$byDate = [];
foreach ($rows as $r) {
    $byDate[$r['slot_date']][] = $r;
}

// --- Susun response per tanggal ---
$out = [];
$cur = new DateTimeImmutable($from);
while ($cur <= $curEnd) {
    $date = $cur->format('Y-m-d');
    $isTuesday = (int) $cur->format('N') === 2;
    $isToday = $date === $today->format('Y-m-d');

    if ($isTuesday) {
        $out[] = [
            'date'     => $date,
            'day_name' => 'Selasa',
            'status'   => 'libur',
            'slots'    => [],
            'note'     => 'Selasa kami libur ya.',
        ];
        $cur = $cur->modify('+1 day');
        continue;
    }

    // Baris DB yang ada untuk tanggal ini (kalau belum ada, disintesis)
    $rowsForDate = [];
    foreach ($byDate[$date] ?? [] as $r) {
        $rowsForDate[$r['slot_time']] = $r;
    }

    $slots = [];
    $dateStatus = 'tersedia';
    foreach ($times as $time) {
        $r = $rowsForDate[$time] ?? null;
        $capacity = $r ? (int) $r['capacity'] : $capacityDefault;
        $booked   = $r ? (int) $r['booked'] : 0;
        $locked   = $r ? ((int) $r['is_locked'] === 1) : false;

        $timeHour = substr($time, 0, 2);
        $timeMin = substr($time, 3, 2);

        if ($locked) {
            $status = 'libur';
        } elseif ($booked >= $capacity) {
            $status = 'penuh';
        } elseif ($isToday) {
            // BR02a: cutoff 7 jam sebelum jam cuci — lewat itu slot hari H terkunci.
            $cutoff = new DateTimeImmutable($date . ' ' . $timeHour . ':' . $timeMin . ':00');
            $cutoff = $cutoff->modify('-7 hours');
            $status = ($today >= $cutoff) ? 'terkunci' : 'tersedia';
        } else {
            $status = 'tersedia';
        }

        if ($status === 'penuh' || $status === 'libur') {
            $dateStatus = 'penuh';
        }

        $slots[] = [
            'time'     => $time,
            'status'   => $status,
            'booked'   => $booked,
            'capacity' => $capacity,
        ];
    }

    $out[] = [
        'date'     => $date,
        'day_name' => day_name_id((int) $cur->format('N')),
        'status'   => $dateStatus,
        'slots'    => $slots,
        'note'     => null,
    ];
    $cur = $cur->modify('+1 day');
}

json_response([
    'data' => [
        'from'      => $from,
        'to'        => $to,
        'cutoff_hours' => 7,
        'days'      => $out,
    ],
]);
