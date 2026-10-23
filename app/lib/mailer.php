<?php
/**
 * Mailer OTP (PRD Bab 10.4 — AMENDMEN keputusan Bang Rob, 12 Okt 2026:
 * pengirim = klien SMTP mentah app/lib/smtp.php, menggantikan PHPMailer.
 * Alasan: zero-dep, satu provider (Gmail), dialog bisa ditrace baris per baris.
 *
 * Mode:
 * - Dev (SMTP_HOST kosong + APP_URL localhost): kode ditulis ke storage/otp-dev.log
 * - Produksi (SMTP_HOST kosong): 503 TERANG-TERANGAN — bukan pura-pura sukses (T3-B1)
 * - Produksi (SMTP_HOST terisi): kirim via SMTP (Gmail: email + App Password)
 */

declare(strict_types=1);

require_once __DIR__ . '/smtp.php';

function otp_dev_log_path(): string
{
    return dirname(__DIR__, 2) . '/storage/otp-dev.log';
}

/** Label tujuan OTP — dipakai subject & isi email. */
function otp_purpose_label(string $purpose): string
{
    return match ($purpose) {
        'ganti_password' => 'ganti password',
        'lupa_password'  => 'lupa password',
        'ganti_email'    => 'ganti email',
        default          => 'akun kamu',
    };
}

/**
 * Kirim kode OTP ke email. Tujuan: ganti_email, ganti_password, lupa_password.
 * Melempar RuntimeException (-> 500 JSON) kalau SMTP gagal — T3-B1: gagal jujur.
 */
function mailer_send_otp(string $email, string $code, string $purpose): void
{
    $smtpHost = (string) config('SMTP_HOST');

    if ($smtpHost === '') {
        // --- Dev mode: tulis ke log lokal ---
        $appUrl = (string) config('APP_URL');
        if (str_starts_with($appUrl, 'http://localhost') || str_starts_with($appUrl, 'http://127.0.0.1')) {
            $dir = dirname(otp_dev_log_path());
            if (!is_dir($dir)) {
                mkdir($dir, 0775, true);
            }
            $line = sprintf(
                "[%s WIB] TO=%s PURPOSE=%s CODE=%s\n",
                date('Y-m-d H:i:s'),
                $email,
                $purpose,
                $code
            );
            file_put_contents(otp_dev_log_path(), $line, FILE_APPEND | LOCK_EX);
            return;
        }

        // Produksi tanpa SMTP: GAGAL TERANG (T3-B1) — kode gak mungkin nyampe
        // ke siapa pun, jangan dibalas sukses palsu.
        json_error(503, 'email_disabled', 'Layanan kirim email belum aktif. Coba lagi nanti ya.');
    }

    $label   = otp_purpose_label($purpose);
    $subject = "Kode OTP {$label} — InDeepCleaningID";
    $body =
        "Halo,\n\n" .
        "Kode OTP untuk {$label} kamu:\n\n" .
        "    {$code}\n\n" .
        "Berlaku 5 menit. Jangan bagikan kode ini ke siapa pun,\n" .
        "termasuk yang mengaku dari InDeepCleaningID.\n\n" .
        "Salam,\n" .
        "InDeepCleaningID\n";

    smtp_send(
        $smtpHost,
        465,                         // Gmail implicit TLS
        (string) config('SMTP_USER'),
        (string) config('SMTP_PASS'),
        (string) config('SMTP_USER'), // From = user pengirim (DMARC Gmail wajib sama)
        $email,
        $subject,
        $body
    );
}
