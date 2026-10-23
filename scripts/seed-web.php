<?php
/**
 * Seed sekali-pakai buat Hostinger shared hosting (tanpa PHP CLI).
 *
 * CARA PAKAI (deploy produksi):
 * 1. Upload folder scripts/ ke public_html/booking/scripts/
 * 2. Salin/copy file ini ke root: public_html/booking/seed-web.php
 * 3. Buka SEKALI: https://booking.indeepcleaningid.site/seed-web.php
 * 4. LANGSUNG HAPUS public_html/booking/seed-web.php dari File Manager
 *
 * Seed idempoten — dijalankan berulang pun aman (data existing gak ditimpa).
 * scripts/ diblokir .htaccess dari publik; file ini cuma aktif selama ada di root.
 */

declare(strict_types=1);

require __DIR__ . '/scripts/seed.php';
