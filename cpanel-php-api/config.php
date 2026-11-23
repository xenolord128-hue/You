<?php
declare(strict_types=1);

if (basename($_SERVER['SCRIPT_FILENAME'] ?? '') === 'config.php') {
    http_response_code(403);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['ok' => false, 'error' => 'Direct access denied.']);
    exit;
}

/**
 * Loads server-only MySQL & Firebase verification settings from server environment
 * variables or an out-of-web-root env file (/home/pythoxwo/.pythox-mysql.env).
 */
function pythox_load_server_config(): array
{
    static $cached = null;
    if ($cached !== null) {
        return $cached;
    }

    $envMap = [];
    $candidatePaths = [];

    $homeParent = dirname(__DIR__, 2);
    if ($homeParent && $homeParent !== '/' && $homeParent !== '.') {
        $candidatePaths[] = $homeParent . '/.pythox-mysql.env';
    }
    if (!empty($_SERVER['DOCUMENT_ROOT'])) {
        $docParent = dirname(rtrim((string) $_SERVER['DOCUMENT_ROOT'], '/'));
        if ($docParent && $docParent !== '/' && $docParent !== '.') {
            $candidatePaths[] = $docParent . '/.pythox-mysql.env';
        }
    }

    foreach (array_unique($candidatePaths) as $envPath) {
        if (is_file($envPath) && is_readable($envPath)) {
            $lines = file($envPath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
            if (is_array($lines)) {
                foreach ($lines as $line) {
                    $trimmed = trim($line);
                    if ($trimmed === '' || str_starts_with($trimmed, '#')) {
                        continue;
                    }
                    $eqPos = strpos($trimmed, '=');
                    if ($eqPos === false) {
                        continue;
                    }
                    $key = trim(substr($trimmed, 0, $eqPos));
                    $val = trim(substr($trimmed, $eqPos + 1));
                    if (
                        (str_starts_with($val, '"') && str_ends_with($val, '"')) ||
                        (str_starts_with($val, "'") && str_ends_with($val, "'"))
                    ) {
                        $val = substr($val, 1, -1);
                    }
                    if ($key !== '') {
                        $envMap[$key] = $val;
                    }
                }
            }
            break;
        }
    }

    $readVar = static function (string $key, string $default = '') use ($envMap): string {
        $fromServer = $_SERVER[$key] ?? '';
        if (is_string($fromServer) && $fromServer !== '') {
            return $fromServer;
        }
        $fromGetenv = getenv($key);
        if (is_string($fromGetenv) && $fromGetenv !== '') {
            return $fromGetenv;
        }
        if (isset($envMap[$key]) && $envMap[$key] !== '') {
            return $envMap[$key];
        }
        return $default;
    };

    $portRaw = (int) $readVar('DB_PORT', '3306');
    $port = ($portRaw > 0 && $portRaw <= 65535) ? $portRaw : 3306;

    $cached = [
        'DB_HOST' => trim($readVar('DB_HOST', 'localhost')),
        'DB_NAME' => trim($readVar('DB_NAME', '')),
        'DB_USER' => trim($readVar('DB_USER', '')),
        'DB_PASSWORD' => $readVar('DB_PASSWORD', ''),
        'DB_PORT' => $port,
        'FIREBASE_WEB_API_KEY' => trim($readVar('FIREBASE_WEB_API_KEY', '')),
        'ALLOWED_ORIGINS' => trim($readVar(
            'ALLOWED_ORIGINS',
            'https://pythoxworld.com,https://www.pythoxworld.com,https://pythoxworld.netlify.app'
        )),
    ];

    return $cached;
}
