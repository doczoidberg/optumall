<?php

// Test login API directly
require __DIR__ . '/vendor/autoload.php';

use Illuminate\Http\Request;

// Bootstrap the application
$app = require __DIR__ . '/bootstrap/app.php';

// Create a mock request for login
$request = Request::create('/api/auth/login', 'POST', [], [], [], [
    'CONTENT_TYPE' => 'application/json',
], json_encode([
    'user_name' => 'daniel.zuidinga@googlemail.com',
    'password' => 'test123'
]));

echo "=== TESTING LOGIN API ===\n\n";
echo "Endpoint: POST /api/auth/login\n";
echo "Username: daniel.zuidinga@googlemail.com\n";
echo "Password: test123\n\n";

try {
    // Run the request through the application
    $response = $app->handle($request);

    echo "HTTP Status: " . $response->getStatusCode() . "\n";
    echo "Response Headers:\n";
    foreach ($response->headers->all() as $key => $values) {
        foreach ($values as $value) {
            echo "  $key: $value\n";
        }
    }

    echo "\nResponse Body:\n";
    $content = $response->getContent();

    // Try to pretty print JSON
    $decoded = json_decode($content, true);
    if ($decoded) {
        echo json_encode($decoded, JSON_PRETTY_PRINT) . "\n";

        if (isset($decoded['token'])) {
            echo "\n✓ LOGIN SUCCESSFUL!\n";
            echo "JWT Token: " . substr($decoded['token'], 0, 50) . "...\n";
        }
    } else {
        echo $content . "\n";
    }

} catch (Exception $e) {
    echo "ERROR: " . $e->getMessage() . "\n";
    echo "Stack trace:\n" . $e->getTraceAsString() . "\n";
}
