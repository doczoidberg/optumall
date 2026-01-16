<?php

require_once __DIR__.'/vendor/autoload.php';

try {
    $dotenv = Dotenv\Dotenv::createImmutable(__DIR__);
    $dotenv->load();
} catch (Exception $e) {
    die("Error loading .env file: " . $e->getMessage() . "\n");
}

// Database connection
$host = $_ENV['DB_HOST'];
$database = $_ENV['DB_DATABASE'];
$username = $_ENV['DB_USERNAME'];
$password = $_ENV['DB_PASSWORD'];

try {
    $pdo = new PDO(
        "mysql:host=$host;dbname=$database;charset=utf8mb4",
        $username,
        $password,
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
    );

    $email = 'info@seoaachen.de';

    // Check user details
    $stmt = $pdo->prepare("SELECT id, email, user_name, first_name, last_name, role, email_validated, two_factor_enabled, password FROM identity WHERE email = :email");
    $stmt->execute(['email' => $email]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    if ($user) {
        echo "User found:\n";
        echo "ID: {$user['id']}\n";
        echo "Email: {$user['email']}\n";
        echo "User Name: {$user['user_name']}\n";
        echo "Name: {$user['first_name']} {$user['last_name']}\n";
        echo "Role: {$user['role']}\n";
        echo "Email Validated: " . ($user['email_validated'] ? 'Yes' : 'No') . "\n";
        echo "2FA Enabled: " . ($user['two_factor_enabled'] ? 'Yes' : 'No') . "\n";
        echo "Password Hash: {$user['password']}\n\n";

        // Test password verification
        $testPassword = 'test123';
        if (password_verify($testPassword, $user['password'])) {
            echo "✓ Password 'test123' is CORRECT\n";
        } else {
            echo "✗ Password 'test123' does NOT match\n";
        }
    } else {
        echo "No user found with email: $email\n";
    }

} catch (PDOException $e) {
    die("Database error: " . $e->getMessage() . "\n");
}
