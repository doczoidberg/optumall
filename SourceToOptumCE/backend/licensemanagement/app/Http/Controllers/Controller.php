<?php

namespace App\Http\Controllers;

use Laravel\Lumen\Routing\Controller as BaseController;
use Illuminate\Support\Facades\Auth;
use App\Models\Account;
use App\Models\AccountMember;

class Controller extends BaseController
{
    //
    // protected function respondWithToken($token)
    // {
    //    $user =  $this->guard();
    //    if($user->two_factor_enabled){

    //    }
    //     return response()->json([
    //         'token' => $token,
    //         'user' => $this->guard(),
    //         'token_type' => 'bearer',
    //         'expires_in' => Auth::factory()->getTTL() * 60
    //     ], 200);
    // }
    public function guard()
    {
        return Auth::Guard('api')->user();
    }
    public function createAccount($current_account, $email = '')
    {
        $account = new Account;
        $account->name =  $email;
        // $account->name = $current_account->name;
        $account->type = $current_account->type;
        // $account->domain = $current_account->domain;
        $account->save();
        return $account;
    }

    public function createAccountMember($user_id, $account_id)
    {
        $account_member = new AccountMember;
        $account_member->member_role = 0;
        $account_member->account_id = $account_id;
        $account_member->member_id = $user_id;
        $account_member->save();
        return $account_member;
    }
    public function isAdmin(){
        $user = Auth::user();
        if($user->role < 1){
            return response()->json(['message' => 'Please login'], 403);
        }
    }
}
