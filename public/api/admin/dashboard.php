<?php
/**
 * GET /api/admin/dashboard.php — ringkasan dashboard admin (PRD Bab 16.3, 12.1).
 * Booking hari ini, jumlah pending, slot penuh, omzet estimasi hari ini + bulan
 * ini, plus panel PRD 12.1: "booking besok" & "slot penuh minggu ini".
 *
 * Omzet memakai definisi TUNGGAL dari app/lib/omzet.php (issue #9) — sama
 * dengan reports.php.
 */

require __DIR__ . '/../../../app/lib/bootstrap.php';
require __DIR__ . '/../../../app/lib/session.php';
require __DIR__ . '/../../../app/lib/omzet.php';

require_role('admin', 'superadmin');

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    json_error(405, 'method_not_allowed', 'Metode ini tidak didukung.');
}

$pdo = db();
$today = date('Y-m-d');

// Booking hari ini (status aktif, bukan batal/tolak/kedaluwarsa)
$st = $pdo->prepare(
    "SELECT COUNT(*) FROM bookings
     WHERE slot_date = ? AND status NOT IN ('cancelled','rejected','expired')"
);
$st->execute([$today]);
$todayBookings = (int) $st->fetchColumn();

// Booking BESOK (PRD 12.1) — aktif, bukan batal/tolak/kedaluwarsa
$besok = (new DateTimeImmutable($today))->modify('+1 day')->format('Y-m-d');
$st = $pdo->prepare(
    "SELECT COUNT(*) FROM bookings
     WHERE slot_date = ? AND status NOT IN ('cancelled','rejected','expired')"
);
$st->execute([$besok]);
$besokBookings = (int) $st->fetchColumn();

// Menunggu konfirmasi
$pending = (int) $pdo->query("SELECT COUNT(*) FROM bookings WHERE status = 'pending'")->fetchColumn();

// Slot penuh hari ini
$st = $pdo->prepare('SELECT COUNT(*) FROM slots WHERE slot_date = ? AND booked >= capacity');
$st->execute([$today]);
$slotsFull = (int) $st->fetchColumn();

// Slot penuh MINGGU INI (PRD 12.1) — Senin..Minggu berjalan
$weekStart = (new DateTimeImmutable('monday this week'))->format('Y-m-d');
$weekEnd = (new DateTimeImmutable('sunday this week'))->format('Y-m-d');
$st = $pdo->prepare('SELECT COUNT(*) FROM slots WHERE slot_date BETWEEN ? AND ? AND booked >= capacity');
$st->execute([$weekStart, $weekEnd]);
$slotsFullWeek = (int) $st->fetchColumn();

// Omzet estimasi hari ini (definisi tunggal — app/lib/omzet.php)
$omzetToday = omzet_sum_between($pdo, $today, $today);

// Omzet estimasi bulan ini (rentang biar index ramah)
$omzetMonth = omzet_sum_between($pdo, date('Y-m-01'), date('Y-m-t'));

json_response(['data' => [
    'today_bookings'   => $todayBookings,
    'tomorrow_bookings'=> $besokBookings,
    'pending_count'    => $pending,
    'slots_full_today' => $slotsFull,
    'slots_full_week'  => $slotsFullWeek,
    'omzet_today'      => $omzetToday,
    'omzet_month'      => $omzetMonth,
]]);
