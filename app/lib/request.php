<?php
/**
 * Helper parsing request bersama (issue #4 Batch 2).
 *
 * Sebelumnya 16 endpoint menyalin pola `file_get_contents('php://input')` +
 * `json_decode(...)` dengan perilaku berbeda, dan 4 file menyalin parser
 * tanggal Y-m-d. Satu sumber biar konsisten.
 */

declare(strict_types=1);

/**
 * Baca body JSON request sebagai array.
 *
 * @param bool $requireArray true  → json_error(400 bad_request) kalau body bukan
 *                             objek/array JSON (dipakai endpoint tulis).
 *                           false → balas [] kalau body kosong/tak valid
 *                             (dipakai endpoint yang body-nya opsional, mis.
 *                             `?id=` GET-style di DELETE).
 * @return array<string,mixed>
 */
function read_json_body(bool $requireArray = true): array
{
    $raw = file_get_contents('php://input');
    $body = json_decode($raw ?: '', true);

    if (!is_array($body)) {
        if ($requireArray) {
            json_error(400, 'bad_request', 'Data yang dikirim belum benar.');
        }
        return [];
    }

    return $body;
}

/**
 * Parse tanggal "YYYY-MM-DD" jadi string ternormalisasi.
 * Melempar json_error(400) kalau format salah. Pakai pesan default kalau
 * $message tidak diisi.
 */
function request_date_ymd(string $raw, string $message = 'Format tanggal harus YYYY-MM-DD ya.'): string
{
    $d = DateTimeImmutable::createFromFormat('Y-m-d', $raw);
    $err = DateTimeImmutable::getLastErrors();
    if (!$d || $raw === '' || ($err !== false && ($err['warning_count'] > 0 || $err['error_count'] > 0))) {
        json_error(400, 'bad_request', $message);
    }
    return $d->format('Y-m-d');
}
