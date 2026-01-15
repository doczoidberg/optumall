<?php
namespace App\Mail;

use App\Mail\OptumMailTransport;
use Illuminate\Mail\MailManager;

class OptumMailManager extends MailManager
{
    protected function createOptumMailerTransport()
    {
        return new OptumMailTransport();
    }
}
