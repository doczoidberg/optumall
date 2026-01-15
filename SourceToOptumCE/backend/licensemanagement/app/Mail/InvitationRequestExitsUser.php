<?php

namespace App\Mail;

use App\Models\User;
use App\Models\Account;
use Illuminate\Mail\Mailable;
use Illuminate\Support\Str;
// the class name is the default email subject
class InvitationRequestExitsUser extends Mailable
{
    /**
     * Create a new message instance.
     *
     * @return void
     */
    public function __construct(User $member, Account $organization, $code)
    {
        $this->member = $member;
        $this->organization = $organization;
        $this->code = $code;
        $this->subject("Invitation Request Existing User");
    }

    /**
     * Build the message.
     *
     * @return $this
     */
    public function build()
    {
        $acceptLink ="/accept-invitation?code={$this->member->account_id}_{$this->organization->id}_{$this->code}";
        return $this->markdown(
            'mail.InvitationRequestExitsUser',
            ['verifyEmailUrl' => env('APP_URL') . $acceptLink,
                "member" => $this->member,
                "organization" => $this->organization,
            ]
        );
    }
}