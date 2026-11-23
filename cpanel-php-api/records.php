<?php
declare(strict_types=1);

require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/db.php';

pythox_send_cors_and_security_headers();
$actorEmail = pythox_require_verified_firebase_admin();

$allowedCollections = [
    'products',
    'orders',
    'categories',
    'collections',
    'coupons',
    'reviews',
    'settings',
    'media',
    'notes',
];

$collection = strtolower(trim((string) ($_GET['collection'] ?? '')));
$id = trim((string) ($_GET['id'] ?? ''));

if (!in_array($collection, $allowedCollections, true)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'Invalid or unsupported MySQL collection name.']);
    exit;
}

if ($id !== '' && !preg_match('/^[a-zA-Z0-9_-]{1,120}$/', $id)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'Invalid record ID format.']);
    exit;
}

$method = strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET'));

try {
    $pdo = pythox_get_pdo();
    pythox_ensure_mysql_schema($pdo);

    if ($method === 'GET' && $id === '') {
        $limit = max(1, min(500, (int) ($_GET['limit'] ?? 100)));
        $offset = max(0, (int) ($_GET['offset'] ?? 0));
        $stmt = $pdo->prepare(
            "SELECT id, collection_name, payload, created_at, updated_at
             FROM pythox_records
             WHERE collection_name = ?
             ORDER BY updated_at DESC
             LIMIT $limit OFFSET $offset"
        );
        $stmt->execute([$collection]);
        $rows = $stmt->fetchAll();

        $records = array_map(static function (array $row): array {
            $decoded = json_decode((string) ($row['payload'] ?? '{}'), true);
            return [
                'id' => (string) $row['id'],
                'collection' => (string) $row['collection_name'],
                'data' => is_array($decoded) ? $decoded : [],
                'createdAt' => (string) $row['created_at'],
                'updatedAt' => (string) $row['updated_at'],
            ];
        }, $rows);

        echo json_encode(['ok' => true, 'collection' => $collection, 'count' => count($records), 'records' => $records]);
        exit;
    }

    if ($method === 'GET' && $id !== '') {
        $stmt = $pdo->prepare(
            'SELECT id, collection_name, payload, created_at, updated_at
             FROM pythox_records
             WHERE collection_name = ? AND id = ?
             LIMIT 1'
        );
        $stmt->execute([$collection, $id]);
        $row = $stmt->fetch();

        if (!$row) {
            http_response_code(404);
            echo json_encode(['ok' => false, 'error' => 'Record not found.']);
            exit;
        }

        $decoded = json_decode((string) ($row['payload'] ?? '{}'), true);
        echo json_encode([
            'ok' => true,
            'record' => [
                'id' => (string) $row['id'],
                'collection' => (string) $row['collection_name'],
                'data' => is_array($decoded) ? $decoded : [],
                'createdAt' => (string) $row['created_at'],
                'updatedAt' => (string) $row['updated_at'],
            ],
        ]);
        exit;
    }

    if ($method === 'POST' || $method === 'PUT') {
        $rawBody = file_get_contents('php://input');
        if (!is_string($rawBody) || strlen($rawBody) > 1048576) {
            http_response_code(413);
            echo json_encode(['ok' => false, 'error' => 'Request payload too large.']);
            exit;
        }
        $body = json_decode($rawBody, true);
        if (!is_array($body) || !isset($body['data']) || !is_array($body['data'])) {
            http_response_code(400);
            echo json_encode(['ok' => false, 'error' => 'Request body must include a JSON "data" object.']);
            exit;
        }

        $targetId = $id;
        if ($method === 'POST' && $targetId === '') {
            $candidate = trim((string) ($body['id'] ?? ''));
            $targetId = $candidate !== '' ? $candidate : ('rec-' . time() . '-' . bin2hex(random_bytes(3)));
        }

        if (!preg_match('/^[a-zA-Z0-9_-]{1,120}$/', $targetId)) {
            http_response_code(400);
            echo json_encode(['ok' => false, 'error' => 'Record ID must be 1–120 alphanumeric, underscore, or hyphen characters.']);
            exit;
        }

        $payloadData = $body['data'];
        $payloadData['id'] = $targetId;
        $jsonPayload = json_encode($payloadData, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        if (!is_string($jsonPayload) || strlen($jsonPayload) > 1000000) {
            http_response_code(400);
            echo json_encode(['ok' => false, 'error' => 'Invalid or oversized JSON data payload.']);
            exit;
        }

        $stmt = $pdo->prepare(
            'INSERT INTO pythox_records (id, collection_name, payload, created_by, updated_by)
             VALUES (?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
               payload = VALUES(payload),
               updated_by = VALUES(updated_by)'
        );
        $stmt->execute([$targetId, $collection, $jsonPayload, $actorEmail, $actorEmail]);

        $fetch = $pdo->prepare(
            'SELECT id, collection_name, payload, created_at, updated_at
             FROM pythox_records
             WHERE collection_name = ? AND id = ?
             LIMIT 1'
        );
        $fetch->execute([$collection, $targetId]);
        $saved = $fetch->fetch();
        $decodedSaved = is_array($saved) ? json_decode((string) $saved['payload'], true) : $payloadData;

        http_response_code($method === 'POST' ? 201 : 200);
        echo json_encode([
            'ok' => true,
            'record' => [
                'id' => $targetId,
                'collection' => $collection,
                'data' => is_array($decodedSaved) ? $decodedSaved : $payloadData,
                'createdAt' => (string) ($saved['created_at'] ?? ''),
                'updatedAt' => (string) ($saved['updated_at'] ?? ''),
            ],
        ]);
        exit;
    }

    if ($method === 'DELETE' && $id !== '') {
        $stmt = $pdo->prepare('DELETE FROM pythox_records WHERE collection_name = ? AND id = ?');
        $stmt->execute([$collection, $id]);

        if ($stmt->rowCount() === 0) {
            http_response_code(404);
            echo json_encode(['ok' => false, 'error' => 'Record not found.']);
            exit;
        }

        echo json_encode(['ok' => true, 'deleted' => true, 'id' => $id]);
        exit;
    }

    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'Unsupported HTTP method or missing record ID.']);
} catch (Throwable $e) {
    error_log('[PYTHOX MySQL CRUD Error Code]: ' . (string) $e->getCode());
    http_response_code(503);
    echo json_encode(['ok' => false, 'error' => pythox_safe_mysql_error_message($e)]);
}
