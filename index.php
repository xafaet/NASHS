<?php
/**
 * Nanupur Abu Sobhan High School Alumni Platform & 85th Reunion
 * cPanel Production Entry Point & Router
 *
 * Supports:
 *   1. Direct cPanel Apache / PHP 8.1+ Shared Hosting
 *   2. Laravel API Endpoints (/api/system/db-diagnostic, /api/appearance/animations, etc.)
 *   3. React SPA Delivery (dist/index.html) & Static Asset Serving
 */

define('APP_START_TIME', microtime(true));
define('BASE_PATH', __DIR__);
define('STORAGE_PATH', BASE_PATH . '/storage');

// Basic Security Headers
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: SAMEORIGIN');
header('X-XSS-Protection: 1; mode=block');

// Autoload application classes
if (file_exists(BASE_PATH . '/vendor/autoload.php')) {
    require_once BASE_PATH . '/vendor/autoload.php';
} else {
    // Built-in PSR-4 Autoloader for cPanel deployments without composer install
    spl_autoload_register(function ($class) {
        $prefix = 'App\\';
        $baseDir = BASE_PATH . '/app/';
        $len = strlen($prefix);
        if (strncmp($prefix, $class, $len) !== 0) return;
        $relativeClass = substr($class, $len);
        $file = $baseDir . str_replace('\\', '/', $relativeClass) . '.php';
        if (file_exists($file)) {
            require_once $file;
        }
    });
}

