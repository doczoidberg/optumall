<?php
namespace App;

use Log;

class AC
{
    public static function accountRegister($email, $firstname, $lastName, $keepUpdate = false)
    {
        try {
            Http::post2(env('AC_API') . "/contact/on-user-register", [
                'Email' => $email,
                'FirstName' => $firstname,
                'LastName' => $lastName,
                'KeepUpToDate' => $keepUpdate ? true : false,
            ]);
        } catch (\Throwable $th) {
            Log::error("{$th->getMessage()}\n{$th->getTraceAsString()}");
        }
    }
    public static function licenseCreated($lid)
    {
        try {
            Log::info("AC.licenseCreated:".$lid);
            Http::post2(env('AC_API') . "/contact/on-license-activation", [
                'LicenseId' => $lid,
            ]);
        } catch (\Throwable $th) {
            Log::error("{$th->getMessage()}\n{$th->getTraceAsString()}");
        }
    }
}
