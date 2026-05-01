<?php
declare(strict_types=1);

// Support both layouts:
// - vendor one level up (local dev: backend/vendor)
// - vendor in the same dir (shared hosting: public_html/vendor)
($autoload = __DIR__ . '/../vendor/autoload.php') && file_exists($autoload)
  ? require $autoload
  : require __DIR__ . '/vendor/autoload.php';

// Load env if present
$envPath = dirname(__DIR__);
if (file_exists($envPath . '/.env')) {
    Dotenv\Dotenv::createImmutable($envPath)->load();
}
// Also support .env in the current directory for shared hosting
if (file_exists(__DIR__ . '/.env')) {
    Dotenv\Dotenv::createImmutable(__DIR__)->load();
}

// Basic CORS for dev
// TODO: set to your deployed frontend origin in production
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: Content-Type');
header('Access-Control-Allow-Methods: GET, POST, PATCH, OPTIONS');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }

$router = new App\Core\Router();

// Health
$router->get('/api/health', function() {
    header('Content-Type: application/json');
    echo json_encode(['ok' => true, 'ts' => time()]);
});

// Tasks (scoped to a group)
$router->get('/api/groups/{id}/tasks', [App\Controllers\TaskController::class, 'list']);
$router->post('/api/groups/{id}/tasks', [App\Controllers\TaskController::class, 'create']);

$router->dispatch($_SERVER['REQUEST_METHOD'], $_SERVER['REQUEST_URI']);