// Laravel Facade & Helper Shims for standalone cPanel execution without Composer vendor directory
if (!class_exists('Illuminate\Http\JsonResponse')) {
    eval('
    namespace Illuminate\Http {
        class JsonResponse {
            public $data;
            public $status;
            public $headers;
            public function __construct($data = null, $status = 200, array $headers = []) {
                $this->data = $data;
                $this->status = $status;
                $this->headers = $headers;
            }
            public function status() { return $this->status; }
            public function getData($assoc = true) { return $this->data; }
        }
        class Request {
            public $data;
            public function __construct($data = []) { $this->data = $data; }
            public function input($k, $d = null) { return $this->data[$k] ?? $d; }
            public function all() { return $this->data; }
            public function user() { return null; }
        }
    }
    namespace Illuminate\Support\Facades {
        class Log {
            public static function warning($m) { @error_log("[WARNING] " . $m); }
            public static function info($m) { @error_log("[INFO] " . $m); }
            public static function error($m) { @error_log("[ERROR] " . $m); }
        }
        class Cache {
            public static function remember($key, $ttl, $callback) { return $callback(); }
            public static function forget($key) { return true; }
        }
        class DB {
            public static function table($tbl) {
                return new class($tbl) {
                    private $table;
                    public function __construct($t) { $this->table = $t; }
                    public function where($c, $v) { return $this; }
                    public function first() { return null; }
                    public function updateOrInsert($w, $v) { return true; }
                };
            }
        }
        class Validator {
            public static function make($data, $rules) {
                return new class {
                    public function fails() { return false; }
                    public function validated() { return []; }
                    public function errors() {
                        return new class {
                            public function first() { return "Validation error"; }
                        };
                    }
                };
            }
        }
    }
    ');
}

if (!function_exists('response')) {
    function response() {
        return new class {
            public function json($data = [], $status = 200, array $headers = []) {
                return new \Illuminate\Http\JsonResponse($data, $status, $headers);
            }
        };
    }
}
if (!function_exists('base_path')) {
    function base_path($path = '') {
        return BASE_PATH . ($path ? '/' . ltrim($path, '/') : '');
    }
}
if (!function_exists('storage_path')) {
    function storage_path($path = '') {
        return STORAGE_PATH . ($path ? '/' . ltrim($path, '/') : '');
    }
}
if (!function_exists('app')) {
    function app() {
        return new class {
            public function environment() { return getenv('APP_ENV') ?: 'production'; }
            public function configurationIsCached() { return file_exists(BASE_PATH . '/bootstrap/cache/config.php'); }
        };
    }
}

// Ensure storage log directory exists
if (!is_dir(STORAGE_PATH . '/logs')) {
    @mkdir(STORAGE_PATH . '/logs', 0750, true);
}

// Request URI Parsing
$requestUri = $_SERVER['REQUEST_URI'] ?? '/';
$parsedPath = parse_url($requestUri, PHP_URL_PATH) ?? '/';

// Normalize script-relative paths on cPanel subdirectories
$scriptName = $_SERVER['SCRIPT_NAME'] ?? '';
$scriptDir = dirname($scriptName);
if ($scriptDir !== '/' && strpos($parsedPath, $scriptDir) === 0) {
    $parsedPath = substr($parsedPath, strlen($scriptDir));
    if (empty($parsedPath)) $parsedPath = '/';
}

// Strip leading index.php if present
if (strpos($parsedPath, '/index.php') === 0) {
    $parsedPath = substr($parsedPath, strlen('/index.php'));
    if (empty($parsedPath)) $parsedPath = '/';
}

// ====================================================================
// 1. STATIC ASSET SERVING
// ====================================================================

// Check if request points to an existing file in dist/
$distCandidate = BASE_PATH . '/dist' . $parsedPath;
if ($parsedPath !== '/' && file_exists($distCandidate) && !is_dir($distCandidate)) {
    return serveStaticFile($distCandidate);
}

// Explicit check for /assets/ bundle files
if (strpos($parsedPath, '/assets/') === 0) {
    $distAssetCandidate = BASE_PATH . '/dist' . $parsedPath;
    if (file_exists($distAssetCandidate) && !is_dir($distAssetCandidate)) {
        return serveStaticFile($distAssetCandidate);
    }
    $rootAssetCandidate = BASE_PATH . $parsedPath;
    if (file_exists($rootAssetCandidate) && !is_dir($rootAssetCandidate)) {
        return serveStaticFile($rootAssetCandidate);
    }
}

// Check if request points to public/uploads/ or uploads/
if (strpos($parsedPath, '/uploads/') === 0) {
    $uploadCandidate = BASE_PATH . '/public' . $parsedPath;
    if (file_exists($uploadCandidate) && !is_dir($uploadCandidate)) {
        return serveStaticFile($uploadCandidate);
    }
    $storageUploadCandidate = BASE_PATH . '/storage/app/public' . $parsedPath;
    if (file_exists($storageUploadCandidate) && !is_dir($storageUploadCandidate)) {
        return serveStaticFile($storageUploadCandidate);
    }
}

// ====================================================================
// 2. LARAVEL API CONTROLLER ENDPOINTS
// ====================================================================

// A. Database Diagnostics Endpoint (The user's requested endpoint)
if ($parsedPath === '/api/system/db-diagnostic' || $parsedPath === '/api/system/db-diagnostic/') {
    if ($_SERVER['REQUEST_METHOD'] === 'POST') {
        $controller = new \App\Http\Controllers\DatabaseDiagnosticController();
        $input = json_decode(file_get_contents('php://input'), true) ?: [];
        $fakeRequest = new class($input) {
            private $data;
            public function __construct($data) { $this->data = $data; }
            public function input($key, $default = null) { return $this->data[$key] ?? $default; }
            public function all() { return $this->data; }
        };
        $res = $controller->logDiagnostic($fakeRequest);
        header('Content-Type: application/json; charset=UTF-8');
        echo json_encode($res->getData(), JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
        exit;
    } else {
        $controller = new \App\Http\Controllers\DatabaseDiagnosticController();
        $fakeRequest = new class {
            public function input($k, $d = null) { return $d; }
            public function all() { return []; }
        };
        $res = $controller->diagnose($fakeRequest);
        http_response_code($res->status());
        header('Content-Type: application/json; charset=UTF-8');
        echo json_encode($res->getData(), JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
        exit;
    }
}

// B. Database Diagnostic Manual Log Endpoint
if ($parsedPath === '/api/system/db-diagnostic/log') {
    $controller = new \App\Http\Controllers\DatabaseDiagnosticController();
    $input = json_decode(file_get_contents('php://input'), true) ?: [];
    $fakeRequest = new class($input) {
        private $data;
        public function __construct($data) { $this->data = $data; }
        public function input($key, $default = null) { return $this->data[$key] ?? $default; }
        public function all() { return $this->data; }
    };
    $res = $controller->logDiagnostic($fakeRequest);
    header('Content-Type: application/json; charset=UTF-8');
    echo json_encode($res->getData(), JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
    exit;
}

// C. Appearance & Animations Engine Endpoint
if ($parsedPath === '/api/appearance/animations') {
    $controller = new \App\Http\Controllers\AnimationSettingsController();
    $fakeRequest = new class {
        public function input($k, $d = null) { return $d; }
        public function all() { return []; }
    };
    $res = $controller->index($fakeRequest);
    header('Content-Type: application/json; charset=UTF-8');
    echo json_encode($res->getData(), JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
    exit;
}

// D. Health Check
if ($parsedPath === '/api/health') {
    header('Content-Type: application/json; charset=UTF-8');
    echo json_encode([
        'status' => 'ok',
        'service' => 'Nanupur Abu Sobhan High School Alumni Platform',
        'anniversary' => '85th Anniversary Celebration 2027',
        'runtime' => 'cPanel PHP ' . PHP_VERSION,
        'time' => date('c'),
    ], JSON_PRETTY_PRINT);
    exit;
}

// ====================================================================
// 3. FRONTEND SPA FALLBACK (dist/index.html)
// ====================================================================

$spaIndex = BASE_PATH . '/dist/index.html';
if (file_exists($spaIndex)) {
    header('Content-Type: text/html; charset=UTF-8');
    readfile($spaIndex);
    exit;
}

// Fallback if dist/ has not been built yet
http_response_code(503);
header('Content-Type: text/html; charset=UTF-8');
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Nanupur Abu Sobhan High School Alumni Platform</title>
    <style>
        body { font-family: system-ui, -apple-system, sans-serif; background: #062413; color: #fff; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 20px; }
        .card { background: #0b381e; border: 1px solid #1a5a33; border-radius: 16px; padding: 32px; max-width: 540px; box-shadow: 0 20px 40px rgba(0,0,0,0.4); }
        h1 { font-size: 20px; margin-top: 0; color: #fde047; }
        p { font-size: 14px; line-height: 1.6; color: #cbd5e1; }
        code { background: #04140a; padding: 3px 6px; border-radius: 4px; color: #6ee7b7; font-family: monospace; }
        a.btn { display: inline-block; background: #15803d; color: #fff; padding: 10px 18px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 13px; margin-top: 12px; }
    </style>
</head>
<body>
    <div class="card">
        <h1>NASH Alumni Platform — cPanel Deployment Ready</h1>
        <p>The PHP backend and Laravel controllers are installed. The client frontend build <code>dist/index.html</code> was not detected in this directory.</p>
        <p>If you are running in cPanel Node.js Application Manager, please ensure <code>app.js</code> or <code>server.js</code> is selected as your application startup file.</p>
        <a href="api/system/db-diagnostic" class="btn">View Database Diagnostic Status</a>
    </div>
</body>
</html>
<?php
exit;

/**
 * Safely serve a static asset with accurate MIME type and cache headers.
 */
function serveStaticFile(string $filePath): void
{
    $ext = strtolower(pathinfo($filePath, PATHINFO_EXTENSION));
    $mimes = [
        'js'    => 'application/javascript; charset=UTF-8',
        'mjs'   => 'application/javascript; charset=UTF-8',
        'css'   => 'text/css; charset=UTF-8',
        'html'  => 'text/html; charset=UTF-8',
        'json'  => 'application/json; charset=UTF-8',
        'png'   => 'image/png',
        'jpg'   => 'image/jpeg',
        'jpeg'  => 'image/jpeg',
        'gif'   => 'image/gif',
        'svg'   => 'image/svg+xml',
        'ico'   => 'image/x-icon',
        'webp'  => 'image/webp',
        'woff'  => 'font/woff',
        'woff2' => 'font/woff2',
        'ttf'   => 'font/ttf',
        'pdf'   => 'application/pdf',
        'map'   => 'application/json',
    ];

    $mime = $mimes[$ext] ?? 'application/octet-stream';
    header('Content-Type: ' . $mime);
    header('Content-Length: ' . filesize($filePath));

    // Cache static assets with hash in filename for 30 days
    if (in_array($ext, ['js', 'css', 'woff', 'woff2', 'png', 'jpg', 'webp'])) {
        header('Cache-Control: public, max-age=2592000, immutable');
    } else {
        header('Cache-Control: public, max-age=3600');
    }

    readfile($filePath);
    exit;
}
