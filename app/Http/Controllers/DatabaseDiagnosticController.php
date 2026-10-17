<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use PDO;
use Exception;

/**
 * DatabaseDiagnosticController
 *
 * Diagnostic controller endpoint in Laravel that logs the current database
 * connection settings (excluding the password) and reports the origin of the
 * credentials to a secure internal log file, helping pinpoint why it
 * occasionally falls back to 'root'@'localhost'.
 *
 * Route:
 *   GET  /api/system/db-diagnostic
 *   POST /api/system/db-diagnostic/log
 */
class DatabaseDiagnosticController extends Controller
{
    /**
     * Relative path to the secure internal diagnostic log file.
     */
    protected const LOG_FILE_RELATIVE = 'logs/database-connection-diagnostic.log';

    /**
     * Handle incoming diagnostic request.
     *
     * @param Request $request
     * @return JsonResponse
     */
    public function diagnose(Request $request): JsonResponse
    {
        $report = $this->collectDiagnosticData();

        // Write report to the secure internal log file
        $logWritten = $this->writeToInternalLog($report);
        $report['log_file_written'] = $logWritten;

        // Determine HTTP status: 503 if fallback to root or connection failed, 200 otherwise
        $statusCode = 200;
        if (!$report['connection_test']['connected'] || $report['root_fallback_risk']['is_currently_root']) {
            $statusCode = 503;
        }

        return response()->json($report, $statusCode, [
            'Content-Type' => 'application/json',
            'X-Diagnostic-Status' => $report['status'],
        ]);
    }

    /**
     * Explicit trigger to force-log diagnostic data with custom metadata.
     *
     * @param Request $request
     * @return JsonResponse
     */
    public function logDiagnostic(Request $request): JsonResponse
    {
        $context = $request->input('context', 'manual_trigger');
        $report = $this->collectDiagnosticData(['trigger_context' => $context]);

        $logWritten = $this->writeToInternalLog($report);
        $report['log_file_written'] = $logWritten;

        return response()->json([
            'success' => true,
            'message' => 'Database connection diagnostics recorded to secure internal log.',
            'log_path' => 'storage/' . self::LOG_FILE_RELATIVE,
            'status' => $report['status'],
            'summary' => [
                'driver' => $report['active_configuration']['driver'] ?? 'unknown',
                'host' => $report['active_configuration']['host'] ?? 'unknown',
                'database' => $report['active_configuration']['database'] ?? 'unknown',
                'user' => $report['active_configuration']['username'] ?? 'unknown',
                'is_root' => $report['root_fallback_risk']['is_currently_root'] ?? false,
                'connected' => $report['connection_test']['connected'] ?? false,
            ],
        ]);
    }

