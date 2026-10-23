<?php
/**
 * CLI: buang baris OTP kedaluwarsa (PRD Bab 10.4 — cron hPanel tiap 10 menit).
 *
 * Patokan waktu pakai jam PHP (WIB), sama seperti penulisan expires_at —
 * jangan NOW() DB (bug UTC-vs-WIB pernah loloskan resend, lihat app/lib/otp.php).
 *
 * Pemakaian lokal (Docker):
 *   docker compose exec -T php php /app/scripts/cleanup-otp.php
 * Pemakaian produksi (Hostinger cron job, tiap 10 menit):
 *   php /home/USER/public_html/booking/scripts/cleanup-otp.php
 */

declare(strict_types=1);

require __DIR__ . '/../app/lib/bootstrap.php';

// Amankan: hanya boleh jalan dari CLI (scripts/ sudah diblokir .htaccess dari web)
if (PHP_SAPI !== 'cli') {
    fwrite(STDERR, "Hanya untuk CLI.\n");
    exit(1);
}

$pdo = db();
$stmt = $pdo->prepare('DELETE FROM otps WHERE expires_at < ?');
$stmt->execute([date('Y-m-d H:i:s')]);

echo 'OTP kedaluwarsa dibuang: ' . $stmt->rowCount() . ' baris' . PHP_EOL;
