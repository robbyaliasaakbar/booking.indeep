<?php
/**
 * Bukti tingkat LOCK (issue #26): apakah dua koneksi bisa melewati SELECT
 * pada baris otps yang sama secara BERSAMAAN?
 *
 * Prinsip: tiap proses catat waktu SEBELUM dan SESUDAH SELECT (baris otps yang
 * sama). Kalau statement SELECT mengambil lock, koneksi kedua akan diblokir
 * sehingga rentang [mulai,selesai]-nya TIDAK tumpang tindih dengan yang pertama.
 * Kalau tanpa lock, keduanya selesai hampir bersamaan → tumpang tindih.
 *
 * Pakai:
 *   php uji-race-otp-lock.php <email> <purpose> <mode:plain|forupdate> <durasi_tahan_ms>
 * Cetak: "<mulai_micros> <selesai_micros>" lalu TAHAN N ms sebelum commit,
 * supaya koneksi lain punya cukup waktu untuk mencoba masuk.
 */

require __DIR__ . '/../app/lib/bootstrap.php';

$email  = strtolower(trim($argv[1] ?? ''));
$purpose = trim($argv[2] ?? '');
$mode   = trim($argv[3] ?? '');
$tahanMs = (int) ($argv[4] ?? 800);

if ($email === '' || $purpose === '' || !in_array($mode, ['plain', 'forupdate'], true)) {
    fwrite(STDERR, "argumen kurang\n");
    exit(1);
}

$lockSql = $mode === 'forupdate' ? ' FOR UPDATE' : '';
$pdo = db();

try {
    $pdo->beginTransaction();
    $st = $pdo->prepare(
        'SELECT id, attempts FROM otps WHERE email = ? AND purpose = ? AND consumed = 0' . $lockSql
    );

    $mulai = microtime(true);
    $st->execute([$email, $purpose]);
    $selesai = microtime(true);

    echo sprintf("%.6f %.6f\n", $mulai, $selesai);
    fflush(STDOUT);

    // Tahan transaksi tetap terbuka supaya koneksi lain ketemu lock (atau bebas).
    usleep($tahanMs * 1000);

    $pdo->commit();
} catch (Throwable $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    fwrite(STDERR, 'ERROR:' . $e->getMessage() . "\n");
    exit(1);
}