    /**
     * Collect comprehensive database connection settings and credential origins.
     *
     * @param array $extraContext
     * @return array
     */
    public function collectDiagnosticData(array $extraContext = []): array
    {
        $timestamp = date('c');
        $basePath = function_exists('base_path') ? base_path() : dirname(__DIR__, 2);
        $envPath = function_exists('base_path') ? base_path('.env') : $basePath . '/.env';
        $configCachePath = function_exists('base_path') ? base_path('bootstrap/cache/config.php') : $basePath . '/bootstrap/cache/config.php';

        // 1. Inspect direct disk .env file
        $dotEnvData = $this->parseDotEnvFile($envPath);

        // 2. Determine default connection name
        $defaultConnName = function_exists('config') ? config('database.default', 'mysql') : (getenv('DB_CONNECTION') ?: 'mysql');

        // 3. Resolve active config array
        $activeConfig = [];
        if (function_exists('config')) {
            $activeConfig = config("database.connections.{$defaultConnName}", []);
        }

        // If config is empty (e.g. non-Laravel bootstrap), construct from runtime
        if (empty($activeConfig)) {
            $activeConfig = [
                'driver'   => getenv('DB_CONNECTION') ?: ($dotEnvData['data']['DB_CONNECTION'] ?? 'mysql'),
                'host'     => getenv('DB_HOST') ?: ($dotEnvData['data']['DB_HOST'] ?? '127.0.0.1'),
                'port'     => getenv('DB_PORT') ?: ($dotEnvData['data']['DB_PORT'] ?? '3306'),
                'database' => getenv('DB_DATABASE') ?: ($dotEnvData['data']['DB_DATABASE'] ?? ''),
                'username' => getenv('DB_USERNAME') ?: ($dotEnvData['data']['DB_USERNAME'] ?? ''),
                'password' => getenv('DB_PASSWORD') !== false ? getenv('DB_PASSWORD') : ($dotEnvData['data']['DB_PASSWORD'] ?? ''),
            ];
        }

        // 4. Sanitize active configuration (EXCLUDE PASSWORD!)
        $sanitizedConfig = [
            'connection_name' => $defaultConnName,
            'driver'          => $activeConfig['driver'] ?? 'mysql',
            'host'            => $activeConfig['host'] ?? '127.0.0.1',
            'port'            => (int)($activeConfig['port'] ?? 3306),
            'database'        => $activeConfig['database'] ?? '',
            'username'        => $activeConfig['username'] ?? '',
            'password_meta'   => [
                'is_set'            => isset($activeConfig['password']) && $activeConfig['password'] !== '' && $activeConfig['password'] !== null,
                'length'            => isset($activeConfig['password']) ? strlen((string)$activeConfig['password']) : 0,
                'has_whitespace'    => isset($activeConfig['password']) && preg_match('/\s/', (string)$activeConfig['password']) === 1,
                'has_special_chars' => isset($activeConfig['password']) && preg_match('/[!@#$%^&*(),.?":{}|<>]/', (string)$activeConfig['password']) === 1,
            ],
            'charset'         => $activeConfig['charset'] ?? 'utf8mb4',
            'collation'       => $activeConfig['collation'] ?? 'utf8mb4_unicode_ci',
            'unix_socket'     => $activeConfig['unix_socket'] ?? null,
        ];

        // 5. Credential Origins Analysis
        $origins = [
            'DB_CONNECTION' => $this->inspectVariableOrigin('DB_CONNECTION', $dotEnvData['data'] ?? [], $sanitizedConfig['driver']),
            'DB_HOST'       => $this->inspectVariableOrigin('DB_HOST', $dotEnvData['data'] ?? [], $sanitizedConfig['host']),
            'DB_PORT'       => $this->inspectVariableOrigin('DB_PORT', $dotEnvData['data'] ?? [], (string)$sanitizedConfig['port']),
            'DB_DATABASE'   => $this->inspectVariableOrigin('DB_DATABASE', $dotEnvData['data'] ?? [], $sanitizedConfig['database']),
            'DB_USERNAME'   => $this->inspectVariableOrigin('DB_USERNAME', $dotEnvData['data'] ?? [], $sanitizedConfig['username']),
            'DB_PASSWORD'   => [
                'in_getenv'     => getenv('DB_PASSWORD') !== false,
                'in_server'     => isset($_SERVER['DB_PASSWORD']),
                'in_env_global' => isset($_ENV['DB_PASSWORD']),
                'in_dotenv_file'=> isset($dotEnvData['data']['DB_PASSWORD']),
                'is_empty_in_dotenv' => isset($dotEnvData['data']['DB_PASSWORD']) && $dotEnvData['data']['DB_PASSWORD'] === '',
                'is_quoted_in_dotenv'=> isset($dotEnvData['quoted']['DB_PASSWORD']) ? $dotEnvData['quoted']['DB_PASSWORD'] : false,
            ],
        ];

        // 6. Root Fallback Risk Assessment & Root Cause Identification
        $rootFallbackRisk = $this->assessRootFallbackRisk($sanitizedConfig, $dotEnvData, $configCachePath, $envPath);

        // 7. Test Live Database Connectivity (Non-destructive)
        $connectionTest = $this->testConnectivity($sanitizedConfig, $activeConfig['password'] ?? '');

        // 8. Overall System Status
        $overallStatus = 'OPERATIONAL';
        if ($rootFallbackRisk['is_currently_root']) {
            $overallStatus = 'ROOT_FALLBACK_DETECTED';
        } elseif (!$connectionTest['connected']) {
            $overallStatus = 'CONNECTION_FAILED';
        } elseif (!empty($rootFallbackRisk['critical_warnings'])) {
            $overallStatus = 'HIGH_RISK_WARNING';
        }

        return [
            'status'                     => $overallStatus,
            'timestamp'                  => $timestamp,
            'environment'                => [
                'php_version' => PHP_VERSION,
                'sapi_name'   => php_sapi_name(),
                'server_software' => $_SERVER['SERVER_SOFTWARE'] ?? 'CLI/Unknown',
                'app_env'     => function_exists('app') && method_exists(app(), 'environment') ? app()->environment() : (getenv('APP_ENV') ?: 'production'),
                'current_os_user' => function_exists('get_current_user') ? get_current_user() : 'unknown',
            ],
            'active_configuration'       => $sanitizedConfig,
            'credential_origins'         => $origins,
            'dotenv_file_audit'          => [
                'exists'          => $dotEnvData['exists'],
                'path'            => $envPath,
                'is_readable'     => $dotEnvData['is_readable'],
                'permissions'     => $dotEnvData['permissions'],
                'size_bytes'      => $dotEnvData['size'],
                'modified_at'     => $dotEnvData['modified_at'],
                'has_db_username' => isset($dotEnvData['data']['DB_USERNAME']),
                'has_db_password' => isset($dotEnvData['data']['DB_PASSWORD']),
                'parse_errors'    => $dotEnvData['errors'],
            ],
            'config_cache_audit'         => [
                'cache_file_exists' => file_exists($configCachePath),
                'path'              => $configCachePath,
                'modified_at'       => file_exists($configCachePath) ? date('c', filemtime($configCachePath)) : null,
                'is_cached'         => function_exists('app') && method_exists(app(), 'configurationIsCached') ? app()->configurationIsCached() : file_exists($configCachePath),
            ],
            'root_fallback_risk'         => $rootFallbackRisk,
            'connection_test'            => $connectionTest,
            'context'                    => $extraContext,
        ];
    }

