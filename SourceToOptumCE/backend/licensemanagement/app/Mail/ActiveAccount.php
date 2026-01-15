<?php

namespace App\Mail;

use App\Models\User;
use Illuminate\Mail\Mailable;
use Illuminate\Support\Str;
// the class name is the default email subject
use Log;
class ActiveAccount extends Mailable
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
        $this->subject("Activate Account");
    }

    /**
     * Build the message.
     *
     * @return $this
     */
    public function build()
    {
        $code = Str::random();
        $link = env('APP_URL') . '/activate?code='.$code.'_'.$this->user->id.'_'.$this->user->code;
        Log::info($link);
        return $this->markdown(
            'mail.ActiveAccount',
            ['verifyEmailUrl' => $link]
        );
    }
}