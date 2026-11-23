<?php
declare(strict_types=1);

if (basename($_SERVER['SCRIPT_FILENAME'] ?? '') === 'db.php') {
    http_response_code(403);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['ok' => false, 'error' => 'Direct access denied.']);
    exit;
}

require_once __DIR__ . '/config.php';

function pythox_get_pdo(): PDO
{
    static $pdo = null;
    if ($pdo instanceof PDO) {
        return $pdo;
    }

    $cfg = pythox_load_server_config();
    if (
        $cfg['DB_HOST'] === '' ||
        $cfg['DB_NAME'] === '' ||
        $cfg['DB_USER'] === '' ||
        $cfg['DB_PASSWORD'] === ''
    ) {
        throw new RuntimeException('MYSQL_NOT_CONFIGURED');
    }

    $dsn = sprintf(
        'mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4',
        $cfg['DB_HOST'],
        $cfg['DB_PORT'],
        $cfg['DB_NAME']
    );

    $pdo = new PDO($dsn, $cfg['DB_USER'], $cfg['DB_PASSWORD'], [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
        PDO::ATTR_TIMEOUT => 10,
    ]);

    return $pdo;
}

function pythox_ensure_mysql_schema(PDO $pdo): void
{
    static $done = false;
    if ($done) {
        return;
    }

    $pdo->exec('
        CREATE TABLE IF NOT EXISTS pythox_records (
          id VARCHAR(120) NOT NULL,
          collection_name VARCHAR(64) NOT NULL,
          payload LONGTEXT NOT NULL,
          created_by VARCHAR(160) NULL,
          updated_by VARCHAR(160) NULL,
          created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          PRIMARY KEY (collection_name, id),
          INDEX idx_collection_updated (collection_name, updated_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ');

    $done = true;
}

function pythox_safe_mysql_error_message(Throwable $e): string
{
    if ($e->getMessage() === 'MYSQL_NOT_CONFIGURED') {
        return 'MySQL database environment variables are not configured on the server.';
    }
    $code = (string) $e->getCode();
    if ($code === '1045' || str_contains($e->getMessage(), 'Access denied')) {
        return 'MySQL connection failed: database authentication was rejected.';
    }
    if ($code === '1049' || str_contains($e->getMessage(), 'Unknown database')) {
        return 'MySQL connection failed: target database was not found on the server.';
    }
    if ($code === '2002' || $code === '2003') {
        return 'MySQL connection failed: unable to reach localhost MySQL service.';
    }
    return 'MySQL connection failed. Verify server configuration and try again.';
}
