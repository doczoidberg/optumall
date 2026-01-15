@component('mail::message')

# Reactivation of license

Hello {{ $user->name }},<br>

Please click the link below to reactivate your license:

@component('mail::button', ['url' => $reActiveUrl])
Reactivate
@endcomponent

Thanks,<br>
{{ env('APP_NAME') }}<br>
{{ env('APP_DOMAIN') }}

@endcomponent
