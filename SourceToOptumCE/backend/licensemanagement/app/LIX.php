<?php
namespace App;

class LIX
{
    public static function linkAccount($email)
    {
        Http::post(env('LIX_API') . "/account/link-account", [
            "email" => $email,
        ]);
    }
    public static function delAssignment($id)
    {
        Http::post(env('LIX_API') . "/license/del-assignment", [
            "id" => $id,
        ]);
    }
    public static function delMember($id)
    {
        Http::post(env('LIX_API') . "/account/detach-member", [
            "id" => $id,
        ]);
    }
    public static function autoAssign($account_id, $email)
    {
        Http::post(env('LIX_API') . "/license/auto-account-assignment", [
            "acount_id" => $account_id,
            "email"=>$email
        ]);
    }
    public static function createLicense($account_id, $scheme_id)
    {
        return Http::post(env('LIX_API') . "/license/create-license", [
            "account_id" => $account_id,
            "scheme_id"=>$scheme_id
        ]);
    }
}
