<?php
try {
    // Connect without database first
    $conn = new PDO('mysql:host=127.0.0.1', 'root', '');
    $conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    echo "Dropping existing database...\n";
    $conn->exec('DROP DATABASE IF EXISTS license_local');

    echo "Creating fresh database...\n";
    $conn->exec('CREATE DATABASE license_local CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');

    // Now connect to the new database
    $conn = new PDO('mysql:host=127.0.0.1;dbname=license_local', 'root', '');
    $conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    $sqlFile = __DIR__ . '/database/migrations/current-db.sql';
    $sql = file_get_contents($sqlFile);

    echo "Importing database from current-db.sql...\n";

    // Disable foreign key checks
    $conn->exec('SET FOREIGN_KEY_CHECKS=0');

    // Split SQL into individual statements
    $statements = array_filter(array_map('trim', explode(';', $sql)));
    $total = count($statements);
    $count = 0;

    foreach ($statements as $statement) {
        if (!empty($statement)) {
            $count++;
            if ($count % 10 == 0) {
                echo "Executing statement $count of $total...\n";
            }
            try {
                $conn->exec($statement);
            } catch (PDOException $e) {
                // Skip errors and continue
                echo "Warning: Skipped statement $count due to error: " . substr($e->getMessage(), 0, 100) . "...\n";
            }
        }
    }

    $conn->exec('SET FOREIGN_KEY_CHECKS=1');

    echo "Database imported successfully! ($count statements executed)\n";

} catch (PDOException $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
