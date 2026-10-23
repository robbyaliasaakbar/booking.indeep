<?php
/**
 * GET /api/admin/reports.php?from=&to= — laporan omzet estimasi (PRD Bab 16.3).
 * HAK SUPERADMIN — admin biasa ditolak 403.
 *
 * Omzet memakai definisi TUNGGAL dari app/lib/omzet.php (issue #9):
 * confirmed + in_progress + completed — SAMA dengan dashboard.
 */

require __DIR__ . '/../../../app/lib/bootstrap.php';
require __DIR__ . '/../../../app/lib/session.php';
require __DIR__ . '/../../../app/lib/omzet.php';

require_role('superadmin');

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    json_error(405, 'method_not_allowed', 'Metode ini tidak didukung.');
}

$pdo = db();

$from = trim((string) ($_GET['from'] ?? ''));
$to   = trim((string) ($_GET['to'] ?? ''));

function report_date_or_fail(string $raw, string $fallback): string
{
    $raw = $raw !== '' ? $raw : $fallback;
    $d = DateTimeImmutable::createFromFormat('Y-m-d', $raw);
    $err = DateTimeImmutable::getLastErrors();
    if (!$d || ($err !== false && ($err['warning_count'] > 0 || $err['error_count'] > 0))) {
        json_error(400, 'bad_request', 'Format tanggal harus YYYY-MM-DD ya.');
    }
    return $d->format('Y-m-d');
}

$defaultFrom = (new DateTimeImmutable('today'))->modify('-29 days')->format('Y-m-d');
$defaultTo = (new DateTimeImmutable('today'))->format('Y-m-d');
$from = report_date_or_fail($from, $defaultFrom);
$to = report_date_or_fail($to, $defaultTo);
if ($to < $from) {
    json_error(400, 'bad_request', 'Tanggal akhir tidak boleh sebelum tanggal awal ya.');
}

// Rekap per status
$st = $pdo->prepare(
    'SELECT status, COUNT(*) AS cnt, COALESCE(SUM(total), 0) AS omzet
     FROM bookings WHERE slot_date BETWEEN ? AND ?
     GROUP BY status'
);
$st->execute([$from, $to]);
$byStatus = [];
$allCount = 0;
$allOmzet = 0;
$completedOmzet = 0;
foreach ($st->fetchAll() as $r) {
    $byStatus[] = [
        'status' => $r['status'],
        'count' => (int) $r['cnt'],
        'omzet' => (int) $r['omzet'],
    ];
    $allCount += (int) $r['cnt'];
    $allOmzet += (int) $r['omzet'];
    if ($r['status'] === 'completed') {
        $completedOmzet = (int) $r['omzet'];
    }
}

// Omzet estimasi (definisi TUNGGAL — app/lib/omzet.php): confirmed + in_progress
// + completed. Ini yang sejalan dengan dashboard (issue #9).
$omzetEstimasi = omzet_sum_between($pdo, $from, $to);

// Harian (definisi omzet tunggal — biar konsisten dengan kartu omzet)
[$ph, $statuses] = omzet_status_sql();
$st = $pdo->prepare(
    "SELECT slot_date, COUNT(*) AS cnt, COALESCE(SUM(total), 0) AS omzet
     FROM bookings WHERE slot_date BETWEEN ? AND ? AND status IN ($ph)
     GROUP BY slot_date ORDER BY slot_date ASC"
);
$st->execute(array_merge([$from, $to], $statuses));
$daily = [];
foreach ($st->fetchAll() as $r) {
    $daily[] = [
        'slot_date' => $r['slot_date'],
        'count' => (int) $r['cnt'],
        'omzet' => (int) $r['omzet'],
    ];
}

json_response(['data' => [
    'from' => $from,
    'to' => $to,
    'by_status' => $byStatus,
    'daily' => $daily,
    'total_count' => $allCount,
    'total_omzet_all_status' => $allOmzet,
    'omzet_estimasi' => $omzetEstimasi,
    'omzet_completed' => $completedOmzet,
    // status yang menghitung omzet — biar FE bisa memberi keterangan jujur
    'omzet_statuses' => omzet_statuses(),
]]);
