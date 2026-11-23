<?php
declare(strict_types=1);

require_once __DIR__ . '/auth.php';
require_once __DIR__ . '/db.php';

pythox_send_cors_and_security_headers();

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'GET') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'connected' => false, 'message' => 'Method not allowed.']);
    exit;
}

try {
    $pdo = pythox_get_pdo();
    $stmt = $pdo->prepare('SELECT 1 AS ok');
    $stmt->execute();
    $row = $stmt->fetch();

    if ($row && (int) ($row['ok'] ?? 0) === 1) {
        http_response_code(200);
        echo json_encode([
            'ok' => true,
            'connected' => true,
            'message' => 'MySQL database connection successful.',
        ]);
        exit;
    }

    http_response_code(503);
    echo json_encode([
        'ok' => false,
        'connected' => false,
        'message' => 'MySQL database test query returned an unexpected result.',
    ]);
} catch (Throwable $e) {
    error_log('[PYTHOX MySQL Test Error Code]: ' . (string) $e->getCode());
    http_response_code(503);
    echo json_encode([
        'ok' => false,
        'connected' => false,
        'message' => pythox_safe_mysql_error_message($e),
    ]);
}
