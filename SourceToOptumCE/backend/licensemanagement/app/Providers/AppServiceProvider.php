<?php

namespace App\Providers;

use Illuminate\Support\ServiceProvider;
use App\Mail\OptumMailManager;
use Illuminate\Mail\MailManager;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     *
     * @return void
     */
    public function register()
    {
        // $this->app->singleton(MailManager::class, function ($app) {
        //         return new OptumMailManager($app);
        //     });
    }
}
