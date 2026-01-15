<?php

namespace App\Mail;

use App\Models\User;
use App\Models\License;
use Illuminate\Mail\Mailable;
use Illuminate\Support\Str;
// the class name is the default email subject
class ActiveLicense extends Mailable
{
    public $user;
    /**
     * Create a new message instance.
     *
     * @return void
     */
    public function __construct(User $user)
    {
        $this->user = $user;
        $this->subject("Your {$user->productName} license is now active");
    }

    /**
     * Build the message.
     *
     * @return $this
     */
    public function build()
    {

        return $this->markdown(
            'mail.ActiveLicense',
            ['baseUrl' => env('APP_URL')]
        );
    }
}