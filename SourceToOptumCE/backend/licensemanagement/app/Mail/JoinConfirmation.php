<?php

namespace App\Mail;

use App\Models\User;
use App\Models\Account;
use Illuminate\Mail\Mailable;
use Illuminate\Support\Str;
// the class name is the default email subject
class JoinConfirmation extends Mailable
{
    public $user;
    public $origanization;
    /**
     * Create a new message instance.
     *
     * @return void
     */
    public function __construct(User $user, Account $origanization)
    {
        $this->user = $user;
        $this->origanization = $origanization;
    }

    /**
     * Build the message.
     *
     * @return $this
     */
    public function build()
    {
        return $this->markdown(
            'mail.JoinConfirmation',
            ['loginUrl' => env('APP_URL') . '/#/login']
        );
    }
}