<?php
/**
 * Seed database App InDeep Booking (PRD Bab 3 dan 20).
 *
 * Isi:
 * 1. Bikin tabel dari scripts/schema.sql (idempoten, CREATE TABLE IF NOT EXISTS)
 * 2. 44 SKU pricelist resmi (PRD Bab 6) — harga selalu dari sini (BR07)
 * 3. 3 aturan biaya tambahan (PRD Bab 7)
 * 4. Admin dev (PRD Bab 10.2): username & password dari SEED_ADMIN_USERNAME /
 *    SEED_ADMIN_PASSWORD — wajib diisi di config/config.php, tidak ada default di repo
 *
 * Sifat: idempoten. Jalankan berulang aman — data yang sudah ada TIDAK ditimpa
 * (harga yang sudah diedit admin atau password yang sudah diganti tetap menang).
 *
 * Cara jalan:
 *   npm run seed
 *   atau: docker compose run --rm php php scripts/seed.php
 */

declare(strict_types=1);

// Path detect: lokal (scripts/ di bawah root project) maupun Hostinger
// (file dijalankan dari root app-booking via scripts/seed-web.php).
$root = is_dir(__DIR__ . '/../app/lib') ? dirname(__DIR__) : __DIR__;
require $root . '/app/lib/bootstrap.php';

/** @var PDO $pdo */
$pdo = db();

// ---------------------------------------------------------------
// 1. Schema (idempoten)
// ---------------------------------------------------------------
$schema = file_get_contents($root . '/scripts/schema.sql');
if ($schema === false) {
    fwrite(STDERR, "Gagal baca scripts/schema.sql\n");
    exit(1);
}

$statements = array_filter(array_map('trim', explode(';', $schema)));
foreach ($statements as $statement) {
    $pdo->exec($statement);
}
echo '[1/4] Schema OK — 10 tabel siap (InnoDB, utf8mb4)' . PHP_EOL;

// ---------------------------------------------------------------
// 2. Pricelist 44 SKU (PRD Bab 6) — urut per kategori Bab 5.3
//    [sku_id, name, size, price, unit, category]
// ---------------------------------------------------------------
$pricelist = [
    // Bab 6.1 — kasur dan dipan
    [1,  'kasur',              '200',                  300000, 'pcs',          'kasur'],
    [2,  'kasur',              '180',                  270000, 'pcs',          'kasur'],
    [3,  'kasur',              '160',                  250000, 'pcs',          'kasur'],
    [4,  'kasur',              '140',                  230000, 'pcs',          'kasur'],
    [5,  'kasur',              '120',                  200000, 'pcs',          'kasur'],
    [6,  'kasur',              '100',                  170000, 'pcs',          'kasur'],
    [7,  'kasur',              '90',                   150000, 'pcs',          'kasur'],
    [8,  'dipan',              '200',                  210000, 'pcs',          'dipan'],
    [9,  'dipan',              '180',                  190000, 'pcs',          'dipan'],
    [10, 'dipan',              '160',                  175000, 'pcs',          'dipan'],
    [11, 'dipan',              '140',                  160000, 'pcs',          'dipan'],
    [12, 'dipan',              '120',                  140000, 'pcs',          'dipan'],
    [13, 'dipan',              '100',                  120000, 'pcs',          'dipan'],
    [14, 'dipan',              '90',                   100000, 'pcs',          'dipan'],
    // Bab 6.2 — headboard sampai kursi
    [15, 'headboard',          'all size',              70000, 'pcs',          'headboard'],
    [16, 'bantal',             'all size',              20000, 'pcs',          'bantal dan guling'],
    [17, 'guling',             'all size',              20000, 'pcs',          'bantal dan guling'],
    [18, 'sofa',               'single',                70000, 'pcs',          'sofa family'],
    [19, 'sofa',               '2 seat',               145000, 'pcs',          'sofa family'],
    [20, 'sofa',               '3 seat',               220000, 'pcs',          'sofa family'],
    [21, 'sofabed',            'all size',             250000, 'pcs',          'sofa family'],
    [22, 'sofabed',            'besar',                290000, 'pcs',          'sofa family'],
    [23, 'sofa',               'l',                    335000, 'pcs',          'sofa family'],
    [24, 'sofa',               'l besar',              400000, 'pcs',          'sofa family'],
    [25, 'recline',            'all size',             110000, 'pcs',          'sofa family'],
    [26, 'stool',              'all size',              50000, 'pcs',          'kursi family'],
    [27, 'stool',              'big besar panjang long', 80000, 'pcs',        'kursi family'],
    [28, 'kursi makan',        'all size',              50000, 'pcs',          'kursi family'],
    [29, 'kursi kerja',        'all size',              50000, 'pcs',          'kursi family'],
    [30, 'kursi rias',         'all size',              50000, 'pcs',          'kursi family'],
    [31, 'kursi gaming',       'all size',              80000, 'pcs',          'kursi family'],
    // Bab 6.3 — karpet, gordyn, baby, mobil
    [32, 'matras',             '1 m2',                  45000, 'm2',           'karpet dan gordyn family'],
    [33, 'karpet',             '1 m2',                  25000, 'm2',           'karpet dan gordyn family'],
    [34, 'karpet tangga',      'anak tangga',           20000, 'anak tangga',  'karpet dan gordyn family'],
    [35, 'gordyn curtain',     '1 m2',                  15000, 'm2',           'karpet dan gordyn family'],
    [36, 'vitrase',            '1 m2',                  10000, 'm2',           'karpet dan gordyn family'],
    [37, 'stroller',           'all size',              70000, 'pcs',          'baby stuff'],
    [38, 'baby car seat',      'all size',              55000, 'pcs',          'baby stuff'],
    [39, 'interior mobil bawah',     '2 baris',        380000, 'pcs',          'interior mobil'],
    [40, 'interior mobil bawah',     '3 baris',        500000, 'pcs',          'interior mobil'],
    [41, 'bagasi khusus sedan',      'all size',        80000, 'pcs',          'interior mobil'],
    [42, 'interior mobil atas plafon', '2 baris',      200000, 'pcs',          'interior mobil'],
    [43, 'interior mobil atas plafon', '3 baris',      300000, 'pcs',          'interior mobil'],
    [44, 'sunroof',            'all size',             180000, 'pcs',          'interior mobil'],
];

