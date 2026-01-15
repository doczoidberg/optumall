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

    $sqlFile = __DIR__ . '/database/schema_init.sql';
    $sql = file_get_contents($sqlFile);

    echo "Importing database schema...\n";
    $conn->exec($sql);

    echo "Database schema imported successfully!\n";

} catch (PDOException $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
