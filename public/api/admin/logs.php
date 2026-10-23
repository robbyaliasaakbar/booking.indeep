<?php
/**
 * GET /api/admin/logs.php?page=&limit=&action=&booking_id=&actor_id= — audit log (PRD Bab 16.3).
 * created_at UTC sesuai PRD Bab 15.
 */

require __DIR__ . '/../../../app/lib/bootstrap.php';
require __DIR__ . '/../../../app/lib/session.php';

require_role('admin', 'superadmin');

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    json_error(405, 'method_not_allowed', 'Metode ini tidak didukung.');
}

$pdo = db();

$page  = max(1, (int) ($_GET['page'] ?? 1));
$limit = min(100, max(1, (int) ($_GET['limit'] ?? 20)));
$offset = ($page - 1) * $limit;
$action = trim((string) ($_GET['action'] ?? ''));
$bookingId = (int) ($_GET['booking_id'] ?? 0);
$actorId = (int) ($_GET['actor_id'] ?? 0);

$where = '1=1';
$params = [];
if ($action !== '') {
    $where .= ' AND a.action = ?';
    $params[] = $action;
}
if ($bookingId > 0) {
    $where .= ' AND a.booking_id = ?';
    $params[] = $bookingId;
}
if ($actorId > 0) {
    $where .= ' AND a.actor_id = ?';
    $params[] = $actorId;
}

$cnt = $pdo->prepare("SELECT COUNT(*) FROM audit_logs a WHERE $where");
$cnt->execute($params);
$total = (int) $cnt->fetchColumn();
$totalPages = max(1, (int) ceil($total / $limit));
if ($page > $totalPages) {
    $page = $totalPages;
    $offset = ($page - 1) * $limit;
}

$st = $pdo->prepare(
    "SELECT a.id, a.actor_id, a.actor_role, a.action, a.booking_id,
            a.from_status, a.to_status, a.reason, a.created_at
     FROM audit_logs a
     WHERE $where
     ORDER BY a.id DESC
     LIMIT $limit OFFSET $offset"
);
$st->execute($params);
$rows = $st->fetchAll();
foreach ($rows as &$r) {
    $r['id'] = (int) $r['id'];
    $r['actor_id'] = $r['actor_id'] !== null ? (int) $r['actor_id'] : null;
    $r['booking_id'] = $r['booking_id'] !== null ? (int) $r['booking_id'] : null;
}
unset($r);

json_response(['data' => [
    'total' => $total,
    'page' => $page,
    'limit' => $limit,
    'totalPages' => $totalPages,
    'count' => count($rows),
    'data' => $rows,
]]);
