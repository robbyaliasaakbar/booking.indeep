<?php
/**
 * Helper OTP (PRD Bab 10.4):
 * - 6 digit angka, hash (password_hash), kedaluwarsa 5 menit.
 * - Max 5 percobaan salah, lalu kunci 15 menit.
 * - Resend cooldown 60 detik. Resend bikin kode BARU; kode lama tetap
 *   berlaku sampai expired-nya sendiri (keputusan Bang Rob T3-B1).
 * - Cron hPanel hapus baris kedaluwarsa tiap 10 menit (tanpa TTL otomatis).
 */

declare(strict_types=1);

require_once __DIR__ . '/mailer.php';

const OTP_EXPIRY_MINUTES      = 5;
const OTP_MAX_ATTEMPTS        = 5;
const OTP_LOCK_MINUTES        = 15;
const OTP_RESEND_COOLDOWN_SEC = 60;

function otp_generate(): string
{
    return str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);
}

/**
 * Simpan hash + kirim. Selalu balas sukses generik (anti email enumeration
 * untuk lupa_password publik — request ke email yang gak ada pun sukses).
 *
 * @return array{email_masked: string, expires_in: int, resend_after: int}
 */
function otp_request_send(string $email, string $purpose): array
{
    $email = strtolower(trim($email));
    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        json_error(400, 'invalid_email', 'Emailnya belum benar formatnya ya.');
    }

    if (!in_array($purpose, ['ganti_email', 'ganti_password', 'lupa_password'], true)) {
        json_error(400, 'purpose_invalid', 'Tujuan kode tidak dikenal ya.');
    }

    $pdo = db();

    // --- Cooldown 60 detik per email + purpose ---
    $stmt = $pdo->prepare(
        'SELECT id, created_at FROM otps
         WHERE email = ? AND purpose = ? AND consumed = 0
         ORDER BY id DESC LIMIT 1'
    );
    $stmt->execute([$email, $purpose]);
    $last = $stmt->fetch();
    if ($last) {
        $age = time() - strtotime($last['created_at']);
        if ($age < OTP_RESEND_COOLDOWN_SEC) {
            json_error(429, 'terlalu_sering', sprintf(
                'Kode baru bisa diminta lagi dalam %d detik. Tunggu dulu ya.',
                OTP_RESEND_COOLDOWN_SEC - $age
            ));
        }
    }

    // --- Kunci 15 menit kalau sudah 5 kali salah ---
    otp_assert_not_locked($email, $purpose);

    $code = otp_generate();
    $expiresAt = date('Y-m-d H:i:s', time() + OTP_EXPIRY_MINUTES * 60);

    // created_at ditulis eksplisit dari PHP (WIB) — jangan NOW() DB,
    // karena cooldown dihitung dengan time() PHP (bug UTC-vs-WIB pernah loloskan resend).
    $ins = $pdo->prepare(
        'INSERT INTO otps (email, purpose, code_hash, expires_at, attempts, consumed, created_at)
         VALUES (?, ?, ?, ?, 0, 0, ?)'
    );
    $ins->execute([$email, $purpose, password_hash($code, PASSWORD_DEFAULT), $expiresAt, date('Y-m-d H:i:s')]);

    mailer_send_otp($email, $code, $purpose);

    $info = [
        'email_masked' => otp_mask_email($email),
        'expires_in'   => OTP_EXPIRY_MINUTES * 60,
        'resend_after' => OTP_RESEND_COOLDOWN_SEC,
    ];

    // Mode lokal (SMTP belum diset + APP_URL localhost): kasih tahu dimana
    // kode ditulis — biar developer gak bingung nyari di inbox.
    // Guard ketat: TIDAK PERNAH muncul di produksi (APP_URL non-localhost).
    if ((string) config('SMTP_HOST') === ''
        && str_starts_with((string) config('APP_URL'), 'http://localhost')) {
        $info['dev_note'] = 'Mode lokal: kode OTP ditulis ke storage/otp-dev.log (SMTP belum diset).';
    }

    return $info;
}

/**
 * Verifikasi kode. Kalau cocok → tandai consumed dan balas true.
 * Salah → attempts naik; sampai 5 → kunci 15 menit.
 *
 * Anti-race (issue #26): seluruh baca-cek-tulis dijalankan dalam SATU transaksi
 * InnoDB, dengan semua baris OTP aktif (email + purpose) dikunci dulu lewat
 * `SELECT … FOR UPDATE`. Request paralel jadi saling antri — maksimal
 * OTP_MAX_ATTEMPTS percobaan yang benar-benar sampai `password_verify()` per
 * siklus lock. Commit dilakukan SEBELUM melempar error supaya penambahan
 * attempts tidak ikut ter-rollback.
 */
