@component('mail::message')

# Register Confirmation

Hello {{ $user->first_name }} {{ $user->last_name }},

<br>
To activate your account, please click the button below to verify your email address:
    <br>
@component('mail::button', ['url' => $verifyEmailUrl])
Activate Account
@endcomponent

<br>
Or paste this link into your browser:<br/>
{{  $verifyEmailUrl }}
<br>
<br>
Thanks,<br>
{{ env('APP_NAME') }}<br>
{{ env('APP_DOMAIN') }}

@endcomponent
