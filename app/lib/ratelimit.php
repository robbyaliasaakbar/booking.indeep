<?php
/**
 * Rate limit API publik berbasis IP + bucket (PRD Bab 18).
 * Tabel dibuat otomatis kalau belum ada — ramah shared hosting tanpa migrasi manual.
 *
 * Pakai: rate_limit('pub:quote', 60, 60);  // 60 request / 60 detik / IP / bucket
 * Lolos -> diam. Kena limit -> 429 + `json_error` (langsung berhenti).
 *
 * Bucket AUTH wajib key di IP tepercaya (REMOTE_ADDR) lewat argumen ke-4:
 *   rate_limit('auth:otp-verify', 20, 60, trusted_ip());
 * client_ip() percaya X-Forwarded-For yang bisa dipalsukan client, jadi
 * rotasi XFF bisa membobol limit auth kalau pakai default (issue #25).
 */

declare(strict_types=1);

function rate_limit(string $bucket, int $maxHits, int $windowSeconds, ?string $ip = null): void
{
    static $ready = false;
    $pdo = db();

    if (!$ready) {
        $pdo->exec(
            'CREATE TABLE IF NOT EXISTS api_rate_limits (
                bucket VARCHAR(80) NOT NULL,
                ip VARCHAR(45) NOT NULL,
                hits INT UNSIGNED NOT NULL DEFAULT 1,
                window_start DATETIME NOT NULL,
                PRIMARY KEY (bucket, ip),
                KEY idx_window (window_start)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci'
        );
        $ready = true;
    }

    $ip ??= client_ip();

    $pdo->beginTransaction();
    try {
        $st = $pdo->prepare(
            'SELECT hits, window_start FROM api_rate_limits WHERE bucket = ? AND ip = ? FOR UPDATE'
        );
        $st->execute([$bucket, $ip]);
        $row = $st->fetch();

        $now = time();
        $resetAt = $row ? strtotime($row['window_start']) + $windowSeconds : $now;

        if ($row && $now < $resetAt) {
            if ((int) $row['hits'] >= $maxHits) {
                $pdo->rollBack();
                header('Retry-After: ' . max(1, $resetAt - $now));
                json_error(429, 'rate_limited', 'Terlalu banyak permintaan. Tunggu sebentar ya.');
            }
            $pdo->prepare(
                'UPDATE api_rate_limits SET hits = hits + 1 WHERE bucket = ? AND ip = ?'
            )->execute([$bucket, $ip]);
        } else {
            // window_start ditulis dari PHP (bukan NOW() DB): dicek pakai
            // time()/strtotime() PHP juga — jangan campur dua sumber (issue #18,
            // pola sama dengan created_at di app/lib/otp.php).
            $pdo->prepare(
                'INSERT INTO api_rate_limits (bucket, ip, hits, window_start)
                 VALUES (?, ?, 1, ?)
                 ON DUPLICATE KEY UPDATE hits = 1, window_start = ?'
            )->execute([$bucket, $ip, date('Y-m-d H:i:s'), date('Y-m-d H:i:s')]);
        }
        $pdo->commit();
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        // Rate limit gagal jangan bikin API mati — lewati saja (fail-open).
    }
}
