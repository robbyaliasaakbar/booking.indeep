<?php
/**
 * Helper audit log (PRD Bab 11 poin 9 dan 15.8).
 * created_at UTC sesuai PRD Bab 15. Tanpa FK — log tetap utuh.
 */

declare(strict_types=1);

function audit_log(
    int|string|null $actorId,
    string $actorRole,
    string $action,
    int|string|null $bookingId = null,
    ?string $fromStatus = null,
    ?string $toStatus = null,
    ?string $reason = null
): void {
    $stmt = db()->prepare(
        'INSERT INTO audit_logs (actor_id, actor_role, action, booking_id, from_status, to_status, reason, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, UTC_TIMESTAMP())'
    );
    $stmt->execute([
        $actorId !== null ? (int) $actorId : null,
        $actorRole,
        $action,
        $bookingId !== null ? (int) $bookingId : null,
        $fromStatus,
        $toStatus,
        $reason,
    ]);
}
