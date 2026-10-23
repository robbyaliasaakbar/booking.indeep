<?php
/**
 * GET  /api/me.php         — siapa yang sedang login + daftar alamat (PRD Bab 16.2).
 * PATCH /api/me.php        — ubah nama dan nomor WhatsApp (wizard langkah 1, PRD Bab 5.1, 5.2).
 *
 * Foto profil, OTP, dan perubahan email tetap urusan Tahap 3.
 */

require __DIR__ . '/../../app/lib/bootstrap.php';
require __DIR__ . '/../../app/lib/session.php';

$user = require_login();

// --- Ambil daftar alamat user (dipakai wizard pilih alamat) ---
$addrStmt = db()->prepare(
    'SELECT id, label, street_no, village, district, city, province, postal, note, maps_url, is_default
     FROM addresses WHERE user_id = ? ORDER BY is_default DESC, id ASC'
);
$addrStmt->execute([(int) $user['id']]);
$addresses = $addrStmt->fetchAll();
foreach ($addresses as &$a) {
    $a['id'] = (int) $a['id'];
    $a['is_default'] = (bool) $a['is_default'];
}
unset($a);

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $user['photo_url'] = $user['photo_path'] !== null
        ? uploads_url($user['photo_path'])
        : null;
    json_response(['data' => $user + ['addresses' => $addresses]]);
}

if ($_SERVER['REQUEST_METHOD'] !== 'PATCH') {
    json_error(405, 'method_not_allowed', 'Metode ini tidak didukung.');
}

$raw  = file_get_contents('php://input');
$body = json_decode($raw ?: '', true);
if (!is_array($body)) {
    json_error(400, 'bad_request', 'Data yang dikirim belum benar.');
}

$name = array_key_exists('name', $body) ? trim((string) $body['name']) : null;
$phonePrimary = array_key_exists('phone_primary', $body) ? trim((string) $body['phone_primary']) : null;
$phoneSecondary = array_key_exists('phone_secondary', $body) ? trim((string) $body['phone_secondary']) : null;
$preferredTime = array_key_exists('preferred_time', $body) ? $body['preferred_time'] : null;

$sets = [];
$params = [];

if ($preferredTime !== null) {
    if ($preferredTime !== null && $preferredTime !== '09.00' && $preferredTime !== '13.00') {
        json_error(400, 'preferred_time_invalid', 'Preferensi jam cuma boleh 09.00 atau 13.00 ya.');
    }
    $sets[] = 'preferred_time = ?';
    $params[] = $preferredTime;
}

if ($name !== null) {
    // FR C01: minimal 3 karakter, maksimal 100, bukan angka semua, tanpa simbol aneh.
    // Angka SEBAGIAN boleh (contoh: "Robby 2", "Siti Jr.") — yang dilarang angka semua.
    $len = mb_strlen($name);
    if ($len < 3) {
        json_error(400, 'name_invalid', 'Nama lengkap wajib diisi minimal 3 huruf ya.');
    }
    if ($len > 100) {
        json_error(400, 'name_invalid', 'Nama lengkapnya kepanjangan, maksimal 100 karakter ya.');
    }
    if (preg_match('/^[0-9\s]+$/', $name)) {
        json_error(400, 'name_invalid', 'Nama lengkapnya jangan cuma angka ya.');
    }
    if (!preg_match('/^[\p{L}\p{M}0-9\'\.\,\-\s]+$/u', $name)) {
        json_error(400, 'name_invalid', 'Nama lengkapnya pakai huruf dan angka saja ya, tanpa simbol aneh.');
    }
    $sets[] = 'name = ?';
    $params[] = $name;
}

if ($phonePrimary !== null) {
    if ($phonePrimary === '') {
        json_error(400, 'phone_invalid', 'Nomor WhatsApp utama wajib diisi buat koordinasi teknisi ya.');
    }
    if (!preg_match('/^[0-9\-\+\s]{8,20}$/', $phonePrimary)) {
        json_error(400, 'phone_invalid', 'Nomor WhatsApp utamanya belum benar. Contoh: 081234567890 ya.');
    }
    $sets[] = 'phone_primary = ?';
    $params[] = $phonePrimary;
}

if ($phoneSecondary !== null) {
    if ($phoneSecondary !== '' && !preg_match('/^[0-9\-\+\s]{8,20}$/', $phoneSecondary)) {
        json_error(400, 'phone_invalid', 'Nomor WhatsApp cadangannya belum benar. Contoh: 081234567890 ya.');
    }
    $sets[] = 'phone_secondary = ?';
    $params[] = $phoneSecondary !== '' ? $phoneSecondary : null;
}

if ($sets === []) {
    json_error(400, 'bad_request', 'Tidak ada perubahan yang dikirim ya.');
}

$params[] = (int) $user['id'];
$stmt = db()->prepare('UPDATE users SET ' . implode(', ', $sets) . ' WHERE id = ?');
$stmt->execute($params);

recompute_profile_complete((int) $user['id']);

// Ambil ulang data terbaru
$stmt = db()->prepare(
    'SELECT id, role, name, email, username, phone_primary, phone_secondary, photo_path, preferred_time, profile_complete
     FROM users WHERE id = ?'
);
$stmt->execute([(int) $user['id']]);
$fresh = $stmt->fetch();
$fresh['photo_url'] = $fresh['photo_path'] !== null
    ? uploads_url($fresh['photo_path'])
    : null;

json_response(['data' => $fresh + ['addresses' => $addresses]]);
