<?php
/*
|--------------------------------------------------------------------------
| Application Routes
|--------------------------------------------------------------------------
|
| Here is where you can register all of the routes for an application.
| It is a breeze. Simply tell Lumen the URIs it should respond to
| and give it the Closure to call when that URI is requested.
|
*/

// $router->get('/', function () use ($router) {
//     return $router->app->version();
// });

$router->get('accept-invitation', 'AuthController@acceptInvitation');
$router->get('activate', 'AuthController@activate');
$router->get('reActivate', 'AuthController@reActivate');
$router->post('reverify-email', 'AuthController@ReverifyEmail');

// API route group
$router->group(['prefix' => 'api'], function () use ($router) {


    // Matches "/api/login
    $router->post('auth/login', 'AuthController@login');
    $router->post('auth/register', 'AuthController@register');
    $router->get('password/reset', ['as' => 'password.reset', function () {
        return view('app');
    }]);
    $router->post('password/email', 'ForgotPasswordController@sendResetLinkEmail');
    $router->post('password/reset', 'ResetPasswordController@reset');

    // API to communicate between server. NEVER call from client side
    $router->post('exchange/invite-admin', 'ExchangeController@inviteAdmin');

    // OptumAdmin API - Protected by API key for server-to-server communication
    $router->group(['prefix' => 'optumadmin', 'middleware' => 'apikey'], function () use ($router) {
        $router->get('accounts', 'OptumAdminController@getAllAccounts');
        $router->get('accounts/{id}', 'OptumAdminController@getAccount');
        $router->get('users', 'OptumAdminController@getAllUsers');
        $router->get('users/{id}', 'OptumAdminController@getUser');
        $router->get('groups', 'OptumAdminController@getAllGroups');
        $router->get('stats', 'OptumAdminController@getStats');
        $router->get('search', 'OptumAdminController@search');
        // Credits
        $router->get('credits/balance/{accountId}', 'CreditsController@getBalance');
        $router->get('credits/transactions/{accountId}', 'CreditsController@getTransactions');
    });

    // Stripe webhook (no auth middleware)
    $router->post('stripe/webhook', 'CreditsController@stripeWebhook');

    $router->group(['middleware' => 'auth'], function () use ($router) {
        // Only admin
        $router->group(['middleware' => 'admin'], function () use ($router) {
            $router->post('settings/changeRole/{id}', 'UserController@changeRole');
            $router->post('settings/changeGroup/{id}','UserController@changeGroup');

            $router->post('createUser', 'AccountController@createUser');
            $router->post('createBulk', 'AccountController@createBulk');
            $router->get('users/{id}', 'UserController@singleUser');
            $router->get('users', 'UserController@allUsers');
            $router->post('users/delete/{id}', 'UserController@removeUser');

            // Account group
            $router->get('/group', 'AccountController@index');
            $router->post('/group', 'AccountController@createGroup');
            $router->post('/group/removeuser', 'AccountController@removeUser');
            $router->post('/group/adduser', 'AccountController@addUserIntoGroup');
            $router->post('group/delete/{id}', 'AccountController@destroyGroup');
            $router->get('group/{id}', 'AccountController@showGroup');
            $router->put('group/{id}', 'AccountController@updateGroup');

            //on all  // off all
            $router->post('/licenses/assignUsers', 'LicenseController@assignUsers');
            $router->get('/licenses/getDetail/{id}', 'LicenseController@getDetail');
            $router->get('/licenses/getByUserId/{user_id}', 'LicenseController@getByUserId');
            $router->get('/mylicenses/{user_id}', 'LicenseController@myLicenses');
            //on / off
            $router->post('/licenses/assign', 'LicenseController@assign');
            $router->post('/licenses/automatic_assign', 'LicenseController@automaticAssign');
            $router->get('/licenses/getAll', 'LicenseController@getAllByAdmin');
            // !Only admin
        });


        // Only member
        $router->get('/licenses', 'LicenseController@index');
        $router->get('/licenses1', 'LicenseController@index1');
        // !Only member

        // Both
        $router->get('profile', 'UserController@profile');
        $router->post('upload-avatar', 'UserController@uploadImage');
        $router->post('upload', 'UserController@uploadAvatar');

        $router->post('settings/profile', ['uses' => 'UserController@update']);
        $router->post('settings/changePassword', 'UserController@changePassword');
        $router->post('settings/changeUserName',  'UserController@changeUserName');
        $router->post('settings/changeEmail', 'UserController@changeEmail');

        $router->post('settings/changeTwoStepVerification', ['uses' => 'UserController@changeTwoStepVerification']);
        $router->post('settings/delete/confirm', ['uses' => 'UserController@createToken']);
        $router->post('settings/delete/account', ['uses' => 'UserController@removeUserWithToken']);

        $router->get('notification', 'NotificationController@index');

        //Products
        $router->get('/products', 'ProductController@index');
        $router->post('/licenses/sendMail', 'LicenseController@sendMail');
        $router->post('/licenses/activeLicense', 'LicenseController@activeLicense');
        $router->post('/licenses/removeAccountOutSeat', 'LicenseController@removeAccountOutSeat');

        // Credits (authenticated users)
        $router->get('/credits/packages', 'CreditsController@getPackages');
        $router->get('/credits/balance[/{accountId}]', 'CreditsController@getBalance');
        $router->get('/credits/transactions[/{accountId}]', 'CreditsController@getTransactions');
        $router->post('/credits/checkout', 'CreditsController@createCheckoutSession');
        $router->post('/credits/add-manual', 'CreditsController@addCreditsManual'); // Superadmin only
        $router->get('/credits/all-transactions', 'CreditsController@getAllTransactions'); // Superadmin only

        // Admin endpoints
        $router->get('/admin/accounts/search', 'AccountController@searchAccounts'); // Superadmin only
        // !Both
    });
});
// $router->get('/{route:.*}/', function ()  {
//     return view('app');
// });
$router->get('password/reset/{token}', ['as' => 'password.reset', function ($token) {
	$url = "/#/password/reset?token=".$token."&email=".$_GET['email'];
	return redirect($url);
}]);

$router->get('{path:.*}', function () {
    return view('app', ['TheContent'=> 'Http/Controllers/Controller.php']);
});