    /**
     * Inspect which layer supplied a given configuration variable.
     *
     * @param string $varName
     * @param array $dotEnv
     * @param mixed $activeVal
     * @return array
     */
    protected function inspectVariableOrigin(string $varName, array $dotEnv, $activeVal): array
    {
        $inGetEnv = getenv($varName);
        $inServer = $_SERVER[$varName] ?? null;
        $inEnv = $_ENV[$varName] ?? null;
        $inDotEnv = $dotEnv[$varName] ?? null;

        $primarySource = 'DEFAULT_OR_FALLBACK';
        if ($inServer !== null && $inServer === $activeVal) {
            $primarySource = '$_SERVER';
        } elseif ($inEnv !== null && $inEnv === $activeVal) {
            $primarySource = '$_ENV';
        } elseif ($inGetEnv !== false && $inGetEnv === $activeVal) {
            $primarySource = 'getenv()';
        } elseif ($inDotEnv !== null && $inDotEnv === $activeVal) {
            $primarySource = '.env file';
        }

        return [
            'active_value'   => $activeVal,
            'primary_source' => $primarySource,
            'layers'         => [
                'dotenv_file' => $inDotEnv !== null ? $inDotEnv : null,
                'getenv'      => $inGetEnv !== false ? $inGetEnv : null,
                '$_ENV'       => $inEnv !== null ? $inEnv : null,
                '$_SERVER'    => $inServer !== null ? $inServer : null,
            ],
            'is_inconsistent' => ($inDotEnv !== null && $activeVal !== null && (string)$inDotEnv !== (string)$activeVal),
        ];
    }

