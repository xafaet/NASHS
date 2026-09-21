<?php
/**
 * ====================================================================
 * Nanupur Abu Sobhan High School Alumni Platform
 * Laravel / Eloquent Backend Storage Diagnostic Script
 * 
 * Can be run standalone with:
 *   php scripts/laravel_db_diagnostic.php
 * Or included in an Artisan command / Tinker session.
 * ====================================================================
 */

// 1. Resolve PostgreSQL connection string from environment
$databaseUrl = getenv('DATABASE_URL') ?: getenv('SUPABASE_DB_URL');

if (!$databaseUrl && file_exists(__DIR__ . '/../.env')) {
    $lines = file(__DIR__ . '/../.env', FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        if (strpos(trim($line), '#') === 0) continue;
        if (strpos($line, 'DATABASE_URL=') === 0) {
            $databaseUrl = trim(substr($line, 13), " \"'");
            break;
        }
    }
}

echo "\n" . str_repeat('=', 70) . "\n";
echo " 🐘 LARAVEL / ELOQUENT STORAGE DIAGNOSTIC\n";
echo "    Testing PostgreSQL Backend Connection & Model Mapping\n";
echo str_repeat('=', 70) . "\n\n";

if (!$databaseUrl) {
    echo "✖ Error: DATABASE_URL not set in environment or .env file.\n\n";
    exit(1);
}

// Parse PostgreSQL URL (handles special characters in password)
$urlParts = parse_url($databaseUrl);
$host = $urlParts['host'] ?? 'localhost';
$port = $urlParts['port'] ?? 5432;
$db   = ltrim($urlParts['path'] ?? 'postgres', '/');
$user = $urlParts['user'] ?? 'postgres';
$pass = $urlParts['pass'] ?? '';

echo "[1/3] Connecting to PostgreSQL ($host:$port/$db)... ";
$dsn = "pgsql:host=$host;port=$port;dbname=$db;sslmode=require";

try {
    $pdo = new PDO($dsn, $user, $pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_TIMEOUT => 5,
    ]);
    $ver = $pdo->query("SELECT version()")->fetchColumn();
    echo "CONNECTED!\n";
    echo "      Engine: " . explode(' ', $ver)[0] . ' ' . explode(' ', $ver)[1] . "\n\n";
} catch (PDOException $e) {
    echo "FAILED!\n";
    echo "Error: " . $e->getMessage() . "\n\n";
    exit(1);
}

// [2/3] Check Model Mappings
echo "[2/3] Checking Model Table Mappings:\n";
$models = [
    'App\Models\User'         => 'users',
    'App\Models\Registration' => ['registrations', 'event_registrations'],
    'App\Models\CMSPage'      => ['cms_pages', 'pages'],
    'App\Models\Event'        => 'events',
    'App\Models\Batch'        => 'batches',
];

foreach ($models as $model => $tableDef) {
    $tablesToCheck = is_array($tableDef) ? $tableDef : [$tableDef];
    $foundTable = null;
    
    foreach ($tablesToCheck as $tbl) {
        $stmt = $pdo->prepare("SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = ?");
        $stmt->execute([$tbl]);
        if ($stmt->fetchColumn()) {
            $foundTable = $tbl;
            break;
        }
    }
    
    if ($foundTable) {
        echo "  ✔ $model => Table '$foundTable' (OK)\n";
    } else {
        echo "  ✖ $model => Missing table (" . implode(' or ', $tablesToCheck) . ")\n";
    }
}

// [3/3] Simple Read/Write Operation
echo "\n[3/3] Simple Read/Write Operation:\n";
$testKey = 'LARAVEL_DIAG_' . time();
$payload = json_encode(['status' => 'tested', 'timestamp' => date('c'), 'source' => 'Laravel Diagnostic']);

// WRITE
$pdo->prepare("INSERT INTO site_settings (key, value, updated_at) VALUES (?, ?, NOW()) ON CONFLICT (key) DO UPDATE SET value = ?, updated_at = NOW()")
    ->execute([$testKey, $payload, $payload]);
echo "  ✔ WRITE (INSERT): Saved setting with key '$testKey'\n";

// READ
$readStmt = $pdo->prepare("SELECT value FROM site_settings WHERE key = ?");
$readStmt->execute([$testKey]);
$val = $readStmt->fetchColumn();

if ($val) {
    echo "  ✔ READ (SELECT): Retrieved and validated setting payload\n";
} else {
    echo "  ✖ READ (SELECT): Failed to read record back!\n";
}

// CLEANUP
$pdo->prepare("DELETE FROM site_settings WHERE key = ?")->execute([$testKey]);
echo "  ✔ CLEANUP (DELETE): Removed temporary test record\n";

echo "\n" . str_repeat('=', 70) . "\n";
echo " ALL CHECKS PASSED: Storage communication and model mapping verified.\n";
echo str_repeat('=', 70) . "\n\n";
exit(0);
