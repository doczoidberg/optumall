<?php

namespace App\Http\Controllers;

use App\Helpers\HttpStatusCodes;
use App\Helpers\MailHelper;
use App\Helpers\ResponseHelper;
use App\Mail\InvitationRequestNewUser;
use App\Mail\InvitationRequestExitsUser;
use App\Models\Account;
use App\Models\AccountGroup;
use App\Models\AccountMember;
use App\Models\GroupMember;
use App\Models\Invitation;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Str;
use Log;

class ExchangeController extends Controller
{
    public function __construct()
    {
    }
    public function inviteAdmin(Request $request){
        $orgid = $request->get('account_id');
        $email = $request->get('email');
        $organization = Account::where('id', $orgid)->first();
        $this->inviteNewEmail($email, $organization, TRUE);
    }

    // TODO: merge with AccountController
    private function inviteNewEmail($email, Account $organization, $asAdmin=FALSE){
        $invitationOld = Invitation::where('account_id', $organization->id)->where('data',$email)->first();
        if($invitationOld){
            $invitationOld->delete();
        }
        $invitation = new Invitation;
        $invitation->account_id = $organization->id;
        $invitation->data = $email;
        $invitation->isNewUser = 1;
        $invitation->as_admin=$asAdmin;
        $invitation->save();
        
        MailHelper::sendEmail(
            $email,
            new InvitationRequestNewUser($email,  $organization, $invitation->code)
        );
    }
}
