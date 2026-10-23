<?php
/**
 * Helper kalkulasi quote (PRD BR07: harga SELALU dari DB).
 * Dipakai bersama oleh public/api/quote.php dan bookings-create.php
 * supaya aturan validasi harga tidak duplikat dan tidak bisa beda.
 * Gagal validasi langsung balas JSON 400 lewat json_error().
 */

declare(strict_types=1);

/**
 * Jumlah seat dari string size SKU sofa:
 * "3 seat" -> 3, "2 seat" -> 2, "single"/"all size"/"besar"/"l" -> 1.
 * Dipakai surcharge per='seat' (Opsi B — keputusan Bang Rob, 12 Okt 2026).
 */
function seats_from_size(string $size): int
{
    if (preg_match('/(\d+)\s*seat/i', $size, $m)) {
        return max(1, (int) $m[1]);
    }
    return 1;
}

/**
 * @param array $items         [['skuId' => int, 'qty' => int], ...]
 * @param array $surchargeInput [['code' => string, 'qtyAffected' => int], ...] (boleh kosong)
 * @return array{items: array, surcharges: array, subtotal: int, surchargeTotal: int, total: int}
 */
function quote_calc(array $items, array $surchargeInput): array
{
    $pdo = db();

    // --- Peta SKU aktif ---
    $allSku = $pdo->query('SELECT sku_id, name, size, price, unit, category FROM pricelist WHERE is_active = 1')
        ->fetchAll();
    $skuMap = [];
    foreach ($allSku as $s) {
        $skuMap[(int) $s['sku_id']] = $s;
    }

    $subtotal = 0;
    $itemLines = [];
    $seenSku = [];
    foreach ($items as $row) {
        $skuId = (int) ($row['skuId'] ?? 0);
        $qty   = $row['qty'] ?? null;

        if (isset($seenSku[$skuId])) {
            json_error(400, 'sku_duplicate', 'Barangnya dobel di keranjang. Gabungkan qty-nya ya.');
        }
        $seenSku[$skuId] = true;

        if (!isset($skuMap[$skuId])) {
            json_error(400, 'sku_invalid', 'Ada barang yang tidak dikenal atau sudah tidak aktif. Muat ulang pricelist ya.');
        }

        // Qty: bulat, 1..100 (PRD Bab 17).
        if (!is_int($qty) && !(is_string($qty) && ctype_digit($qty))) {
            json_error(400, 'qty_invalid', 'Jumlah tiap barang harus angka bulat 1 sampai 100 ya.');
        }
        $qty = (int) $qty;
        if ($qty < 1 || $qty > 100) {
            json_error(400, 'qty_invalid', 'Jumlah tiap barang harus angka bulat 1 sampai 100 ya.');
        }

        $sku   = $skuMap[$skuId];
        $price = (int) $sku['price'];
        $line  = $price * $qty;
        $subtotal += $line;

        $itemLines[] = [
            'skuId'     => $skuId,
            'name'      => $sku['name'],
            'size'      => $sku['size'],
            'unit'      => $sku['unit'],
            'category'  => $sku['category'],
            'price'     => $price,
            'qty'       => $qty,
            'lineTotal' => $line,
        ];
    }

    // --- Total seat sofa di keranjang (untuk surcharge per='seat') ---
    $totalSeatSofa = 0;
    foreach ($itemLines as $it) {
        if (stripos((string) $it['category'], 'sofa') === 0) {
            $totalSeatSofa += seats_from_size((string) $it['size']) * $it['qty'];
        }
    }

    // --- Peta surcharge aktif ---
    $activeSur = $pdo->query('SELECT code, title, amount, per FROM surcharges WHERE is_active = 1')
        ->fetchAll();
    $surMap = [];
    foreach ($activeSur as $s) {
        $surMap[$s['code']] = $s;
    }

    $surchargeTotal = 0;
    $surLines = [];
    if (is_array($surchargeInput) && $surchargeInput !== []) {
        $seenCode = [];
        foreach ($surchargeInput as $row) {
            $code = trim((string) ($row['code'] ?? ''));
            $qtyAffected = $row['qtyAffected'] ?? null;

            if (isset($seenCode[$code])) {
                json_error(400, 'surcharge_duplicate', 'Biaya tambahan sama dobel. Cek lagi ya.');
            }
            $seenCode[$code] = true;

            if (!isset($surMap[$code])) {
                json_error(400, 'surcharge_invalid', 'Biaya tambahan tidak dikenal. Muat ulang halaman ya.');
            }

            if (!is_int($qtyAffected) && !(is_string($qtyAffected) && ctype_digit($qtyAffected))) {
                json_error(400, 'qty_invalid', 'Jumlah biaya tambahan harus angka bulat 1 sampai 100 ya.');
            }
            $qtyAffected = (int) $qtyAffected;
            if ($qtyAffected < 1 || $qtyAffected > 100) {
                json_error(400, 'qty_invalid', 'Jumlah biaya tambahan harus angka bulat 1 sampai 100 ya.');
            }

            $sur  = $surMap[$code];

            // Surcharge per='seat' (Opsi B): qtyAffected wajib = total seat sofa
            // di keranjang. Cegah user kirim qtyAffected asal — hitungan seat
            // dihitung ulang dari size SKU, bukan dipercaya dari frontend.
            if ($sur['per'] === 'seat' && $qtyAffected !== $totalSeatSofa) {
                json_error(400, 'surcharge_qty_mismatch', 'Jumlah seat biaya tambahan harus sesuai jumlah seat sofa yang dipilih ya.');
            }

            $line = (int) $sur['amount'] * $qtyAffected;
            $surchargeTotal += $line;

            $surLines[] = [
                'code'         => $code,
                'title'        => $sur['title'],
                'per'          => $sur['per'],
                'amount'       => (int) $sur['amount'],
                'qtyAffected'  => $qtyAffected,
                'lineTotal'    => $line,
            ];
        }
    }

    return [
        'items'          => $itemLines,
        'surcharges'     => $surLines,
        'subtotal'       => $subtotal,
        'surchargeTotal' => $surchargeTotal,
        'total'          => $subtotal + $surchargeTotal,
    ];
}