function otp_verify(string $email, string $purpose, string $code): bool
{
    $email = strtolower(trim($email));
    $pdo = db();

    if (!preg_match('/^\d{6}$/', $code)) {
        json_error(400, 'otp_invalid', 'Kode harus 6 digit angka ya.');
    }

    $pdo->beginTransaction();
    try {
        // Kunci SEMUA baris aktif (belum dipakai) untuk email + purpose ini.
        // Inilah titik serialisasi: request lain menunggu sampai commit/rollback.
        // Keputusan T3-B1: resend bikin kode BARU, kode lama tetap berlaku
        // sampai expired-nya sendiri — jadi verifikasi mengecek SEMUA.
        $stmt = $pdo->prepare(
            'SELECT id, code_hash, expires_at, attempts, created_at FROM otps
             WHERE email = ? AND purpose = ? AND consumed = 0
             ORDER BY id DESC
             FOR UPDATE'
        );
        $stmt->execute([$email, $purpose]);
        $rows = $stmt->fetchAll();

        if ($rows === []) {
            $pdo->commit();
            json_error(400, 'otp_not_found', 'Kode tidak ditemukan. Minta kode baru ya.');
        }

        $now = time();
        $aktif = [];
        $lockedRow = null; // baris dengan attempts >= max (acuan lock)
        foreach ($rows as $r) {
            if ((int) $r['attempts'] >= OTP_MAX_ATTEMPTS && $lockedRow === null) {
                $lockedRow = $r;
            }
            if (strtotime($r['expires_at']) > $now) {
                $aktif[] = $r;
            }
        }

        // Cek lock dulu (baris sudah dikunci — nilainya final untuk siklus ini).
        if ($lockedRow !== null) {
            $age = time() - strtotime($lockedRow['created_at']);
            if ($age < OTP_LOCK_MINUTES * 60) {
                $pdo->commit();
                json_error(429, 'terlalu_sering', sprintf(
                    'Terlalu banyak percobaan. Coba lagi dalam %d menit ya.',
                    OTP_LOCK_MINUTES - intdiv($age, 60)
                ));
            }
        }

        if ($aktif === []) {
            $pdo->commit();
            json_error(400, 'otp_kedaluwarsa', 'Kode sudah kedaluwarsa. Minta kode baru ya.');
        }

        // Cek semua kode aktif — yang mana pun yang cocok, lolos.
        foreach ($aktif as $r) {
            if (password_verify($code, $r['code_hash'])) {
                $pdo->prepare('UPDATE otps SET consumed = 1 WHERE id = ?')
                    ->execute([(int) $r['id']]);
                $pdo->commit();
                return true;
            }
        }

        // Tidak ada yang cocok — naikkan attempts di semua kode aktif
        // (biar hitungan percobaan konsisten antar kode).
        $ids = array_map(static fn ($r) => (int) $r['id'], $aktif);
        $pdo->prepare(
            'UPDATE otps SET attempts = attempts + 1 WHERE id IN (' . implode(',', $ids) . ')'
        )->execute([]);

        // Baca nilai SETELAH update (masih dalam transaksi yang sama) — bukan
        // snapshot lama. Ini yang dulu bikin beberapa request paralel lolos.
        $sum = $pdo->prepare(
            'SELECT MAX(attempts) AS m FROM otps WHERE id IN (' . implode(',', $ids) . ')'
        );
        $sum->execute();
        $totalAttempts = (int) ($sum->fetch()['m'] ?? 0);

        $pdo->commit();

        if ($totalAttempts >= OTP_MAX_ATTEMPTS) {
            json_error(429, 'terlalu_sering', 'Terlalu banyak percobaan salah. Kode dikunci 15 menit ya.');
        }
        json_error(400, 'otp_salah', sprintf(
            'Kode belum cocok. Sisa percobaan %d kali ya.',
            OTP_MAX_ATTEMPTS - $totalAttempts
        ));
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $e;
    }
}

/** Lempar error 429 kalau email+purpose sedang terkunci (5x salah <15 menit lalu). */
function otp_assert_not_locked(string $email, string $purpose): void
{
    $stmt = db()->prepare(
        'SELECT id, attempts, created_at FROM otps
         WHERE email = ? AND purpose = ? AND attempts >= ?
         ORDER BY id DESC LIMIT 1'
    );
    $stmt->execute([$email, $purpose, OTP_MAX_ATTEMPTS]);
    $row = $stmt->fetch();

    if ($row) {
        $age = time() - strtotime($row['created_at']);
        if ($age < OTP_LOCK_MINUTES * 60) {
            json_error(429, 'terlalu_sering', sprintf(
                'Terlalu banyak percobaan. Coba lagi dalam %d menit ya.',
                OTP_LOCK_MINUTES - intdiv($age, 60)
            ));
        }
    }
}

/** a***@domain.com — biar user tahu kode dikirim ke mana tanpa membocorkan penuh. */
function otp_mask_email(string $email): string
{
    $pos = strpos($email, '@');
    if ($pos === false || $pos === 0) {
        return '***';
    }
    return substr($email, 0, 1) . '***@' . substr($email, $pos + 1);
}