    /**
     * Deep risk assessment to pinpoint root@localhost fallback causes.
     *
     * @param array $config
     * @param array $dotEnvData
     * @param string $configCachePath
     * @param string $envPath
     * @return array
     */
    protected function assessRootFallbackRisk(array $config, array $dotEnvData, string $configCachePath, string $envPath): array
    {
        $warnings = [];
        $recommendations = [];
        $isCurrentlyRoot = ($config['username'] === 'root' || $config['username'] === '');

        if ($isCurrentlyRoot) {
            $warnings[] = "CRITICAL: Database username is currently resolved to '" . ($config['username'] ?: 'empty') . "'.";
            if (!$config['password_meta']['is_set']) {
                $warnings[] = "CRITICAL: No password supplied, matching error: Access denied for user 'root'@'localhost' (using password: NO).";
            }
        }

        // Cause 1: Stale configuration cache
        if (file_exists($configCachePath)) {
            $cacheMtime = filemtime($configCachePath);
            $envMtime = file_exists($envPath) ? filemtime($envPath) : 0;

            if ($envMtime > $cacheMtime) {
                $warnings[] = "STALE CONFIG CACHE: bootstrap/cache/config.php was compiled before .env was last updated. Cached defaults may override .env.";
                $recommendations[] = "Run 'php artisan config:clear' or delete bootstrap/cache/config.php on cPanel.";
            }

            // In Laravel, env() returns null when config is cached
            $warnings[] = "CONFIG CACHED: In Laravel, calling env() after config:cache always returns NULL. Ensure all code reads from config() instead of env().";
        }

        // Cause 2: Missing or unreadable .env file
        if (!$dotEnvData['exists']) {
            $warnings[] = "MISSING .ENV: .env file does not exist at expected path ({$envPath}).";
            $recommendations[] = "Create production .env from .env.example with correct cPanel database credentials.";
        } elseif (!$dotEnvData['is_readable']) {
            $warnings[] = "PERMISSIONS ERROR: .env exists but is not readable by PHP user (" . (function_exists('get_current_user') ? get_current_user() : 'web') . ").";
            $recommendations[] = "Run 'chmod 644 .env' in your cPanel file manager.";
        }

        // Cause 3: Missing DB_USERNAME or DB_PASSWORD in .env
        if ($dotEnvData['exists'] && $dotEnvData['is_readable']) {
            if (!isset($dotEnvData['data']['DB_USERNAME']) || trim($dotEnvData['data']['DB_USERNAME']) === '') {
                $warnings[] = "MISSING DB_USERNAME in .env: Database configuration defaults to 'root' when DB_USERNAME is omitted.";
                $recommendations[] = "Set DB_USERNAME=cpaneluser_dbuser in .env.";
            }

            if (!isset($dotEnvData['data']['DB_PASSWORD']) || $dotEnvData['data']['DB_PASSWORD'] === '') {
                $warnings[] = "EMPTY DB_PASSWORD in .env: Database configuration has no password, causing '(using password: NO)'.";
                $recommendations[] = "Set DB_PASSWORD=\"your_password\" (wrapped in double quotes) in .env.";
            }

            if (isset($dotEnvData['unquoted_special_chars']) && !empty($dotEnvData['unquoted_special_chars'])) {
                $warnings[] = "UNQUOTED SPECIAL CHARACTERS: Keys [" . implode(', ', $dotEnvData['unquoted_special_chars']) . "] contain special characters without quotes.";
                $recommendations[] = "Wrap passwords containing #, $, @, or spaces in double quotes inside .env.";
            }
        }

        // Cause 4: Web server environment variables stripped (PHP-FPM clear_env)
        if (getenv('DB_USERNAME') === false && isset($_SERVER['DB_USERNAME']) === false && $dotEnvData['exists']) {
            $warnings[] = "SYSTEM ENV STRIPPED: System environment variables are not accessible via getenv(). PHP-FPM 'clear_env = yes' may be active. Application must rely on Dotenv file parser.";
        }

        return [
            'is_currently_root'   => $isCurrentlyRoot,
            'risk_level'          => $isCurrentlyRoot ? 'CRITICAL' : (!empty($warnings) ? 'MODERATE' : 'LOW'),
            'critical_warnings'   => $warnings,
            'recommendations'     => $recommendations,
        ];
    }

