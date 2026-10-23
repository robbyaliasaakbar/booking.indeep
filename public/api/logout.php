<?php
/**
 * POST /api/logout.php — keluar dari sesi (PRD Bab 10.1).
 */

require __DIR__ . '/../../app/lib/bootstrap.php';
require __DIR__ . '/../../app/lib/session.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_error(405, 'method_not_allowed', 'Metode ini tidak didukung.');
}

session_boot();
logout_user();

json_response(['data' => ['ok' => true]]);
