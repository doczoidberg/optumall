@component('mail::message')

# Register Confirmation

Hello {{ $user->first_name }} {{ $user->last_name }},<br>

Your account has been created successfully.<br>
Your username:<strong> {{ $user->user_name }}</strong><br>
Your password:<strong> {{ $passwordRandom }}</strong><br>
Please click following link to login:

@component('mail::button', ['url' => $verifyEmailUrl])
Login
@endcomponent

Thanks,<br>
{{ env('APP_NAME') }}<br>
{{ env('APP_DOMAIN') }}

@endcomponent
