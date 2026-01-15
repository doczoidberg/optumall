@component('mail::message')

# Join Confirmation

Hello {{ $user->first_name }} {{ $user->last_name }},<br>

Your account has successfully joined the organization {{ $origanization->name}}.<br>

Please click following link to login:

@component('mail::button', ['url' => $loginUrl])
Login
@endcomponent

Thanks,<br>
{{ env('APP_NAME') }}<br>
{{ env('APP_DOMAIN') }}

@endcomponent
