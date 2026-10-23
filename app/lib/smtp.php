<?php
/**
 * Klien SMTP mentah — keputusan Bang Rob (12 Okt 2026), AMENDMEN PRD Bab 10.4:
 * menggantikan PHPMailer. Zero-dep, satu dialog, semua baris bisa ditrace.
 *
 * Dua mode koneksi (port menentukan):
 * - 465: implicit TLS — TLS duluan, baru sapa server
 *   connect tls -> 220 -> EHLO -> 250 -> AUTH LOGIN -> ...
 * - 587: STARTTLS — sapa server polos, naikkan TLS, sapa ulang, baru AUTH
 *   connect -> 220 -> EHLO -> 250 -> STARTTLS -> 220 -> EHLO -> 250 -> AUTH LOGIN -> ...
 *
 * Alasan dua mode: shared hosting (Hostinger) sering blokir port 465 keluar,
 * tapi 587 hampir selalu terbuka. Port diatur lewat config SMTP_PORT.
 *
 * TLS/kripto ditangani PHP streams (OpenSSL) — file ini cuma menulis teks
 * protokol SMTP, bukan ngurus enkripsi.
 */

declare(strict_types=1);

/** Baca satu baris balasan server (tanpa CRLF). */
function smtp_read_line($fp): string
{
    $line = fgets($fp, 4096);
    if ($line === false) {
        $meta = stream_get_meta_data($fp);
        if (!empty($meta['timed_out'])) {
            throw new RuntimeException('SMTP: timeout nunggu balasan server.');
        }
        throw new RuntimeException('SMTP: koneksi terputus sebelum balasan server.');
    }
    return rtrim($line, "\r\n");
}

/**
 * Baca satu blok balasan server. multiline ("250-...") dibaca sampai baris
 * dengan spasi ("250 "). Lempar RuntimeException kalau kode akhirnya bukan
 * yang ditunggu — biar kegagalan teriak, bukan diam-diam lolos (T3-B1).
 */
function smtp_expect($fp, int ...$codes): void
{
    while (true) {
        $line = smtp_read_line($fp);
        if (preg_match('/^(\d{3})[ ]/', $line, $m)) { // spasi = baris terakhir blok
            $code = (int) $m[1];
            if (!in_array($code, $codes, true)) {
                throw new RuntimeException("SMTP: balasan tak terduga -> {$line}");
            }
            return;
        }
        // "250-..." — lanjut baca baris berikutnya
    }
}

/** Kirim satu perintah + CRLF, lalu tunggu kode balasan yang ditunggu. */
function smtp_cmd($fp, string $cmd, int ...$codes): void
{
    smtp_raw($fp, $cmd . "\r\n");
    smtp_expect($fp, ...$codes);
}

/** Tulis mentah ke socket (pemanggil yang atur CRLF-nya). */
function smtp_raw($fp, string $data): void
{
    $len = strlen($data);
    $written = fwrite($fp, $data);
    if ($written === false || $written !== $len) {
        throw new RuntimeException('SMTP: gagal menulis ke server.');
    }
}

/** "Nama" -> =?UTF-8?B?...?= (RFC 2047) — biar subject non-ASCII aman. */
function smtp_encode_header(string $text): string
{
    return '=?UTF-8?B?' . base64_encode($text) . '?=';
}

/**
 * Kirim 1 email teks lewat SMTP dengan TLS.
 *
 * @param string $host SMTP host (mis. smtp.gmail.com)
 * @param int    $port 465 = implicit TLS | 587 = STARTTLS
 * @param string $user kredensial AUTH — Gmail: email + App Password
 * @param string $pass App Password
 * @param string $from pengirim — WAJIB sama dengan $user biar lolos DMARC Gmail
 * @param string $to   penerima
 * @param string $subject subject (boleh non-ASCII, di-encode RFC 2047)
 * @param string $body isi teks polos (di-base64 per baris RFC 2045)
 */
function smtp_send(
    string $host,
    int $port,
    string $user,
    string $pass,
    string $from,
    string $to,
    string $subject,
    string $body
): void {
    // Port 465 bungkus TLS dari awal (implicit). Port lain konek polos dulu,
    // lalu naikkan lewat STARTTLS setelah EHLO.
    $implicitTls = ($port === 465);
    $remote = $implicitTls ? "tls://{$host}:{$port}" : "tcp://{$host}:{$port}";

    $fp = @stream_socket_client($remote, $errno, $errstr, 15, STREAM_CLIENT_CONNECT);
    if ($fp === false) {
        throw new RuntimeException("SMTP: gagal terhubung ke {$remote} — {$errstr} ({$errno})");
    }
    stream_set_timeout($fp, 20);

    try {
        smtp_expect($fp, 220);                                   // sapaan server
        smtp_cmd($fp, 'EHLO ' . (gethostname() ?: 'localhost'), 250);

        if (!$implicitTls) {
            // STARTTLS: naikkan kanal ke TLS, lalu EHLO ulang (wajib oleh RFC 3207 —
            // kapabilitas setelah TLS bisa beda, mis. AUTH baru muncul di sini).
            smtp_cmd($fp, 'STARTTLS', 220);
            $ok = @stream_socket_enable_crypto(
                $fp,
                true,
                STREAM_CRYPTO_METHOD_TLSv1_2_CLIENT | STREAM_CRYPTO_METHOD_TLSv1_3_CLIENT
            );
            if ($ok !== true) {
                throw new RuntimeException('SMTP: gagal menaikkan koneksi ke TLS (STARTTLS).');
            }
            smtp_cmd($fp, 'EHLO ' . (gethostname() ?: 'localhost'), 250);
        }

        smtp_cmd($fp, 'AUTH LOGIN', 334);
        smtp_cmd($fp, base64_encode($user), 334);
        smtp_cmd($fp, base64_encode($pass), 235);
        smtp_cmd($fp, "MAIL FROM:<{$from}>", 250);
        smtp_cmd($fp, "RCPT TO:<{$to}>", 250, 251);
        smtp_cmd($fp, 'DATA', 354);

        // Body di-base64 -> tidak ada baris yang diawali titik, jadi dot-stuffing
        // tidak diperlukan; chunk_split menjamin diakhiri CRLF sebelum "." penutup.
        $message =
            'From: ' . smtp_encode_header('InDeepCleaningID') . " <{$from}>\r\n" .
            "To: <{$to}>\r\n" .
            'Subject: ' . smtp_encode_header($subject) . "\r\n" .
            'Date: ' . date(DATE_RFC2822) . "\r\n" .
            "MIME-Version: 1.0\r\n" .
            "Content-Type: text/plain; charset=UTF-8\r\n" .
            "Content-Transfer-Encoding: base64\r\n" .
            "\r\n" .
            chunk_split(base64_encode($body));
        smtp_raw($fp, $message . ".\r\n");
        smtp_expect($fp, 250);

        smtp_raw($fp, "QUIT\r\n"); // best effort — tutup sendiri di finally
    } finally {
        fclose($fp);
    }
}
