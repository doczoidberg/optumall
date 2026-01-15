<?php
try {
    $conn = new PDO('mysql:host=127.0.0.1', 'root', '');
    $conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    echo "Dropping existing database...\n";
    $conn->exec('DROP DATABASE IF EXISTS license_local');

    echo "Creating fresh database...\n";
    $conn->exec('CREATE DATABASE license_local CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');

    $conn = new PDO('mysql:host=127.0.0.1;dbname=license_local', 'root', '');
    $conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    $sqlFile = __DIR__ . '/database/migrations/current-db.sql';

    echo "Reading SQL file...\n";
    $sql = file_get_contents($sqlFile);

    echo "Importing full database (schema + data) from backup...\n";

    // Set MySQL settings
    $conn->exec('SET FOREIGN_KEY_CHECKS=0');
    $conn->exec('SET sql_mode = "NO_AUTO_VALUE_ON_ZERO"');
    $conn->exec('SET NAMES utf8mb4');
    $conn->exec('SET time_zone = "+00:00"');

    // Execute the entire SQL file at once
    $conn->exec($sql);

    $conn->exec('SET FOREIGN_KEY_CHECKS=1');

    echo "Full database imported successfully!\n";

    // Count records
    $result = $conn->query("SELECT COUNT(*) FROM account");
    $count = $result->fetchColumn();
    echo "Accounts imported: $count\n";

    $result = $conn->query("SELECT COUNT(*) FROM identity");
    $count = $result->fetchColumn();
    echo "Identities imported: $count\n";

} catch (PDOException $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
