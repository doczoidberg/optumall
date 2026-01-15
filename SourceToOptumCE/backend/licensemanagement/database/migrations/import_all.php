<?php

error_reporting(E_ALL);
ini_set('display_errors', 1);
set_time_limit(0);

$pdo = new PDO('mysql:host=127.0.0.1;dbname=license_local;port=3306', 'root', '');
$pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

echo "Disabling foreign key checks...\n";
$pdo->exec('SET foreign_key_checks = 0');
$pdo->exec('SET sql_mode = "NO_AUTO_VALUE_ON_ZERO"');
$pdo->exec('SET NAMES utf8mb4');

echo "Dropping all existing tables...\n";
$tables = $pdo->query('SHOW TABLES')->fetchAll(PDO::FETCH_COLUMN);
foreach ($tables as $table) {
    $pdo->exec("DROP TABLE `$table`");
    echo "  Dropped: $table\n";
}

echo "\nReading current-db.sql...\n";
$sql = file_get_contents(__DIR__ . '/current-db.sql');

// Remove problematic directives
$sql = str_replace('SET NAMES utf8;', '', $sql);
$sql = preg_replace('/\/\*!.*?\*\/;?/s', '', $sql);
$sql = str_replace('USE `license_local`;', '', $sql);

// Split into statements
$statements = [];
$current = '';
$inString = false;
$stringChar = '';

for ($i = 0; $i < strlen($sql); $i++) {
    $char = $sql[$i];

    if (($char === "'" || $char === '"') && ($i == 0 || $sql[$i-1] !== '\\')) {
        if (!$inString) {
            $inString = true;
            $stringChar = $char;
        } elseif ($char === $stringChar) {
            $inString = false;
        }
    }

    $current .= $char;

    if ($char === ';' && !$inString) {
        $stmt = trim($current);
        if (!empty($stmt) && !preg_match('/^(SET|USE)/', $stmt)) {
            $statements[] = $stmt;
        }
        $current = '';
    }
}

echo "Found " . count($statements) . " SQL statements\n\n";

$executed = 0;
$errors = 0;

foreach ($statements as $i => $stmt) {
    if (empty(trim($stmt))) continue;

    try {
        $pdo->exec($stmt);
        $executed++;

        // Show progress for CREATE TABLE and large INSERTS
        if (stripos($stmt, 'CREATE TABLE') === 0) {
            preg_match('/CREATE TABLE `([^`]+)`/', $stmt, $m);
            echo "  ✓ Created table: " . ($m[1] ?? 'unknown') . "\n";
        } elseif (stripos($stmt, 'INSERT INTO') === 0 && $i % 100 === 0) {
            echo "  Processing inserts... ($executed/$i)\n";
        }
    } catch (Exception $e) {
        $errors++;
        if (stripos($stmt, 'CREATE TABLE') === 0 || stripos($stmt, 'DROP TABLE') === 0) {
            echo "  ✗ Error: " . $e->getMessage() . "\n";
        }
    }
}

$pdo->exec('SET foreign_key_checks = 1');

echo "\n=== IMPORT COMPLETE ===\n";
echo "Statements executed: $executed\n";
echo "Errors: $errors\n\n";

// Verify
echo "=== VERIFICATION ===\n";
$tables = $pdo->query('SHOW TABLES')->fetchAll(PDO::FETCH_COLUMN);
sort($tables);
foreach ($tables as $table) {
    $count = $pdo->query("SELECT COUNT(*) FROM `$table`")->fetchColumn();
    echo sprintf("  %-25s %10d rows\n", $table, $count);
}

echo "\nTotal tables: " . count($tables) . "\n";
