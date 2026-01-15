<?php

namespace App\Mail;

use App\Mail\OptumMailManager;
use Illuminate\Mail\MailServiceProvider;

class OptumMailServiceProvider extends MailServiceProvider
{
    /**
     * Register any application services.
     *
     * @return void
     */
    public function register(){
        $this->app->singleton('mail.manager', function ($app) {
            return new OptumMailManager($app);
        });

        $this->app->bind('mailer', function ($app) {
            return $app->make('mail.manager')->mailer();
        });
         $this->registerMarkdownRenderer();
    }
}
