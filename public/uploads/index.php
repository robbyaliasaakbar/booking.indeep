<?php
/**
 * Pengaman folder public/uploads (PRD Bab 14.5).
 * File index.php bikin daftar file tidak bisa dibuka lewat browser.
 * File foto profil tetap bisa diakses langsung lewat <img src="/uploads/xxx.jpg">.
 * Validasi tipe dan ukuran upload (jpg/png/webp, max 2 MB) ditangani di endpoint upload.
 */
http_response_code(404);
header('Content-Type: text/plain; charset=utf-8');
exit('Not found');