    /**
     * Test live database connectivity and measure latency.
     *
     * @param array $sanitizedConfig
     * @param string $password
     * @return array
     */
    protected function testConnectivity(array $sanitizedConfig, string $password): array
    {
        $driver = $sanitizedConfig['driver'];
        $host = $sanitizedConfig['host'];
        $port = $sanitizedConfig['port'];
        $db = $sanitizedConfig['database'];
        $user = $sanitizedConfig['username'];

        if ($driver !== 'mysql' && $driver !== 'pgsql' && $driver !== 'postgres') {
            return [
                'tested'    => false,
                'connected' => true,
                'note'      => 'Non-SQL or local driver active. Direct PDO test skipped.',
            ];
        }

        $start = microtime(true);
        try {
            $dsn = "{$driver}:host={$host};port={$port};dbname={$db};charset=utf8mb4";
            if (!empty($sanitizedConfig['unix_socket'])) {
                $dsn = "{$driver}:unix_socket={$sanitizedConfig['unix_socket']};dbname={$db};charset=utf8mb4";
            }

            $options = [
                PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_TIMEOUT            => 4,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            ];

            if ($driver === 'mysql') {
                $options[PDO::MYSQL_ATTR_INIT_COMMAND] = "SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci";
            }

            $pdo = new PDO($dsn, $user, $password, $options);
            $latencyMs = round((microtime(true) - $start) * 1000, 2);

            $version = 'unknown';
            $currentUser = 'unknown';
            try {
                $stmt = $pdo->query("SELECT VERSION() AS ver, CURRENT_USER() AS cur_user");
                $row = $stmt->fetch();
                $version = $row['ver'] ?? 'unknown';
                $currentUser = $row['cur_user'] ?? 'unknown';
            } catch (Exception $e) {
                // Secondary query failed, but connection succeeded
            }

            return [
                'tested'            => true,
                'connected'         => true,
                'latency_ms'        => $latencyMs,
                'server_version'    => $version,
                'connected_as_user' => $currentUser,
                'user_match'        => stripos($currentUser, $user) !== false,
            ];
        } catch (Exception $e) {
            $latencyMs = round((microtime(true) - $start) * 1000, 2);
            $cleanMsg = $this->sanitizeErrorMessage($e->getMessage());

            return [
                'tested'          => true,
                'connected'       => false,
                'latency_ms'      => $latencyMs,
                'error_message'   => $cleanMsg,
                'is_access_denied'=> stripos($cleanMsg, 'Access denied') !== false,
                'is_root_error'   => stripos($cleanMsg, "user 'root'") !== false,
            ];
        }
    }

    /**
     * Safely parse .env file from disk to verify contents without leaking secrets.
     *
     * @param string $path
     * @return array
     */
    protected function parseDotEnvFile(string $path): array
    {
        if (!file_exists($path)) {
            return [
                'exists'      => false,
                'is_readable' => false,
                'permissions' => '0000',
                'size'        => 0,
                'modified_at' => null,
                'data'        => [],
                'quoted'      => [],
                'unquoted_special_chars' => [],
                'errors'      => ['File does not exist'],
            ];
        }

        $isReadable = is_readable($path);
        $perms = substr(sprintf('%o', fileperms($path)), -4);
        $size = filesize($path);
        $mtime = date('c', filemtime($path));

        if (!$isReadable) {
            return [
                'exists'      => true,
                'is_readable' => false,
                'permissions' => $perms,
                'size'        => $size,
                'modified_at' => $mtime,
                'data'        => [],
                'quoted'      => [],
                'unquoted_special_chars' => [],
                'errors'      => ['File is not readable due to permission restrictions'],
            ];
        }

        $lines = @file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
        if ($lines === false) {
            return [
                'exists'      => true,
                'is_readable' => true,
                'permissions' => $perms,
                'size'        => $size,
                'modified_at' => $mtime,
                'data'        => [],
                'quoted'      => [],
                'unquoted_special_chars' => [],
                'errors'      => ['Failed to read lines from file'],
            ];
        }

        $data = [];
        $quoted = [];
        $unquotedSpecialChars = [];
        $errors = [];

        foreach ($lines as $lineNum => $line) {
            $line = trim($line);
            if ($line === '' || strpos($line, '#') === 0) continue;

            $parts = explode('=', $line, 2);
            if (count($parts) === 2) {
                $key = trim($parts[0]);
                $rawVal = trim($parts[1]);

                $isDoubleQuoted = (strlen($rawVal) >= 2 && $rawVal[0] === '"' && substr($rawVal, -1) === '"');
                $isSingleQuoted = (strlen($rawVal) >= 2 && $rawVal[0] === "'" && substr($rawVal, -1) === "'");

                $val = trim($rawVal, " \"'");
                $data[$key] = $val;
                $quoted[$key] = $isDoubleQuoted || $isSingleQuoted;

                if (!$quoted[$key] && preg_match('/[#$@\s]/', $rawVal)) {
                    $unquotedSpecialChars[] = $key;
                }
            } else {
                $errors[] = "Line " . ($lineNum + 1) . " is not a valid KEY=VALUE pair.";
            }
        }

        return [
            'exists'                 => true,
            'is_readable'            => true,
            'permissions'            => $perms,
            'size'                   => $size,
            'modified_at'            => $mtime,
            'data'                   => $data,
            'quoted'                 => $quoted,
            'unquoted_special_chars' => $unquotedSpecialChars,
            'errors'                 => $errors,
        ];
    }

