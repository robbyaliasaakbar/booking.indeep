<?php
/**
 * Reset state uji terpusat (issue #38) — bikin suite IDEMPOTEN antar-run.
 *
 * Masalah lama: suite OTP/Tahap 2/Admin meninggalkan state di DB lokal
 * (rate limit, cooldown OTP, counter slot, booking/user/email uji) sehingga
 * run berikutnya gagal palsu. Sebelumnya tiap suite butuh reset manual yang
 * tidak terdokumentasi.
 *
 * Perintah ini membersihkan:
 *   - otps              (cooldown & attempt cap OTP)
 *   - login_attempts    (rate limit login admin/customer)
 *   - api_rate_limits   (rate limit endpoint oleh IP)
 *   - slots             (counter booked numpuk dari simulasi balapan)
 *   - bookings/items/surcharges/addresses/users ber-domain *@test.dev
 *
 * Panggil di AWAL tiap suite (lihat `resetStateUji()` di uji-*.mjs) atau manual:
 *   docker compose exec -T php php /app/scripts/reset-uji.php
 *
 * SENGAJA tidak menyentuh: pricelist, surcharges, users non-test, config.
 */

declare(strict_types=1);

require __DIR__ . '/../app/lib/bootstrap.php';

$pdo = db();

// Domain email semua data uji.
const UJI_EMAIL_SUFFIX = '%@test.dev';

$summary = [];

// 1. State rate limit & OTP
$pdo->exec('DELETE FROM otps');
$summary['otps'] = 'dibersihkan';

$pdo->exec('DELETE FROM login_attempts');
$summary['login_attempts'] = 'dibersihkan';

// api_rate_limits dibuat lazy oleh ratelimit.php — tabel bisa belum ada.
try {
    $pdo->exec('DELETE FROM api_rate_limits');
    $summary['api_rate_limits'] = 'dibersihkan';
} catch (Throwable $e) {
    $summary['api_rate_limits'] = 'dilewati (tabel belum ada)';
}

// 2. Counter slot (numpuk dari simulasi balapan)
$pdo->exec('DELETE FROM slots');
$summary['slots'] = 'dibersihkan';

// 3. Data uji (booking + anak-anaknya + alamat + user ber-email test.dev)
$pdo->exec(
    'DELETE bi FROM booking_items bi
     JOIN bookings b ON b.id = bi.booking_id
     JOIN users u ON u.id = b.user_id
     WHERE u.email LIKE ' . $pdo->quote(UJI_EMAIL_SUFFIX)
);
$pdo->exec(
    'DELETE bs FROM booking_surcharges bs
     JOIN bookings b ON b.id = bs.booking_id
     JOIN users u ON u.id = b.user_id
     WHERE u.email LIKE ' . $pdo->quote(UJI_EMAIL_SUFFIX)
);
$pdo->exec(
    'DELETE b FROM bookings b
     JOIN users u ON u.id = b.user_id
     WHERE u.email LIKE ' . $pdo->quote(UJI_EMAIL_SUFFIX)
);
$pdo->exec(
    'DELETE a FROM addresses a
     JOIN users u ON u.id = a.user_id
     WHERE u.email LIKE ' . $pdo->quote(UJI_EMAIL_SUFFIX)
);
$pdo->exec(
    'DELETE FROM users WHERE email LIKE ' . $pdo->quote(UJI_EMAIL_SUFFIX)
);
$summary['data_uji_test.dev'] = 'dibersihkan';

// Output ringkas
foreach ($summary as $k => $v) {
    echo str_pad($k, 22) . ": {$v}\n";
}
echo "Reset state uji selesai.\n";
