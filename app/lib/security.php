<?php
/**
 * Penjaga tambahan keamanan request (PRD Bab 18).
 * - client_ip(): IP asli dari X-Forwarded-For (1 hop) atau REMOTE_ADDR.
 * - trusted_ip(): REMOTE_ADDR saja — untuk bucket rate limit auth (anti XFF spoof).
 * - origin_check(): endpoint TULIS (POST/PATCH/PUT/DELETE) hanya menerima
 *   Origin dari whitelist frontend (WEB_URL/APP_URL). Request tanpa header
 *   Origin (curl CLI) dibiarkan — Origin dikirim browser.
 */

declare(strict_types=1);

function client_ip(): string
{
    $xff = trim((string) ($_SERVER['HTTP_X_FORWARDED_FOR'] ?? ''));
    if ($xff !== '') {
        // Ambil hop pertama saja (paling kiri) — jangan percaya seluruh rantai.
        $first = trim(explode(',', $xff)[0]);
        if (filter_var($first, FILTER_VALIDATE_IP)) {
            return $first;
        }
    }
    return (string) ($_SERVER['REMOTE_ADDR'] ?? '0.0.0.0');
}

/**
 * IP tepercaya untuk bucket rate limit AUTH: selalu REMOTE_ADDR.
 * X-Forwarded-For TIDAK dipakai — header itu bisa dipalsukan client, jadi
 * rotasi XFF membobol limit kalau key-nya client_ip(). Konsisten dengan
 * admin-login.php & login.php yang basis REMOTE_ADDR (issue #25).
 */
function trusted_ip(): string
{
    return (string) ($_SERVER['REMOTE_ADDR'] ?? '0.0.0.0');
}

function origin_allowed(): bool
{
    $origin = trim((string) ($_SERVER['HTTP_ORIGIN'] ?? ''));
    if ($origin === '') {
        return true; // curl CLI / server-to-server tidak kirim Origin
    }

    $allowed = [];
    foreach (['WEB_URL', 'APP_URL'] as $key) {
        $allowed[] = (string) config($key, '');
    }
    // Port Vite auto-geser saat dev (PRD Bab 14.4)
    $allowed[] = 'http://localhost:5173';
    $allowed[] = 'http://localhost:5174';
    $allowed[] = 'http://localhost:5175';
    $allowed[] = 'http://localhost:5176';

    // Origin header browser SELALU tanpa path (https://domain.tld), sementara
    // APP_URL bisa saja mengandung path (mis. https://domain.tld/app).
    // Bandingkan keduanya dalam bentuk origin (scheme://host[:port]) — versi lama
    // (full URL vs origin) bikin SEMUA request tulis 403 di produksi.
    foreach ($allowed as $url) {
        if ($url !== '' && strcasecmp(origin_of($url), $origin) === 0) {
            return true;
        }
    }

    return false;
}

/** Ambil scheme://host[:port] dari sebuah URL (tanpa path & query). */
function origin_of(string $url): string
{
    $p = parse_url(trim($url));
    if ($p === false || !isset($p['host'])) {
        return rtrim(trim($url), '/'); // bukan URL valid — pakai apa adanya
    }
    $scheme = strtolower((string) ($p['scheme'] ?? 'http'));
    $host   = strtolower((string) $p['host']);
    $port   = isset($p['port']) ? ':' . $p['port'] : '';
    return $scheme . '://' . $host . $port;
}

/**
 * Panggil sekali di endpoint tulis. Tolak Origin asing dengan 403.
 */
function origin_check(): void
{
    if (!origin_allowed()) {
        json_error(403, 'origin_denied', 'Permintaan dari asal tidak dikenal ya.');
    }
}
