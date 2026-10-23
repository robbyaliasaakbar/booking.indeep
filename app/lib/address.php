<?php
/**
 * Validasi alamat TUNGGAL untuk semua jalur (issue #16):
 * - profil (POST/PATCH /api/addresses.php)
 * - wizard booking (POST /api/bookings-create.php, body `address: {...}`)
 *
 * Kontrak field resmi = snake_case (sesuai DB & profil). camelCase
 * (streetNo/mapsUrl) tetap diterima supaya bundle FE lama yang masih
 * ke-cache browser tidak patah saat deploy.
 *
 * Aturan seragam (keputusan #16): wajib jalan, kelurahan, kecamatan,
 * kota, provinsi; LABEL opsional maks 40; POSTAL opsional tapi wajib
 * 5 angka kalau diisi. Aturan lama profil (label & postal wajib) terlalu
 * ketat — alamat hasil wizard (tanpa label/postal) ditolak saat diedit,
 * customer terkunci.
 */

declare(strict_types=1);

/**
 * @return array{label: ?string, street_no: string, village: string,
 *   district: string, city: string, province: string, postal: ?string,
 *   note: ?string, maps_url: ?string, is_default: int}
 * Melempar json_error(400) kalau ada isian yang melanggar aturan.
 */
function address_validate(array $body): array
{
    // Terima snake_case (resmi) atau camelCase (legacy bundle FE)
    $pick = static fn (string $snake, string $camel): string
        => trim((string) ($body[$snake] ?? $body[$camel] ?? ''));

    $label    = $pick('label', 'label');
    $streetNo = $pick('street_no', 'streetNo');
    $village  = $pick('village', 'village');
    $district = $pick('district', 'district');
    $city     = $pick('city', 'city');
    $province = $pick('province', 'province');
    $postal   = $pick('postal', 'postal');
    $note     = $pick('note', 'note');
    $mapsUrl  = $pick('maps_url', 'mapsUrl');

    if ($label !== '' && mb_strlen($label) > 40) {
        json_error(400, 'address_invalid', 'Label alamat maksimal 40 karakter ya.');
    }
    if ($streetNo === '' || mb_strlen($streetNo) > 190) {
        // 190 = panjang kolom addresses.street_no — validasi jangan lewat schema
        json_error(400, 'address_invalid', 'Nama jalan dan nomor wajib diisi (maksimal 190 karakter) ya.');
    }
    if ($village === '' || mb_strlen($village) > 100) {
        json_error(400, 'address_invalid', 'Kelurahan/desa wajib diisi ya.');
    }
    if ($district === '' || mb_strlen($district) > 100) {
        json_error(400, 'address_invalid', 'Kecamatan wajib diisi ya.');
    }
    if ($city === '' || mb_strlen($city) > 100) {
        json_error(400, 'address_invalid', 'Kota wajib diisi ya.');
    }
    if ($province === '' || mb_strlen($province) > 100) {
        json_error(400, 'address_invalid', 'Provinsi wajib diisi ya.');
    }
    if ($postal !== '' && !preg_match('/^\d{5}$/', $postal)) {
        json_error(400, 'address_invalid', 'Kode pos harus 5 angka (atau dikosongkan) ya.');
    }
    if ($mapsUrl !== '' && !filter_var($mapsUrl, FILTER_VALIDATE_URL)) {
        json_error(400, 'address_invalid', 'Link Google Maps tidak valid ya.');
    }
    if (mb_strlen($note) > 255) {
        json_error(400, 'address_invalid', 'Catatan maksimal 255 karakter ya.');
    }

    return [
        'label'      => $label !== '' ? $label : null,
        'street_no'  => $streetNo,
        'village'    => $village,
        'district'   => $district,
        'city'       => $city,
        'province'   => $province,
        'postal'     => $postal !== '' ? $postal : null,
        'note'       => $note !== '' ? $note : null,
        'maps_url'   => $mapsUrl !== '' ? $mapsUrl : null,
        'is_default' => !empty($body['is_default']) ? 1 : 0,
    ];
}
