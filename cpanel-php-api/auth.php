<?php
declare(strict_types=1);

if (basename($_SERVER['SCRIPT_FILENAME'] ?? '') === 'auth.php') {
    http_response_code(403);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['ok' => false, 'error' => 'Direct access denied.']);
    exit;
}

require_once __DIR__ . '/config.php';

function pythox_send_cors_and_security_headers(): void
{
    $cfg = pythox_load_server_config();
    $allowed = array_filter(array_map('trim', explode(',', $cfg['ALLOWED_ORIGINS'])));

    $origin = trim((string) ($_SERVER['HTTP_ORIGIN'] ?? ''));
    if ($origin !== '' && in_array(strtolower($origin), array_map('strtolower', $allowed), true)) {
        header('Access-Control-Allow-Origin: ' . $origin);
        header('Vary: Origin');
        header('Access-Control-Allow-Credentials: true');
        header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
        header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Firebase-Id-Token');
    }

    header('Content-Type: application/json; charset=utf-8');
    header('X-Content-Type-Options: nosniff');
    header('Referrer-Policy: strict-origin-when-cross-origin');
    header('Cache-Control: no-store');

    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') {
        http_response_code(204);
        exit;
    }
}

function pythox_extract_firebase_token(): string
{
    $headerToken = trim((string) ($_SERVER['HTTP_X_FIREBASE_ID_TOKEN'] ?? ''));
    if ($headerToken !== '') {
        return $headerToken;
    }
    $authHeader = trim((string) ($_SERVER['HTTP_AUTHORIZATION'] ?? ''));
    if (stripos($authHeader, 'Bearer ') === 0) {
        return trim(substr($authHeader, 7));
    }
    return '';
}

function pythox_require_verified_firebase_admin(): string
{
    $idToken = pythox_extract_firebase_token();
    if (strlen($idToken) < 40) {
        http_response_code(401);
        echo json_encode(['ok' => false, 'error' => 'Authentication required. Sign in with an authorized Google Admin account.']);
        exit;
    }

    $cfg = pythox_load_server_config();
    $apiKey = $cfg['FIREBASE_WEB_API_KEY'];
    if ($apiKey === '') {
        http_response_code(503);
        echo json_encode(['ok' => false, 'error' => 'Server Firebase verification key is not configured.']);
        exit;
    }

    $url = 'https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=' . rawurlencode($apiKey);
    $payload = json_encode(['idToken' => $idToken]);

    $responseBody = false;
    $statusCode = 0;

    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 8,
            CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
            CURLOPT_POSTFIELDS => $payload,
        ]);
        $responseBody = curl_exec($ch);
        $statusCode = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
    } else {
        $ctx = stream_context_create([
            'http' => [
                'method' => 'POST',
                'header' => "Content-Type: application/json\r\n",
                'content' => $payload,
                'timeout' => 8,
                'ignore_errors' => true,
            ],
        ]);
        $responseBody = @file_get_contents($url, false, $ctx);
        if (isset($http_response_header[0]) && preg_match('/\s(\d{3})\s/', $http_response_header[0], $m)) {
            $statusCode = (int) $m[1];
        }
    }

    if (!is_string($responseBody) || $statusCode !== 200) {
        http_response_code(401);
        echo json_encode(['ok' => false, 'error' => 'Invalid or expired Firebase authentication token.']);
        exit;
    }

    $decoded = json_decode($responseBody, true);
    $user = $decoded['users'][0] ?? null;
    if (!is_array($user)) {
        http_response_code(401);
        echo json_encode(['ok' => false, 'error' => 'Unauthorized user account.']);
        exit;
    }

    $email = strtolower(trim((string) ($user['email'] ?? '')));
    $verified = !empty($user['emailVerified']);
    $disabled = !empty($user['disabled']);
    $allowedAdmins = ['lord79915@gmail.com', 'pythoxfashion@gmail.com'];

    if ($disabled || !$verified || !in_array($email, $allowedAdmins, true)) {
        http_response_code(403);
        echo json_encode(['ok' => false, 'error' => 'Forbidden: verified admin email is required.']);
        exit;
    }

    return $email;
}
