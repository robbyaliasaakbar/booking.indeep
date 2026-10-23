<?php
/**
 * POST   /api/me-photo.php — upload foto profil (PRD Bab 10.3, 16.2).
 * DELETE /api/me-photo.php — hapus foto profil.
 *
 * Upload: multipart/form-data field "photo", max 2 MB, jpg/png/webp.
 * Nama file acak (random_bytes) — nama asli tidak pernah dipakai.
 * Foto lama otomatis dihapus dari disk.
 */

require __DIR__ . '/../../app/lib/bootstrap.php';
require __DIR__ . '/../../app/lib/session.php';

$user = require_login();

if ($_SERVER['REQUEST_METHOD'] === 'DELETE') {
    $photoPath = (string) ($user['photo_path'] ?? '');
    if ($photoPath !== '') {
        $file = dirname(__DIR__, 2) . '/public/uploads/' . $photoPath;
        if (is_file($file)) {
            unlink($file);
        }
        db()->prepare('UPDATE users SET photo_path = NULL WHERE id = ?')
            ->execute([(int) $user['id']]);
    }
    // Foto bukan bagian dari kriteria profile_complete (nama + WA + alamat) —
    // tak perlu recompute di sini (issue #4).
    json_response(['data' => ['ok' => true]]);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_error(405, 'method_not_allowed', 'Metode ini tidak didukung.');
}

if (!isset($_FILES['photo']) || $_FILES['photo']['error'] === UPLOAD_ERR_NO_FILE) {
    json_error(400, 'bad_request', 'Belum ada file yang dipilih ya.');
}
if ($_FILES['photo']['error'] === UPLOAD_ERR_INI_SIZE || $_FILES['photo']['error'] === UPLOAD_ERR_FORM_SIZE) {
    json_error(400, 'file_too_large', 'Ukuran foto maksimal 2 MB ya.');
}
if ($_FILES['photo']['error'] !== UPLOAD_ERR_OK) {
    json_error(400, 'bad_request', 'Upload gagal. Coba lagi ya.');
}

$file = $_FILES['photo'];

// --- Ukuran maksimal 2 MB ---
if ($file['size'] > 2 * 1024 * 1024) {
    json_error(400, 'file_too_large', 'Ukuran foto maksimal 2 MB ya.');
}

// --- Tipe asli via finfo (bukan ekstensi) ---
$finfo = new finfo(FILEINFO_MIME_TYPE);
$mime  = $finfo->file($file['tmp_name']);

$allowed = [
    'image/jpeg' => 'jpg',
    'image/png'  => 'png',
    'image/webp' => 'webp',
];
if (!isset($allowed[$mime])) {
    json_error(400, 'file_invalid', 'Foto harus JPG, PNG, atau WebP ya.');
}

// Pastikan benar-benar gambar yang bisa dibuka
if (!@getimagesize($file['tmp_name'])) {
    json_error(400, 'file_invalid', 'File itu bukan gambar yang valid ya.');
}

// --- Nama acak, ekstensi dari mime ---
$ext = $allowed[$mime];
$newName = bin2hex(random_bytes(16)) . '.' . $ext;
$dest = dirname(__DIR__, 2) . '/public/uploads/' . $newName;

if (!move_uploaded_file($file['tmp_name'], $dest)) {
    json_error(500, 'server_error', 'Gagal menyimpan foto. Coba lagi ya.');
}

// --- Hapus foto lama ---
$old = (string) ($user['photo_path'] ?? '');
if ($old !== '') {
    $oldFile = dirname(__DIR__, 2) . '/public/uploads/' . $old;
    if (is_file($oldFile)) {
        unlink($oldFile);
    }
}

db()->prepare('UPDATE users SET photo_path = ? WHERE id = ?')
    ->execute([$newName, (int) $user['id']]);

// Foto bukan kriteria profile_complete — tak perlu recompute (issue #4).
json_response(['data' => ['ok' => true, 'photo_url' => uploads_url($newName)]]);
