<?php
/**
 * Loader config — baca config/config.php sekali lalu cache di memori.
 * Dipanggil lewat app/lib/bootstrap.php.
 */

declare(strict_types=1);

/**
 * Ambil nilai config. `$default` dipakai kalau kunci TIDAK ada (issue #4 —
 * dulu signature cuma 1 param, jadi pemanggil `config($k, '')` menyebabkan
 * RuntimeException 500 alih-alih memakai fallback).
 *
 * `func_num_args() > 1` membedakan "default tidak dikasih" (→ throw kalau kunci
 * hilang) dari "default dikasih eksplisit, termasuk null".
 */
function config(string $key, mixed $default = null): mixed
{
    static $cfg = null;

    if ($cfg === null) {
        $path = dirname(__DIR__, 2) . '/config/config.php';
        if (!is_file($path)) {
            throw new RuntimeException(
                'config/config.php belum ada. Salin config/config.example.php jadi config/config.php lalu isi nilai lokal.'
            );
        }
        $cfg = require $path;
    }

    if (!array_key_exists($key, $cfg)) {
        if (func_num_args() > 1) {
            return $default;
        }
        throw new RuntimeException("Kunci config tidak dikenal: {$key}");
    }

    return $cfg[$key];
}
