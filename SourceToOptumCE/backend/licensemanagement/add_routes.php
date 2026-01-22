<?php

$file = 'routes/web.php';
$content = file_get_contents($file);

// Add the new routes after the existing credits routes
$search = "        \$router->post('/credits/checkout', 'CreditsController@createCheckoutSession');";
$replace = "        \$router->post('/credits/checkout', 'CreditsController@createCheckoutSession');
        \$router->get('/credits/pricing', 'CreditsController@getPricing');
        \$router->post('/credits/checkout-custom', 'CreditsController@createCustomCheckoutSession');";

$content = str_replace($search, $replace, $content);

file_put_contents($file, $content);
echo "Routes added successfully!\n";
