<?php

namespace App\Http\Controllers;
use App\LIX;
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

class AccountController extends Controller
{
    public function __construct()
    {
        $this->middleware('auth');
    }
    /**
     * Get all group
     *
     * @return void
     */
    public function index()
    {
        try {
            $current_user = Auth::user();
            $accountMember = AccountMember::where('member_id', $current_user->account_id)->first();
            $account_id = $accountMember != null ? $accountMember->account_id : $current_user->account_id;
            $accounts = AccountGroup::where('account_id', $account_id)->get();
            return response()->json($accounts);
        } catch (\Exception $e) {
            Log::info('===========errorsGroup========');
            Log::info($e);
            Log::info('===========!errorsGroup========');
            return response()->json([]);
        }
    }
    /**
     * Store a new user.
     *
     * @param  Request  $request
     * @return Response
     */
    public function createUser(Request $request)
    {
        //validate incoming request
        $this->validate($request, [
            'email' => 'required|email',
            'first_name' => 'required|string',
            'last_name' => 'required|string',
        ]);
        $current_user = Auth::user();

        $accountMember = AccountMember::where('member_id', $current_user->account_id)->first();
        $account_id = $accountMember != null ? $accountMember->account_id : $current_user->account_id;
        $current_account = Account::findOrFail($current_user->account_id);
        $checkUser = User::where('email', $request->input('email'))->first();
        try {
            if ($checkUser) {
                $checkAccountMember = AccountMember::where('member_id', $checkUser->account_id)->where('account_id', $account_id)->first();
                if ($checkAccountMember) {
                    $errors = ['message' => ['A member with this email address already exists.'],'checkAccountMember'=>$checkAccountMember];
                    return response()->json($errors, HttpStatusCodes::CLIENT_ERROR_BAD_REQUEST);
                }else{
                    $this->createAccountMember($checkUser->account_id, $account_id);
                    return response()->json(['user' => $checkUser, 'show_popup' => true, 'message' => 'Add member successfully'], 201);
                }

            } else {
                Log::info('===========register22222========');
                $user = new User;
                $user->user_name = $request->input('email');
                $user->email = $request->input('email');
                $user->first_name = $request->input('first_name');
                $user->last_name = $request->input('last_name');
                $user->role = 0;
                //Admin created
                $user->email_validated = true;
                $passwordRandom = Str::random();
                // $plainPassword = $request->input('password');
                $user->password = app('hash')->make($passwordRandom);

                //Create account
                $account = $this->createAccount($current_account, $request->input('email'));
                $user->account_id = $account->id;
                $user->save();

                //Create Account Member
                $this->createAccountMember($user->account_id, $account_id);
                $user->passwordRandom = $passwordRandom;
                $jsonApiResponse = MailHelper::sendEmail(
                    $user->email,
                    new RegisterConfirmation($user),
                    ResponseHelper::getJsonApiResponse($user, HttpStatusCodes::SUCCESS_CREATED)
                );
                LIX::linkAccount($user->email);
               
                return response()->json(['user' => $user, 'show_popup' => true, 'message' => 'Create account and add member successfully'], 201);
            }

        } catch (\Exception $e) {
            //return error message
            Log::info('===========errors========');
            Log::info($e);
            Log::info('===========!errors========');
            // return response()->json(['message' => 'User Registration Failed!'], 400);
            $errors = ['message' => ['Error creating user account.']];
            return response()->json($errors, HttpStatusCodes::CLIENT_ERROR_BAD_REQUEST);
        }

    }
    public function addUserIntoGroup(Request $request)
    {

        //validate incoming request
        $this->validate($request, [
            'account_id' => 'numeric|required',
            'group_id' => 'numeric|required'
        ]);
        $current_user = Auth::user();
        try {
            $account_id = $request->input('account_id');
            $group_id = $request->input('group_id');
            if(!GroupMember::where('account_id', $account_id)->where('group_id', $group_id)->exists()){
                $group = $this->creatGroupMember($account_id, $group_id);
                return response()->json(['message' => "Updated successfully",'group' => $group], 200);
            }else{
                return response()->json(['message' => "This member already exist in the group"], 400);
            }
        } catch (\Exception $e) {
            Log::info('===========addUserIntoGroup========');
            Log::info($e);
            Log::info('===========!addUserIntoGroup========');
            return response()->json(['message' => 'Cannot update'], 404);
        }
    }
    public function removeUser(Request $request)
    {

        //validate incoming request
        $this->validate($request, [
            'account_id' => 'required',
            'group_id' => 'required',
            'id' => 'required',
        ]);
        $current_user = Auth::user();

        // $userGroup = GroupMember::where([['account_id', '=', $request->input('account_id')],['group_id', '=', $request->input('group_id')]])->first();
        // if($userGroup){
        //     $userGroup
        // }
        try {
            $userGroup = GroupMember::findOrFail($request->input('id'));
            $userGroup->delete();
            return response()->json(['message' => "Deleted successfully!"], 200);

        } catch (\Exception $e) {
            Log::info('===========errorsremoveUser========');
            Log::info($e);
            Log::info('===========!errorsremoveUser========');
            return response()->json(['message' => 'user group not found!'], 404);
        }
    }

