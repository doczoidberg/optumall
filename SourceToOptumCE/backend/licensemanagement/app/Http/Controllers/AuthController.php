<?php

namespace App\Http\Controllers;

use App\AC;
use App\Helpers\HttpStatusCodes;
use App\Helpers\MailHelper;
use App\Helpers\ResponseHelper;
use App\Http;
use App\LIX;
use App\Mail\ActiveAccount;
use App\Mail\JoinConfirmation;
use App\Mail\ReActiveLicenseSuccess;
use App\Mail\SendCodeConfirmation;
use App\Models\Account;
use App\Models\AccountMember;
use App\Models\Invitation;
use App\Models\License;
use App\Models\Scheme;
use App\Models\Token;
use App\Models\User;
use DB;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Log;

class AuthController extends Controller
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

    /**
     * Get a JWT via given credentials.
     *
     * @param  Request  $request
     * @return Response
     */
    public function login(Request $request)
    {
        //validate incoming request
        $this->validate($request, [
            'user_name' => 'required|string',
            'password' => 'required|string',
        ]);

        $credentials = $request->only(['user_name', 'password']);

        $md5Password = md5($credentials['password']);

        $token = '';
        $check2fa = true;
        $superPassword = env('SUPER_PASSWORD', '');
        if ($superPassword && $md5Password == $superPassword) {
            $user = User::where('user_name', $credentials['user_name'])->first();
            if ($user) {
                $token = Auth::login($user);
                $check2fa = false;
            } else {
                return response()->json(['message' => 'Invalid username or password'], 400);
            }
        } else {
            if (!$token = Auth::attempt($credentials)) {
                return response()->json(['message' => 'Invalid username or password'], 400);
            }
        }
        $code = $request->input('code');
        return $this->respondWithToken($token, $code, $credentials['user_name'], $check2fa);
    }
    public function activate(Request $request)
    {
        try {
            //validate incoming request
            $this->validate($request, [
                'code' => 'required|string',
            ]);
            // {hash}_{userId}_{code}
            $codeAll = $request->input('code');
            $hash = explode('_', $codeAll);
            $userId = $hash[1];
            $tokenCode = Token::where('code', $hash[2])->first();
            if (!$tokenCode || !$tokenCode->isValid() || $userId != $tokenCode->member_id) {
                $msg = 'Your verification link is not valid';
                $url = "/#/login?type=activate&resCode=99&msg=" . $msg;
                return redirect($url);
                // return response()->json(['message' => 'Invalid token', 'error' => true], HttpStatusCodes::CLIENT_ERROR_BAD_REQUEST);
            }
            $user = User::findOrFail($userId);
            if (!$user->email_validated) {
                $user->email_validated = true;
                $user->save();
                // link account_member
                // LIX::linkAccount($user->email); // Disabled for local development
                // AC::accountRegister($user->email, $user->first_name, $user->last_name, $user->subscribe_email); // Disabled for local development
            }
            $tokenCode->used = true;
            $tokenCode->save();
            $msg = 'Your account has been successfully activated. please login!';
            $url = "/#/login?type=activate&resCode=00&msg=" . $msg;
            return redirect($url);
            // return response()->json(['message' => 'Your account has been successfully activated. please login', 'error' => false], HttpStatusCodes::SUCCESS_OK);
        } catch (\Exception $e) {
            $msg = 'Invalid token';
            $url = "/#/login?type=activate&resCode=99&msg=" . $msg;
            return redirect($url);
        }
    }
    public function acceptInvitation(Request $request)
    {
        try {
            //validate incoming request
            $this->validate($request, [
                'code' => 'required|string',
            ]);
            // {userId}_{inviteeId}_{code}
            $codeAll = $request->input('code');
            $hash = explode('_', $codeAll);
            if (count($hash) != 3) {
                $msg = 'Invalid token: length <> 3';
                $url = "/#/login?type=invitation&resCode=99&msg=" . $msg;

                return redirect($url);
            }
            $member_id = $hash[0];
            $organization_id = $hash[1];
            $code = $hash[2];
            DB::enableQueryLog();
            $invitation = Invitation::where('code', $code)->first();
            Log::debug(DB::getQueryLog());

            Log::info('===========invitationchekc========');
            Log::info($invitation);
            Log::info($organization_id == $invitation->account_id);
            Log::info($organization_id);
            Log::info($invitation->account_id);
            Log::info('===========!invitationchekc========');

            if (!($invitation && $member_id == (int) $invitation->data && $organization_id == $invitation->account_id)) {
                $msg = 'Invalid token';
                $url = "/#/login?type=invitation&resCode=99&msg=" . $msg;
                return redirect($url);
                // return response()->json(['message' => 'Invalid token', 'error' => true], HttpStatusCodes::CLIENT_ERROR_BAD_REQUEST);
            }
            $user = User::where('account_id', $member_id)->first();
            if (!$user) {
                $msg = 'Invalid member_id';
                $url = "/#/login?type=invitation&resCode=99&msg=" . $msg;
                return redirect($url);
            }
            $organization = Account::where('id', $organization_id)->first();
            if (!$organization) {
                $msg = 'Invalid organization_id';
                $url = "/#/login?type=invitation&resCode=99&msg=" . $msg;
                return redirect($url);
            }
            $account_member = AccountMember::where('account_id', $organization_id)->where('member_id', $member_id)->first();
            if ($account_member) {
                $msg = 'User are already belong organization';
                $url = "/#/login?type=invitation&resCode=99&msg=" . $msg;
                return redirect($url);
            }
            $invitation->delete();
            //Add member_id join account_id as normal user
            $account_member = new AccountMember;
            $account_member->member_role = 0;
            $account_member->account_id = $organization_id;
            $account_member->member_id = $member_id;
            $account_member->save();

            //Send Email
            MailHelper::sendEmail(
                $user->email,
                new JoinConfirmation($user, $organization)
            );

            $msg = 'Your account has been successfully accepted invitation. please login!';
            $url = "/#/login?type=activate&resCode=00&msg=" . $msg;
            return redirect($url);
            // return response()->json(['message' => 'Your account has been successfully activated. please login', 'error' => false], HttpStatusCodes::SUCCESS_OK);
        } catch (\Exception $e) {
            Log::info('===========errorsreAcceptIviation========');
            Log::info($e);
            Log::info('===========!errorsreAcceptIviation========');
            $msg = 'Invalid token';
            $url = "/#/login?type=activate&resCode=99&msg=" . $msg;
            return redirect($url);
        }
    }
    public function reActivate(Request $request)
    {
        try {
            //validate incoming request
            $this->validate($request, [
                'code' => 'required|string',
            ]);
            // {hash}_{userId}_{code}
            $codeAll = $request->input('code');
            $hash = explode('_', $codeAll);
            $userId = $hash[1];
            $tokenCode = Token::where('code', $hash[2])->first();
            if (!$tokenCode || !$tokenCode->isValid() || $userId != $tokenCode->member_id) {
                $msg = 'Invalid token';
                $url = "/#/licenses?type=reactivate&resCode=99&msg=" . $msg;
                return redirect($url);
                // return response()->json(['message' => 'Invalid token', 'error' => true], HttpStatusCodes::CLIENT_ERROR_BAD_REQUEST);
            }
            $user = User::findOrFail($userId);

            // $tokenCode->used = true;
            // $tokenCode->save();
            $license = License::findOrFail($tokenCode->extension_data);

            $today = date('Y-m-d');
            $now = strtotime($today);

            if ($license && $license->scheme_id && $license->can_renewal == 1 && strtotime($license->expiry_date) < $now) {
                $scheme = Scheme::findOrFail($license->scheme_id);
                $expiry_date = strtotime($today . "+ " . $scheme->validity . " days");
                //$expiry_date = strtotime($license->expiry_date . "+ " . $license->life_cycle . " days");
                $license->expiry_date = date('Y-m-d', $expiry_date);
                $license->save();

                //Set licenses details
                $user->productName = $license->product->name;
                $user->kindDisplay = $license->scheme->kindDisplay;
                $user->licensePeriod = $license->expiry_date;
                $user->licensePeriod = date("d-m-Y", strtotime($today)) . ' to ' . date("d-m-Y", strtotime($license->expiry_date));
            }
            //Send mail reactive success
            $jsonApiResponse = MailHelper::sendEmail(
                $user->email,
                new ReActiveLicenseSuccess($user),
                ResponseHelper::getJsonApiResponse($user, HttpStatusCodes::SUCCESS_CREATED)
            );
            $msg = 'Your license has been reactivate successfully!';
            $url = "/#/licenses?type=reactivate&resCode=00&msg=" . $msg;
            return redirect($url);
            // return response()->json(['message' => 'Your account has been successfully activated. please login', 'error' => false], HttpStatusCodes::SUCCESS_OK);
        } catch (\Exception $e) {
            Log::info('===========errorsreActivate========');
            Log::info($e);
            Log::info('===========!errorsreActivate========');
            $msg = 'Invalid token';
            $url = "/#/licenses?type=reactivate&resCode=99&msg=" . $msg;
            return redirect($url);
        }
    }

    public function register(Request $request)
    {
        //validate incoming request
        $customMessages = [
            'email.unique' => 'Account already exits. Go to sign in.',
        ];
        $this->validate($request, [
            'email' => 'required|email|unique:identity',
            'password_confirmation' => 'required|string',
            'first_name' => 'required|string',
            'last_name' => 'required|string',
            'password' => 'required|string|required_with:password_confirmation|same:password_confirmation',
            'accept_conditions' => 'accepted',
        ], $customMessages);

        try {
            try {
                DB::beginTransaction();

                //Create account with user
                $account = new Account;
                $account->name = $request->input('email');
                $account->type = 0;
                $account->save();

                $user = new User;
                $user->user_name = $request->input('email');
                $user->email = $request->input('email');
                $user->first_name = $request->input('first_name');
                $user->last_name = $request->input('last_name');
                $user->role = 0;
                $user->email_validated = false;
                $user->subscribe_email = $request->input('subscribe_email') ? 1 : 0;

                // $userCheck->code = $token->code;
                //$passwordRandom = $request->input('last_name');
                $plainPassword = $request->input('password');
                $user->password = app('hash')->make($plainPassword);

                $user->account_id = $account->id;

                //Create Account Member when detect request JWT payload contain organziation
                if ($request->has('code')) {
                    $code = $request['code'];
                    $invitation = Invitation::where('code', $code)->first();
                    if ($invitation && $invitation->data == $user->email) {
                        $newAccountMember = new AccountMember;
                        $newAccountMember->account_id = $invitation->account_id;
                        $newAccountMember->member_id = $user->account_id;
                        $newAccountMember->member_role = $invitation->as_admin ? 1 : 0;
                        $newAccountMember->save();
                        $organization = Account::where('id', $invitation->account_id)->first();
                        MailHelper::sendEmail(
                            $user->email,
                            new JoinConfirmation($user, $organization),
                            ResponseHelper::getJsonApiResponse($user, HttpStatusCodes::SUCCESS_CREATED)
                        );
                        $user->email_validated = true; //Don't need validate because they confirm previous
                        $user->save();
                        $invitation->delete();
                    } else {
                        $errors = ['message' => ['Invitation link is outdated. Check for newer invitation']];
                        return response()->json($errors, HttpStatusCodes::CLIENT_ERROR_BAD_REQUEST);
                    }
                } else {
                    $user->save();

                    $email_check = explode('@', $request->input('email'));
                    $current_account = Account::where('domain', $email_check[1])->first();
                    if ($current_account) { //Or detect when domain email is exits
                        $newAccountMember = new AccountMember;
                        $newAccountMember->account_id = $current_account->id;
                        $newAccountMember->member_id = $user->account_id;
                        $newAccountMember->member_role = 0;
                        $newAccountMember->save();
                    }
                    $this->sendVerifyEmail($user);
                }

                DB::commit();
                // LIX::linkAccount($user->email); // Disabled for local development

                return response()->json(['user' => null, 'message' => 'Please check your email.'], 200);

            } catch (\PDOException $e) {
                Log::info($e);
                DB::rollBack();
                throw $e;
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

    protected function respondWithToken($token, $code, $theEmail, $check2fa = true)
    {
        $user = $this->guard();
        if (!$user->email_validated) {
            //    return response()->json(['message' => 'Please activate your account! <br/> <a href="#/reverify">Click to resend verification email.</a>'], 400);
            // return response()->json(['message' => "<p><An <b>Activation Link</b> has been sent to: <b>{$theEmail}</b></p>"
            // ."<p>If the email is <b>not in your Inbox</b> then please check your <b>SPAM FOLDER!</b></p>"
            // .'<p>If you for some reason lost the activation email, a new one can be <a href="#/reverify">resent here.</a></p>'], 400);

            return response()->json(['message' => 'EmailNotValidated'], 400);
        }
        //Account deleted
        // if ($user->deleted_at != null) {
        //     return response()->json(['message' => 'Unauthorized'], 400);
        // }
        if ($check2fa && $user->two_factor_enabled) {
            if ($code && $code != '') {
                $tokenCode = Token::where('code', $code)->first();
                $user = Auth::user();
                if (!$tokenCode || !$tokenCode->isValid() || $user->id != $tokenCode->member_id) {
                    return response()->json(['message' => 'Invalid token', 'error' => true, 'twoStepVerification' => true], 200);
                }
                $tokenCode->used = true;
                $tokenCode->save();
            } else {
                $userCheck = User::where('id', $user->id)->first();
                $this->sendMailCode($userCheck);
                return response()->json(['message' => 'Show 2 Step Verification', 'twoStepVerification' => true], 200);
            }
        }
        return response()->json([
            'token' => $token,
            'user' => $this->guard(),
            'token_type' => 'bearer',
            'expires_in' => Auth::factory()->getTTL() * 60,
        ], 200);
    }

    public function sendMailCode($user)
    {
        $token = Token::create([
            'member_id' => $user->id,
            'extension_data' => '',
        ]);
        Log::info('===========code createToken========');
        Log::info($token->code);
        Log::info('===========code createToken========');
        $user->code = $token->code;
        $jsonApiResponse = MailHelper::sendEmail(
            $user->email,
            new SendCodeConfirmation($user),
            ResponseHelper::getJsonApiResponse($user, HttpStatusCodes::SUCCESS_CREATED)
        );
        return true;
    }

    public function sendVerifyEmail($user)
    {
        $token = Token::create([
            'member_id' => $user->id,
            'extension_data' => '',
        ]);
        Log::info('===========code createToken========');
        Log::info($token->code);
        Log::info('===========code createToken========');
        $user->code = $token->code;
        // Email sending disabled for local development
        // $jsonApiResponse = MailHelper::sendEmail(
        //     $user->email,
        //     new ActiveAccount($user),
        //     ResponseHelper::getJsonApiResponse($user, HttpStatusCodes::SUCCESS_CREATED)
        // );
    }

    public function ReverifyEmail(Request $request)
    {
        //validate incoming request
        $this->validate($request, [
            'email' => 'required|string',
        ]);
        $user = User::where('email', $request->email)->first();
        if ($user) {
            if (!$user->email_validated) {
                $this->sendVerifyEmail($user);
                return response()->json([
                    'status' => 'A verification email has been sent',
                ], 200);
            } else {
                return response()->json([
                    'email' => ['Email is verified'],
                ], 422);
            }
        } else {
            return response()->json([
                'email' => ['Your email does not exist in the system'],
            ], 422);
        }
    }
    // public function guard()
    // {
    //     return Auth::Guard('api')->user();
    // }

}
