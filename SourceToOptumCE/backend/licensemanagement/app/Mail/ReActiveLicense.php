<?php

namespace App\Mail;

use App\Models\User;
use Illuminate\Mail\Mailable;
use Illuminate\Support\Str;
// the class name is the default email subject
class ReActiveLicense extends Mailable
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
        $this->subject("License Reactivation");
    }

    /**
     * Build the message.
     *
     * @return $this
     */
    public function build()
    {
        $code = Str::random();
        return $this->markdown(
            'mail.RequestResentLicense',
            ['reActiveUrl' => env('APP_URL') . '/reActivate?code='.$code.'_'.$this->user->id.'_'.$this->user->code]
        );
    }
}