    public function createBulk(Request $request)
    {
        //validate incoming request
        $this->validate($request, [
            'accounts' => 'required',
        ]);
        $accounts = $request->input('accounts');
        $current_user = Auth::user();
        if($current_user->role < 1){
            return response()->json(['message' => 'Please login'], 403);
        }
        $organizationCheck = AccountMember::where('member_id', $current_user->account_id)->where('member_role',1)->first();
        if(!$organizationCheck){
            return response()->json(['message' => 'Admin is not belong to any organization'], 400);
        }
        $organization = Account::where('id', $organizationCheck->account_id)->first();
        try {
            // John Doe <jdoe@domain.com>;
            // remove multiple whitespaces
            $accounts = preg_replace('/\s+/', ' ',$accounts);
            // Only use space or comma
            $accountArray = explode(";",str_replace(array(" ",","), ";",$accounts));
            // Duplicate emails on the field should be removed
            $accountArray = array_unique($accountArray);
            $newUserCount = 0;
            $exitsUserCount = 0;
            foreach ($accountArray as $email) {
                // $email = get_string_between($account, '<', '>');
                if (isset($email) && $email != '') {
                    // $data = explode("<", $account);
                   // // Invited users that are already on the company list should just be ignored
                    $member = User::where('email', $email)->first();
                    if ($member) {
                        $checkMemberIsBelongOrganization = AccountMember::where('member_id', $member->account_id)->where('account_id',$organization->id )->first();
                        if(!$checkMemberIsBelongOrganization){
                            $this->inviteExistAccount($member, $organization);
                            $exitsUserCount++;
                        }
                    }
                    else{
                        $this->inviteNewEmail($email,$organization);
                        $newUserCount++;
                    };
                }

            }
            return response()->json(['message' => 'Invite '.$exitsUserCount.' exits users & '.$newUserCount.' new users'], 201);

        } catch (\Exception $e) {
            //return error message
            Log::info($e);
            $errors = ['message' => ['Error creating user account.']];
            return response()->json($errors, HttpStatusCodes::CLIENT_ERROR_BAD_REQUEST);
        }

    }

    private function inviteExistAccount(User $user, Account $organization){
        $invitationOld = Invitation::where('account_id', $organization->id)->where('data',$user->account_id)->first();
        if($invitationOld){
            $invitationOld->delete();
        }
        $invitation = new Invitation;
        $invitation->account_id = $organization->id;
        $invitation->data = $user->account_id;
        $invitation->isNewUser = 0;
        $invitation->save();
        Log::info("---Generate-Invitation---");
        Log::info($invitation);
        Log::info("---!Generate-Invitation---");
        
        
        MailHelper::sendEmail(
            $user->email,
            new InvitationRequestExitsUser($user, $organization, $invitation->code)
        );
    }
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

    //Create group
    public function createGroup(Request $request)
    {

        try {
            $current_user = Auth::user();

            $accountMember = AccountMember::where('member_id', $current_user->account_id)->first();
            $account_id = $accountMember != null ? $accountMember->account_id : $current_user->account_id;
            $account = new AccountGroup;
            $account->name = $request->name;
            $account->account_id = $account_id;
            $account->description = $request->description;
            $account->save();

            if (isset($request->emails)) {
                $emails = explode(";", $request->emails);
                foreach ($emails as $email) {
                    if ($email != '') {
                        $user = User::where('email', $email)->first();
                        if ($user) {
                            $this->creatGroupMember($user->account_id, $account->id);
                        }
                    }
                }
            }
            return response()->json($account);
        } catch (\Exception $e) {
            Log::info($e);
            $errors = ['message' => ['Error creating group.']];
            return response()->json($errors, HttpStatusCodes::CLIENT_ERROR_BAD_REQUEST);
        }
    }

    private function creatGroupMember($account_id, $group_id)
    {
        $group = new GroupMember;
        $group->account_id = $account_id;
        $group->group_id = $group_id;
        // $group->member_role = $role;
        $group->save();
        return $group;
    }

    public function showGroup($id)
    {
        $group = AccountGroup::where('id', $id)->with(['members'])->first();
        GroupMember::where('group_id', $group->id)->get();
        return response()->json($group);
    }

    public function updateGroup(Request $request, $id)
    {
        $account = Account::find($id);
        $account->name = $request->input('name');
        $account->type = $request->input('type');
        $account->domain = $request->input('domain');
        $account->save();
        return response()->json($account);
    }

    public function destroyGroup($id)
    {
        $current_user = Auth::user();

        $check = GroupMember::where('group_id', $id)->exists();
        if ($check) {
            return response()->json(['message' => 'User existing in the group. Please delete users first!'], 404);
        }
        try {
            $account = AccountGroup::findOrFail($id);
            $account->delete();
            return response()->json(['message' => "Successfully deleted"], 200);

        } catch (\Exception $e) {
            Log::info('===========errorsremoveUser========');
            Log::info($e);
            Log::info('===========!errorsremoveUser========');
            return response()->json(['message' => 'user not found!'], 404);
        }
        return response()->json('account removed successfully');
    }

    /**
     * Search accounts by name or ID (SuperAdmin only)
     *
     * @param  Request  $request
     * @return Response
     */
    public function searchAccounts(Request $request)
    {
        try {
            $current_user = Auth::user();

            // Only superadmin can search all accounts
            if ($current_user->role < 2) {
                return response()->json([
                    'success' => false,
                    'message' => 'Access denied. SuperAdmin role required.'
                ], 403);
            }

            $query = $request->input('q', '');

            if (strlen($query) < 2) {
                return response()->json([
                    'success' => false,
                    'message' => 'Search query must be at least 2 characters.'
                ], 400);
            }

            // Search by ID or name
            $accounts = Account::where(function($q) use ($query) {
                $q->where('id', 'LIKE', "%{$query}%")
                  ->orWhere('name', 'LIKE', "%{$query}%");
            })
            ->limit(20)
            ->get();

            return response()->json([
                'success' => true,
                'data' => $accounts
            ]);

        } catch (\Exception $e) {
            Log::error('Error searching accounts: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Error searching accounts.'
            ], 500);
        }
    }

}
