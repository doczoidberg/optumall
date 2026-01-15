<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Http\Controllers\Controller;
use Illuminate\Support\Facades\Password;
use Illuminate\Validation\ValidationException;
use Log;


class ForgotPasswordController extends Controller
{
    /**
     * Create a new controller instance.
     *
     * @return void
     */
    public function __construct()
    {
        //
        //$this->middleware('guest');
    }

    public function sendResetLinkEmail(Request $request)
    {
        try {
            $this->validate($request, [
                'user_name' => 'required'
            ]);
            $response = Password::broker()->sendResetLink(
                $request->only('user_name')
            );

            if ($response === Password::INVALID_USER) {
                // throw ValidationException::withMessages([
                //     'user_name' => [trans($response)],
                // ]);
                return $this->sendResetLinkResponse("passwords.sent");
            }

            return $this->sendResetLinkResponse($response);
        } catch (\Throwable $th) {
            Log::error($th);

            throw $th;
        }
    }

    /**
     * Get the response for a successful password reset link.
     *
     * @param  string  $response
     * @return \Illuminate\Http\RedirectResponse
     */
    protected function sendResetLinkResponse($response)
    {
        return ['status' => trans($response)];
    }
}
