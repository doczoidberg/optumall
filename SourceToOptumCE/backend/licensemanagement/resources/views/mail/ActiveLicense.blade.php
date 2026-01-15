@component('mail::message')

Hello {{ $user->name }},

The license has been activated successfully<br>
Program: {{ $user->productName }}<br>
License type: {{$user->kindDisplay}} <br>
License period: {{$user->licensePeriod}}<br>
@component('mail::button', ['url' => $baseUrl])
Go to account
@endcomponent

Thanks,<br>
{{ env('APP_NAME') }}<br>
{{ env('APP_DOMAIN') }}

@endcomponent
