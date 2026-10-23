<?php
/**
 * Definisi OMZET tunggal (issue #9).
 *
 * Sebelumnya dashboard & reports memakai definisi berbeda:
 *   dashboard = confirmed + in_progress + completed
 *   reports   = completed saja
 * → angka beda antar layar. Keputusan Bang Rob: SATU definisi, yaitu
 *   confirmed + in_progress + completed (uang sudah dijanjikan/dikerjakan,
 *   bukan sekadar pending; cancel/reject/expired tidak dihitung).
 *
 * Pending TIDAK dihitung: belum dikonfirmasi admin, bisa dibatalkan/expired.
 * Completed TETAP dihitung: jasa sudah selesai dikerjakan (piutang/omzet).
 *
 * Semua perhitungan omzet WAJIB memakai daftar status ini — jangan tulis
 * literal di endpoint (biar dashboard & reports tak bisa beda lagi).
 */

declare(strict_types=1);

/** Status booking yang dihitung sebagai omzet. */
function omzet_statuses(): array
{
    return ['confirmed', 'in_progress', 'completed'];
}

/**
 * Placeholder IN (?,?,?) + parameter status untuk klausa SQL.
 * Pakai: [$ph, $params] = omzet_status_sql(); "... status IN ($ph) ..."
 *
 * @return array{0: string, 1: array<int, string>}
 */
function omzet_status_sql(): array
{
    $statuses = omzet_statuses();
    $ph = implode(',', array_fill(0, count($statuses), '?'));
    return [$ph, $statuses];
}

/**
 * SUM(total) omzet untuk rentang slot_date [from, to] (inklusif), definisi tunggal.
 */
function omzet_sum_between(PDO $pdo, string $from, string $to): int
{
    [$ph, $statuses] = omzet_status_sql();
    $st = $pdo->prepare(
        "SELECT COALESCE(SUM(total), 0) FROM bookings
         WHERE slot_date BETWEEN ? AND ? AND status IN ($ph)"
    );
    $st->execute(array_merge([$from, $to], $statuses));
    return (int) $st->fetchColumn();
}
