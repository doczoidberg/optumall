@component('mail::message')

# Verification Code

Hello {{ $user->first_name }} {{ $user->last_name }},<br>

Your verification code is <b>{{ $user->code }}</b><br>
Your account can’t be accessed without this verification code, even if you didn’t submit this request.<br>

If you did not just try to login, someone might be  trying to gain access to your account.
Thanks,<br>
{{ env('APP_NAME') }}<br>
{{ env('APP_DOMAIN') }}

@endcomponent
