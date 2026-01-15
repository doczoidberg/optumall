<?php

namespace App\Mail;

use App\Mail\OptumMailTransport;

class TransportManager extends \Illuminate\Mail\TransportManager
{
    protected function createMailjetDriver()
    {
        $config = $this->app['config']->get('services.mailjet', []);

        return new MailjetTransport(
            $this->getHttpClient($config),
            $config['api_key'],
            $config['secret_key']
        );
    }
}