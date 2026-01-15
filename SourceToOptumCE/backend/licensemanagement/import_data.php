<?php
try {
    $conn = new PDO('mysql:host=127.0.0.1;dbname=license_local', 'root', '');
    $conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    $sqlFile = __DIR__ . '/database/migrations/current-db.sql';

    echo "Reading SQL file...\n";
    $sql = file_get_contents($sqlFile);

    echo "Importing data from current-db.sql...\n";

    // Disable foreign key checks
    $conn->exec('SET FOREIGN_KEY_CHECKS=0');
    $conn->exec('SET sql_mode = "NO_AUTO_VALUE_ON_ZERO"');

    // Execute the entire SQL file at once
    $conn->exec($sql);

    $conn->exec('SET FOREIGN_KEY_CHECKS=1');

    echo "Data imported successfully!\n";

} catch (PDOException $e) {
    echo "Error: " . $e->getMessage() . "\n";
    echo "Line: " . $e->getLine() . "\n";
}
