<?php
/**
 * Uji balapan 2 transaksi InnoDB — dipanggil scripts/uji-tahap2.mjs Skenario 7.
 * Pakai: php uji-race-tahap2.php <YYYY-MM-DD> <A|B>
 * Cetak MENANG atau DITOLAK (slot sudah penuh saat mendapat giliran kunci).
 */

require __DIR__ . '/../app/lib/bootstrap.php';
require __DIR__ . '/../app/lib/slots.php';

$date = $argv[1] ?? '';
$who  = $argv[2] ?? 'X';

if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
    echo 'ERROR:tanggal';
    exit(1);
}

$pdo = db();
try {
    $pdo->beginTransaction();

    // Pastikan baris slot ada lewat helper bersama (INSERT IGNORE, kapasitas
    // config) SEBELUM dikunci — urutan sama persis dengan bookings-create.
    // Pola lama (SELECT … FOR UPDATE lalu INSERT jika kosong) bikin deadlock
    // saat baris belum ada: dua gap lock + insert intention saling tunggu
    // (issue #12). Ensure dulu membuat yang kedua menunggu di unique key.
    slot_ensure($pdo, $date, '09.00');

    $s = $pdo->prepare(
        "SELECT id, capacity, booked FROM slots WHERE slot_date = ? AND slot_time = '09.00' FOR UPDATE"
    );
    $s->execute([$date]);
    $row = $s->fetch();

    // Simulasi "baca di UI lalu klik" — request lain sempat membaca booked lama
    usleep(250000);

    if ((int) $row['booked'] >= (int) $row['capacity']) {
        $pdo->rollBack();
        echo "DITOLAK\n";
        exit(0);
    }

    $pdo->prepare('UPDATE slots SET booked = booked + 1 WHERE id = ?')
        ->execute([(int) $row['id']]);
    $pdo->commit();
    echo "MENANG\n";
} catch (Throwable $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    echo 'ERROR:' . $e->getMessage() . "\n";
    exit(1);
}
