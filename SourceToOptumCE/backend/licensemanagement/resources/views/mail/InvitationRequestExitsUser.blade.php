@component('mail::message')

# Register Confirmation

Hello {{ $member->first_name }} {{ $member->last_name }},

<br>
You are invited to join as member of {{$organization->name}}<br>
To accept this invitation, please click the button below to accept:
    <br>
@component('mail::button', ['url' => $verifyEmailUrl])
Yes I would like to join the organization
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
