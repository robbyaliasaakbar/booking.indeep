<?php
/**
 * Titik masuk semua endpoint API: satu require beres.
 * Urutan: config -> response -> db -> penanganan error global.
 */

declare(strict_types=1);

// WIB untuk SEMUA waktu PHP (PRD Bab 15) — produksi (Hostinger) tidak pernah
// set date.timezone, jadi tanpa baris ini PHP default UTC dan "hari ini"
// (dashboard), cutoff H-1 cancel, aturan Selasa, expiry OTP meleset 7 jam.
// Dev Docker juga sudah set (Dockerfile), baris ini bikin konsisten di mana aja.
date_default_timezone_set('Asia/Jakarta');

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/response.php';
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/security.php';
require_once __DIR__ . '/request.php';

// Log error ke file (PRD Bab 18) — di luar public_html, aman untuk shared hosting.
// Kalau folder tidak bisa dibuat/ditulis, diamkan (error_log default tetap jalan).
$logDir = dirname(__DIR__, 2) . '/storage/logs';
if (!is_dir($logDir)) {
    @mkdir($logDir, 0755, true);
}
if (is_dir($logDir) && is_writable($logDir)) {
    ini_set('error_log', $logDir . '/php-error.log');
}

// Origin check global (PRD Bab 18): endpoint TULIS hanya dari Origin frontend
// yang dikenal. CLI (scripts/cron) dilewati — tanpa header Origin juga dilewati.
if (PHP_SAPI !== 'cli') {
    $method = (string) ($_SERVER['REQUEST_METHOD'] ?? 'GET');
    if (!in_array($method, ['GET', 'HEAD', 'OPTIONS'], true)) {
        origin_check();
    }
}

// Error tak terduga: catat ke log PHP + balas JSON, bukan halaman error HTML
// (PRD Bab 18: log error file PHP; Bab 16: format error baku JSON).
set_exception_handler(static function (Throwable $e): void {
    error_log(sprintf(
        '[app-indeep] %s in %s:%d',
        $e->getMessage(),
        $e->getFile(),
        $e->getLine()
    ));

    json_error(500, 'server_error', 'Terjadi gangguan di server. Coba beberapa saat lagi ya.');
});