    /**
     * Write formatted diagnostic record to the secure internal log file.
     *
     * @param array $report
     * @return bool
     */
    protected function writeToInternalLog(array $report): bool
    {
        try {
            $basePath = function_exists('storage_path') ? storage_path() : dirname(__DIR__, 2) . '/storage';
            $logDir = $basePath . '/logs';

            if (!is_dir($logDir)) {
                @mkdir($logDir, 0750, true);
            }

            // Ensure secure .htaccess in storage directory
            $htaccessFile = $basePath . '/.htaccess';
            if (!file_exists($htaccessFile)) {
                @file_put_contents($htaccessFile, "Order deny,allow\nDeny from all\n");
            }

            $logFile = $logDir . '/database-connection-diagnostic.log';

            $formattedEntry = $this->formatLogEntry($report);

            return @file_put_contents($logFile, $formattedEntry, FILE_APPEND | LOCK_EX) !== false;
        } catch (Exception $e) {
            if (function_exists('info')) {
                @info('[DatabaseDiagnostic] Failed writing to diagnostic log: ' . $e->getMessage());
            }
            return false;
        }
    }

    /**
     * Format diagnostic entry for log output.
     *
     * @param array $report
     * @return string
     */
    protected function formatLogEntry(array $report): string
    {
        $bar = str_repeat('=', 80);
        $time = $report['timestamp'];
        $status = $report['status'];
        $driver = $report['active_configuration']['driver'] ?? 'unknown';
        $host = $report['active_configuration']['host'] ?? 'unknown';
        $port = $report['active_configuration']['port'] ?? 'unknown';
        $db = $report['active_configuration']['database'] ?? 'unknown';
        $user = $report['active_configuration']['username'] ?? 'unknown';
        $hasPass = ($report['active_configuration']['password_meta']['is_set'] ?? false) ? 'YES (Length: ' . ($report['active_configuration']['password_meta']['length'] ?? 0) . ')' : 'NO';

        $entry = "\n{$bar}\n";
        $entry .= "[{$time}] DATABASE DIAGNOSTIC RECORD | STATUS: {$status}\n";
        $entry .= "  Active Connection: {$driver}://{$user}@{$host}:{$port}/{$db}\n";
        $entry .= "  Password Configured: {$hasPass}\n";
        $entry .= "  Connected Successfully: " . ($report['connection_test']['connected'] ? 'YES (' . $report['connection_test']['latency_ms'] . 'ms)' : 'NO') . "\n";

        if (!empty($report['connection_test']['error_message'])) {
            $entry .= "  Connection Error: " . $report['connection_test']['error_message'] . "\n";
        }

        $entry .= "  Credential Origins:\n";
        foreach (['DB_CONNECTION', 'DB_HOST', 'DB_DATABASE', 'DB_USERNAME'] as $var) {
            $source = $report['credential_origins'][$var]['primary_source'] ?? 'unknown';
            $val = $report['credential_origins'][$var]['active_value'] ?? 'empty';
            $entry .= "    - {$var}: '{$val}' (Origin: {$source})\n";
        }
        $entry .= "    - DB_PASSWORD: " . json_encode($report['credential_origins']['DB_PASSWORD']) . "\n";

        $entry .= "  Root Fallback Risk: " . $report['root_fallback_risk']['risk_level'] . "\n";
        if (!empty($report['root_fallback_risk']['critical_warnings'])) {
            $entry .= "  Warnings:\n";
            foreach ($report['root_fallback_risk']['critical_warnings'] as $w) {
                $entry .= "    ! {$w}\n";
            }
        }
        if (!empty($report['root_fallback_risk']['recommendations'])) {
            $entry .= "  Recommendations:\n";
            foreach ($report['root_fallback_risk']['recommendations'] as $r) {
                $entry .= "    * {$r}\n";
            }
        }

        $entry .= "  Audit: .env readable=" . ($report['dotenv_file_audit']['is_readable'] ? 'YES' : 'NO') . " | config_cache=" . ($report['config_cache_audit']['is_cached'] ? 'ACTIVE' : 'NONE') . "\n";
        $entry .= "{$bar}\n";

        return $entry;
    }

    /**
     * Strip plain text credentials or sensitive parameters from error strings.
     *
     * @param string $message
     * @return string
     */
    protected function sanitizeErrorMessage(string $message): string
    {
        return preg_replace('/password\s*=\s*[\'"][^\'"]+[\'"]/i', 'password=[REDACTED]', $message);
    }
}
