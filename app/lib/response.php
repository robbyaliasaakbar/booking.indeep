<?php
/**
 * Helper response JSON sesuai format baku PRD Bab 16:
 * sukses = data, gagal = code, message, details.
 * Pesan selalu bahasa warung yang sopan (PRD Bab 17).
 */

declare(strict_types=1);

function json_response(array $payload, int $status = 200): never
{
    if (!headers_sent()) {
        http_response_code($status);
        header('Content-Type: application/json; charset=utf-8');
    }
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function json_error(int $status, string $code, string $message, mixed $details = null): never
{
    json_response([
        'code'    => $code,
        'message' => $message,
        'details' => $details,
    ], $status);
}

/**
 * URL publik file di public/uploads/.
 * Pakai APP_URL dari config (produksi: https://booking.indeepcleaningid.site) —
 * foto profil tetap tembus apa pun base yang dipakai, gak nempel di root domain.
 */
function uploads_url(string $file): string
{
    return rtrim((string) config('APP_URL'), '/') . '/uploads/' . $file;
}
