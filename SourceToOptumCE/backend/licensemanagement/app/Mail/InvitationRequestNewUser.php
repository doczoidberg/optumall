<?php

namespace App\Mail;

use App\Models\User;
use App\Models\Account;
use Illuminate\Mail\Mailable;
use Illuminate\Support\Str;
// the class name is the default email subject
class InvitationRequestNewUser extends Mailable
{
    /**
     * Create a new message instance.
     *
     * @return void
     */
    public function __construct($email, Account $organization, $code)
    {
        $this->email = $email;
        $this->organization = $organization;
        $this->code = $code;
        $this->subject("Invitation Request New User");
    }

    /**
     * Build the message.
     *
     * @return $this
     */
    public function build()
    {
        $acceptLink = "#/register?code={$this->code}&email={$this->email}&organization={$this->organization->id}";
        return $this->markdown(
            'mail.InvitationRequestNewUser',
            ['verifyEmailUrl' => env('APP_URL') . $acceptLink,
                "organization" => $this->organization,
            ]
        );
    }
}