<?php
/**
 * Migrasi ringan & IDEMPOTEN buat DB yang sudah ada (produksi/lokal lama).
 *
 * schema.sql hanya `CREATE TABLE IF NOT EXISTS` — tabel yang sudah ada TIDAK
 * ikut dapat index/kolom baru. Script ini menambah perubahan skema yang tak
 * tercakup oleh CREATE TABLE IF NOT EXISTS.
 *
 * Aman dijalankan berulang: tiap langkah cek dulu apakah sudah ada.
 *
 * Pemakaian lokal (Docker):
 *   docker compose exec -T php php /app/scripts/migrate.php
 * Pemakaian produksi (Hostinger):
 *   php /home/USER/<folder-app>/scripts/migrate.php
 */

declare(strict_types=1);

require __DIR__ . '/../app/lib/bootstrap.php';

$pdo = db();
$applied = 0;
$skipped = 0;

/** Cek index ada di tabel. */
function index_exists(PDO $pdo, string $table, string $index): bool
{
    $st = $pdo->prepare(
        'SELECT COUNT(*) FROM information_schema.statistics
         WHERE table_schema = DATABASE() AND table_name = ? AND index_name = ?'
    );
    $st->execute([$table, $index]);
    return (int) $st->fetchColumn() > 0;
}

// --- migrasi 1: index audit_logs(action) (issue #4) ---
if (index_exists($pdo, 'audit_logs', 'idx_audit_logs_action')) {
    echo "[skip] idx_audit_logs_action sudah ada\n";
    $skipped++;
} else {
    $pdo->exec('ALTER TABLE audit_logs ADD INDEX idx_audit_logs_action (action)');
    echo "[ok]   idx_audit_logs_action ditambahkan\n";
    $applied++;
}

echo "Migrasi selesai: {$applied} diterapkan, {$skipped} dilewati.\n";
