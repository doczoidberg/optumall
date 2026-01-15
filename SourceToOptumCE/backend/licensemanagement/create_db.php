<?php
try {
    $conn = new PDO('mysql:host=127.0.0.1', 'root', '');
    $conn->exec('CREATE DATABASE IF NOT EXISTS license_local CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
    echo "Database 'license_local' created successfully\n";
} catch (PDOException $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