$insertSku = $pdo->prepare(
    'INSERT INTO pricelist (sku_id, service, name, size, price, unit, category)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE sku_id = sku_id' // no-op: harga yang sudah diedit admin menang
);
foreach ($pricelist as [$skuId, $name, $size, $price, $unit, $category]) {
    $insertSku->execute([$skuId, 'wet clean', $name, $size, $price, $unit, $category]);
}
echo '[2/4] Pricelist OK — 44 SKU masuk' . PHP_EOL;

// ---------------------------------------------------------------
// 3. Surcharge 3 aturan (PRD Bab 7)
// ---------------------------------------------------------------
$surcharges = [
    ['LATEX',          'Kasur Latex',       'Semua kasur semua ukuran bila berbahan latex full atau parsial', 40000, 'pcs'],
    ['SOFA_WIDE',      'Sofa lebar',        'Sofa dengan lebar lebih dari 75 cm',                              20000, 'seat'],
    ['SOFA_KNOCKDOWN', 'Sofa lepas pasang', 'Sofa dengan sistem bantalan lepas pasang',                        20000, 'seat'],
];

$insertSur = $pdo->prepare(
    'INSERT INTO surcharges (code, title, note, amount, per)
     VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE code = code'
);
foreach ($surcharges as [$code, $title, $note, $amount, $per]) {
    $insertSur->execute([$code, $title, $note, $amount, $per]);
}
echo '[3/4] Surcharge OK — 3 aturan masuk' . PHP_EOL;

// ---------------------------------------------------------------
// 4. Admin default (PRD Bab 10.2)
//    Argon2id bila tersedia, fallback bcrypt cost 12.
// ---------------------------------------------------------------
$adminUser = (string) config('SEED_ADMIN_USERNAME');
$adminPass = (string) config('SEED_ADMIN_PASSWORD');

if ($adminUser === '' || $adminPass === '') {
    fwrite(STDERR, 'SEED_ADMIN_USERNAME / SEED_ADMIN_PASSWORD belum diisi di config/config.php.' . PHP_EOL);
    fwrite(STDERR, 'Isi sendiri dulu — repo sengaja tidak menyimpan default password.' . PHP_EOL);
    exit(1);
}

$algos = function_exists('password_algos') ? password_algos() : [];
if (in_array('argon2id', $algos, true)) {
    $hash  = password_hash($adminPass, PASSWORD_ARGON2ID);
    $algoName = 'Argon2id';
} else {
    $hash  = password_hash($adminPass, PASSWORD_BCRYPT, ['cost' => 12]);
    $algoName = 'bcrypt cost 12';
}

// INSERT IGNORE: kalau username sudah ada (mis. password sudah diganti manual),
// baris lama dibiarkan — seed tidak pernah nimpa.
$insertAdmin = $pdo->prepare(
    "INSERT IGNORE INTO users (role, name, username, password_hash, profile_complete)
     VALUES ('superadmin', ?, ?, ?, 1)"
);
$insertAdmin->execute(['Bang Rob', $adminUser, $hash]);
echo '[4/4] Admin OK — username "' . $adminUser . '", hash ' . $algoName . PHP_EOL;

// ---------------------------------------------------------------
// Ringkasan
// ---------------------------------------------------------------
$skuCount  = (int) $pdo->query('SELECT COUNT(*) FROM pricelist WHERE is_active = 1')->fetchColumn();
$surCount  = (int) $pdo->query('SELECT COUNT(*) FROM surcharges WHERE is_active = 1')->fetchColumn();
$adminCount = (int) $pdo->query("SELECT COUNT(*) FROM users WHERE role IN ('admin','superadmin')")->fetchColumn();

echo PHP_EOL . 'SEED SELESAI' . PHP_EOL;
echo '  Pricelist aktif : ' . $skuCount . ' SKU (harus 44)' . PHP_EOL;
echo '  Surcharge aktif : ' . $surCount . ' aturan (harus 3)' . PHP_EOL;
echo '  Admin tersedia  : ' . $adminCount . ' akun' . PHP_EOL;
echo PHP_EOL . 'Login admin: /admin/login | username: ' . $adminUser . ' | password: (yang kamu isi di SEED_ADMIN_PASSWORD)' . PHP_EOL;
