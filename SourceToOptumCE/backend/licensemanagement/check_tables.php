<?php
try {
    $pdo = new PDO('mysql:host=127.0.0.1;dbname=license_local', 'root', '');
    $stmt = $pdo->query('SHOW TABLES');
    echo "Tables in database license_local:\n";
    $count = 0;
    while ($row = $stmt->fetch()) {
        echo "- " . $row[0] . "\n";
        $count++;
    }
    echo "\nTotal tables: $count\n";
} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
