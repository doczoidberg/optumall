<?php

namespace App\Http\Controllers;

use App\AC;
use App\LIX;
use App\Helpers\HttpStatusCodes;
use App\Helpers\MailHelper;
use App\Helpers\ResponseHelper;
use App\Mail\ActiveLicense;
use App\Mail\ReActiveLicense;
use App\Models\Account;
use App\Models\AccountGroup;
use App\Models\AccountMember;
use App\Models\AccountScheme;
use App\Models\Assignment;
use App\Models\GroupMember;
use App\Models\License;
use App\Models\Product;
use App\Models\Scheme;
use App\Models\Seat;
use App\Models\Token;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Log;

class LicenseController extends Controller
{
    public function __construct()
    {
        $this->middleware('auth');
    }
    /**
     * Create a new controller instance.
     *
     * @return void
     */
    public function index()
    {
        $current_user = Auth::user();
        return response()->json($this->accountLicenses($current_user->account_id));
    }
    public function index1()
    {
        $current_user = Auth::user();
        return response()->json($this->accountLicenses1($current_user->account_id));
    }

    public function accountLicenses1($accId)
    {
        try {
            $list_license_ids = Assignment::where('account_id', $accId)->pluck('license_id')->toArray();
            $list_license_ids = array_unique($list_license_ids);
            $accountMember = AccountMember::where('member_id', $accId)->pluck('account_id')->toArray();
            $licenses = License::whereIn('id', $list_license_ids)->with(['product', 'account', 'scheme', 'accounts'])->get();
            $scheme_ids = $licenses->pluck('scheme_id');

            $blackListTrialProduct = Product::where('name', 'OPTUM C')->pluck('id')->toArray();
            if ($accountMember) {
                $account = Account::whereIn('id', $accountMember)->where('type', 3)->pluck('id')->toArray();
                if ($account) {
                    $account_scheme_ids = AccountScheme::whereIn('account_id', $account)->pluck('scheme_id')->toArray();
                    $licensesTrial = Scheme::where(function ($q) use (&$account_scheme_ids) {
                        $q->whereIn('kind', [0, 1])->orWhereIn('id', $account_scheme_ids);
                    })->whereNotIn('id', $scheme_ids)->whereNotIn('product_id', $blackListTrialProduct)->with(['product'])->get();
                } else {
                    $licensesTrial = Scheme::where('kind', 0)->whereNotIn('id', $scheme_ids)
                        ->whereNotIn('product_id', $blackListTrialProduct)->with(['product'])->get();
                }
            } else {
                $licensesTrial = Scheme::where('kind', 0)->whereNotIn('id', $scheme_ids)
                    ->whereNotIn('product_id', $blackListTrialProduct)->with(['product'])->get();
            }
            $licenses = $licenses->toArray();
            $max = \DateTime::createFromFormat('m-d-Y', '01-01-3000')->format('Y-m-d');
            foreach ($licenses as $k=>$v) {
                if($v['expiry_date']>=$max)
                    $licenses[$k]['expiry_date'] = "N/A";
            }
            $licensesTrial->map(function ($licenseTrial) {
                $licenseTrial["statusKey"] = 0;
                $licenseTrial["status"] = '<span class="available">Available</span>';
                return $licenseTrial;
            });
            return $licensesTrial->concat($licenses);
        } catch (\Exception $e) {
            //return error message
            Log::info('===========errors get License========');
            Log::info($e);
            Log::info('===========!errors License========');
            return [];
        }
    }

    public function accountLicenses($accId)
    {
        try {
            $list_license_ids = Assignment::where('account_id', $accId)->pluck('license_id')->toArray();
            $list_license_ids = array_unique($list_license_ids);
            $accountMember = AccountMember::where('member_id', $accId)->pluck('account_id')->toArray();
            $licenses = License::whereIn('id', $list_license_ids)->with(['product', 'account', 'scheme', 'accounts'])->get();
            $scheme_ids = $licenses->pluck('scheme_id');

            $blackListTrialProduct = Product::where('name', 'OPTUM C')->pluck('id')->toArray();
            if ($accountMember) {
                $account = Account::whereIn('id', $accountMember)->where('type', 3)->pluck('id')->toArray();
                if ($account) {
                    $account_scheme_ids = AccountScheme::whereIn('account_id', $account)->pluck('scheme_id')->toArray();
                    $licensesTrial = Scheme::where(function ($q) use (&$account_scheme_ids) {
                        $q->whereIn('kind', [0, 1])->orWhereIn('id', $account_scheme_ids);
                    })->whereNotIn('id', $scheme_ids)->whereNotIn('product_id', $blackListTrialProduct)->with(['product'])->get();
                } else {
                    $licensesTrial = Scheme::where('kind', 0)->whereNotIn('id', $scheme_ids)
                        ->whereNotIn('product_id', $blackListTrialProduct)->with(['product'])->get();
                }
            } else {
                $licensesTrial = Scheme::where('kind', 0)->whereNotIn('id', $scheme_ids)
                    ->whereNotIn('product_id', $blackListTrialProduct)->with(['product'])->get();
            }
            $licenses = $licenses->toArray();
            $max = \DateTime::createFromFormat('m-d-Y', '01-01-3000')->format('Y-m-d');
            foreach ($licenses as $k=>$v) {
                if($v['expiry_date']>=$max)
                    $licenses[$k]['expiry_date'] = "N/A";
            }
            $licensesTrial->map(function ($licenseTrial) {
                $licenseTrial["statusKey"] = 0;
                $licenseTrial["status"] = '<span class="available">Available</span>';
                return $licenseTrial;
            });
            return $licensesTrial->concat($licenses);
        } catch (\Exception $e) {
            //return error message
            Log::info('===========errors get License========');
            Log::info($e);
            Log::info('===========!errors License========');
            return [];
        }
    }

    private function sendMailActiveLicenseSuccess($user, $licenseInfo)
    {
        try {
            $userCheck = User::where('id', $user->id)->first();
            // Set license
            $userCheck->productName = $licenseInfo->product->name;
            $userCheck->kindDisplay = $licenseInfo->scheme->kindDisplay;

            $today = date('Y-m-d');
            $now = strtotime($today);
            $expiry_date = strtotime($licenseInfo->expiry_date);
            if ($expiry_date > $now) {
                $licensePeriod = date("d-m-Y", strtotime($today)) . ' to ' . date("d-m-Y", $expiry_date);
            } else {
                $licensePeriod = date("d-m-Y", $expiry_date);
            }
            $userCheck->licensePeriod = $licensePeriod;
            $jsonApiResponse = MailHelper::sendEmail(
                $userCheck->email,
                new ActiveLicense($userCheck),
                ResponseHelper::getJsonApiResponse($userCheck, HttpStatusCodes::SUCCESS_CREATED)
            );
            return true;
        } catch (\Exception $e) {
            //return error message
            Log::info('===========sendMailActiveLicenseSuccess errors========');
            Log::info($e);
            Log::info('===========!sendMailActiveLicenseSuccess errors========');
            // return response()->json(['message' => 'User Registration Failed!'], 400);
            $errors = ['message' => ['Cannot send mail. Please contact admin']];
            return false;
        }
    }
    public function activeLicense(Request $request)
    {
        $current_user = Auth::user();
        $this->validate($request, [
            'id' => 'required',
            'type' => 'required',
        ]);
        try {
            $lid = LIX::createLicense($current_user->account_id, $request->input('id'));
            $licenseInfo = License::where('id', $lid)->with(['product', 'scheme'])->first();
            $this->sendMailActiveLicenseSuccess($current_user, $licenseInfo);
            AC::licenseCreated($lid);
            return response()->json(['message' => 'Create license success.', 'stauts' => true], HttpStatusCodes::SUCCESS_CREATED);
        } catch (\Exception $e) {
            Log::info('===========errorslicense========');
            Log::info($e);
            Log::info('===========!errorslicense========');
            $errors = ['message' => 'Error creating license', 'stauts' => false];
            return response()->json($errors, HttpStatusCodes::CLIENT_ERROR_BAD_REQUEST);
        }
    }

    public function updateLicense(Request $request)
    {
        $current_user = Auth::user();
        if ($current_user->role < 1) {
            return response()->json(['message' => 'Please login'], 403);
        }
        $this->validate($request, [
            'code' => 'required',
            'memberId' => 'required',
        ]);
        $tokenCode = Token::where('code', $code)->first();
        $user = User::findOrFail($request->input('memberId'));
        if (!$tokenCode || !$tokenCode->isValid() || $user->id != $tokenCode->member_id) {
            return response()->json(['message' => 'Invalid token', 'error' => true, 'twoStepVerification' => true], 200);
        }
        $tokenCode->used = true;
        $tokenCode->save();
        $licenseData = json_decode($tokenCode->extension_data, true);
        if ($licenseData) {
            $license = License::where('id', $licenseData['licenseId'])->with(['scheme', 'accounts'])->first();
            if ($license) {
                $expiry_date = $license->expiry_date;
                $license->expiry_date = date('Y-m-d', strtotime($expiry_date . ' + ' . $scheme->validity . ' days'));
                $license->save();
            }
        }
        $msg = ['message' => ['Update license success.']];
        return response()->json($msg, HttpStatusCodes::SUCCESS_OK);
        try {
            $scheme = Scheme::findOrFail($request->input('schemeId'));
            License::
                $license = [
                'owner_id' => $request->input('owner_id'),
                'product_id' => $scheme->product_id,
                'seat_limit' => $scheme->seat_limit,
                'user_seat_limit' => $scheme->user_seat_limit,
                'node_limit' => $scheme->node_limit,
                'instance_limit' => $scheme->instance_limit,
                'text' => $scheme->text,
                'type' => $scheme->type,
                'scheme_id' => $scheme->id,
                'features' => $scheme->features,
                'assignment_policy' => $scheme->assignment_policy,
                'scheme_id' => $scheme->id,
                'can_renewal' => $scheme->can_renewal,
            ];
            License::create($license);
            $msg = ['message' => [' creating license success.']];
            return response()->json($msg, HttpStatusCodes::SUCCESS_CREATED);
        } catch (\Exception $e) {
            Log::info('===========errorslicense========');
            Log::info($e);
            Log::info('===========!errorslicense========');
            $errors = ['message' => ['Error creating license.']];
            return response()->json($errors, HttpStatusCodes::CLIENT_ERROR_BAD_REQUEST);
        }
    }

    // public function getAllByAdmin()
    // {
    //     $current_user = Auth::user();
    //     $list_license_ids = Assignment::where('account_id', $current_user->account_id)->pluck('license_id')->toArray();
    //     $list_license_ids = array_unique($list_license_ids);
    //     //Get License by Id
    //     $account = AccountMember::where('member_id', $current_user->account_id)->first();
    //     if ($account) {
    //         $licenses = License::whereIn('id', $list_license_ids)->orWhere('owner_id', '=', $account->account_id)->with(['product', 'account', 'scheme', 'accounts'])->get();
    //     } else {
    //         $licenses = License::whereIn('id', $list_license_ids)->orWhere('owner_id', '=', $current_user->account_id)->with(['product', 'account', 'scheme', 'accounts'])->get();
    //     }

    //     return response()->json($licenses);
    // }
    public function getAllByAdmin()
    {
        $current_user = Auth::user();
        if ($current_user->role < 1) {
            return response()->json(['message' => 'Please login'], 403);
        }

        // Super admin (role=2) sees ALL licenses (limited to 100 for performance)
        if ($current_user->role == 2) {
            // Use raw query without any appends to avoid slow accessors
            $licenses = License::with(['product', 'account', 'scheme'])
                ->limit(100)
                ->get()
                ->makeHidden(['account', 'accounts']); // Hide heavy relations
            // NO setAppends - accessors are too slow
            return response()->json($licenses);
        }

        // Regular admin - organization based
        $account = AccountMember::where('member_id', $current_user->account_id)->where('member_role', 1)->first();
        if ($account) {
            $licenses = License::where('owner_id', '=', $account->account_id)->with(['product', 'account', 'scheme', 'accounts'])->get();
        } else {
            $licenses = License::where('owner_id', '=', $current_user->account_id)->with(['product', 'account', 'scheme', 'accounts'])->get();
        }
        return response()->json($licenses);
    }
    public function getByUserId($user_id)
    {
        $current_user = Auth::user();
        if ($current_user->role < 1) {
            return response()->json(['message' => 'Please login'], 403);
        }
        $groupIds = AccountGroup::where('account_id', $current_user->account_id)->pluck('id')->toArray();
        $groupIds = array_unique($groupIds);
        // Find all member on group
        $accounts = GroupMember::whereIn('id', $groupIds)->get();
        $licenses = License::with(['product', 'account', 'scheme'])->where('owner_id', $user_id)->get();
        return response()->json($licenses);
    }
    // public function myLicenses($user_id)
    // {
    //     $current_user = Auth::user();
    //     $user = User::findOrFail($user_id);
    //     $list_license_ids = Assignment::where('account_id', $current_user->account_id)->pluck('license_id')->toArray();
    //     $list_license_ids = array_unique($list_license_ids);
    //     $accountMember = AccountMember::where('member_id', $current_user->account_id)->first();
    //     $account_id = $accountMember != null ? $accountMember->account_id : $current_user->account_id;
    //     $licenses = License::whereIn('id', $list_license_ids)->orWhere('owner_id', '=', $account_id)->orWhere('owner_id', '=', $user->account_id)->with(['product', 'account', 'scheme', 'accounts'])->get();
    //     foreach ($licenses as $license) {
    //         $license->assign = Assignment::where('account_id', $user->account_id)->where('license_id', $license->id)->exists();
    //     }
    //     return response()->json($licenses);
    // }
    // GET Licenses by USER ID
    public function myLicenses($user_id)
    {
        $current_user = Auth::user();
        if ($current_user->role < 1) {
            return response()->json(['message' => 'Please login'], 403);
        }
        $user = User::findOrFail($user_id);

        // Super admin sees all licenses assigned to this user
        if ($current_user->role == 2) {
            $list_license_ids = Assignment::where('account_id', $user->account_id)->pluck('license_id')->toArray();
            $licenses = License::whereIn('id', $list_license_ids)
                ->orWhere('owner_id', '=', $user->account_id)
                ->with(['product', 'account', 'scheme', 'accounts'])
                ->limit(100)
                ->get();
        } else {
            // Regular admin - organization based
            $account = AccountMember::where('member_id', $current_user->account_id)->where('member_role', 1)->first();
            if ($account) {
                $licenses = License::where('owner_id', '=', $account->account_id)->with(['product', 'account', 'scheme', 'accounts'])->get();
            } else {
                $licenses = License::where('owner_id', '=', $current_user->account_id)->with(['product', 'account', 'scheme', 'accounts'])->get();
            }
        }

        foreach ($licenses as $license) {
            $license->assign = Assignment::where('account_id', $user->account_id)->where('license_id', $license->id)->exists();
        }
        return response()->json($licenses);
    }

    public function removeAccountOutSeat(Request $request)
    {
        $this->validate($request, [
            'seat_id' => 'required',
        ]);
        try {
            $seat_id = $request->input('seat_id');
            Seat::where('id', $seat_id)->delete();
            $message = " Remove success!";
            $response = ['message' => $message];
            return response()->json($response);
        } catch (\Exception $e) {
            Log::info('===========removeAccountOutSeat========');
            Log::info($e);
            Log::info('===========!removeAccountOutSeat========');
            $response = ['message' => 'Remove Error'];
            return response()->json($response);
        }
    }
    public function sendMail(Request $request)
    {
        $this->validate($request, [
            'id' => 'required',
            'type' => 'required|string',
        ]);
        $user = Auth::user();
        try {
            $userCheck = User::where('id', $user->id)->first();
            $type = $request->input('type');
            //Click nhiều lần thì sẽ như thế nào
            $licenseId = $request->input('id');
            if ($type == 'resend') {
                $token = Token::create([
                    'member_id' => $userCheck->id,
                    'extension_data' => $licenseId,
                ]);
                $userCheck->code = $token->code;
                $jsonApiResponse = MailHelper::sendEmail(
                    $userCheck->email,
                    new ReActiveLicense($userCheck),
                    ResponseHelper::getJsonApiResponse($user, HttpStatusCodes::SUCCESS_CREATED)
                );
            }

            return response()->json(['message' => 'SENT', 'email' => $userCheck->email], HttpStatusCodes::SUCCESS_CREATED);
        } catch (\Exception $e) {
            //return error message
            Log::info('===========errors========');
            Log::info($e);
            Log::info('===========!errors========');
            // return response()->json(['message' => 'User Registration Failed!'], 400);
            $errors = ['message' => ['Cannot send mail. Please contact admin']];
            return response()->json($errors, HttpStatusCodes::CLIENT_ERROR_BAD_REQUEST);
        }

    }
    public function getDetail($id)
    {
        //DB::enableQueryLog();
        $license = License::where('id', $id)->with(['product', 'account', 'scheme'])->first();
        $current_user = Auth::user();
        if ($current_user->role < 1) {
            return response()->json(['message' => 'Please login'], 403);
        }
        $accountMember = AccountMember::where('member_id', $current_user->account_id)->where('member_role', 1)->first();
        $account_id = $accountMember != null ? $accountMember->account_id : $current_user->account_id;
        $members = AccountMember::where('account_id', $account_id)->get();
        foreach ($members as $mem) {
            $mem->member = User::where('account_id', $mem->member_id)->first();
            if ($mem->member) {
                $mem->assign = Assignment::where('account_id', $mem->member->account_id)->where('license_id', $id)->exists();
            } else {
                $mem->assign = false;
            }
        }
        // Log::debug(DB::getQueryLog());
        $response = ['license' => $license, 'members' => $members];
        return response()->json($response);
    }
    public function automaticAssign(Request $request)
    {
        $this->validate($request, [
            'licenseId' => 'required',
            'type' => 'required',
        ]);
        $current_user = Auth::user();
        if ($current_user->role < 1) {
            return response()->json(['message' => 'Please login'], 403);
        }
        try {
            License::where('id', $request->input('licenseId'))
                ->update([
                    'automatic_assign' => $request->input('type'),
                ]);
            $message = "Update successful!";
            $response = ['message' => $message];
            return response()->json($response);
        } catch (\Exception $e) {
            Log::info('===========automaticAssign========');
            Log::info($e);
            Log::info('===========!automaticAssign========');
            $response = ['message' => 'Error'];
            return response()->json($response);
        }
    }
    public function assign(Request $request)
    {
        $this->validate($request, [
            'licenseId' => 'required',
            'account_id' => 'required',
            'type' => 'required|string',

        ]);
        $current_user = Auth::user();
        if ($current_user->role < 1) {
            return response()->json(['message' => 'Please login'], 403);
        }
        //Need check own - superadmin can access all
        $accountMember = AccountMember::where('member_id', $current_user->account_id)->where('member_role', 1)->first();
        if ($current_user->role == 2) {
            $license = License::where('id', $request->input('licenseId'))->first();
        } else {
            $license = License::where('id', $request->input('licenseId'))->where('owner_id', $accountMember->account_id)->first();
        }
        if (!$license) {
            return response()->json(['message' => 'This oganization is not own this license'], 400);
        }
        //$license = License::where('id',$id)->with(['product','account','scheme'])->first();
        try {
            $type = $request->input('type');
            $licenseId = $request->input('licenseId');

            $account_id = $request->input('account_id');
            $message = "";

            //25112020 - Hungdt: trường license.arbitrary_domain=1 và license.assignment_policy=1, thì không được assign license cho user mà domain không nằm trong danh sách license.assignment_policy_data
            $user = User::where('account_id', $account_id)->first();
            $license = License::FindOrFail($licenseId);
            if ($license->arbitrary_domain == 1 && $license->assignment_policy == 1 && strpos($license->assignment_policy_data, explode('@', $user->email)[1]) === false) {
                $message = "Assign user fail! Email " . $user->email . " is not in list domains: " . $license->assignment_policy_data;
            } else {
                if ($type == 'Assign') {

                    $assignment = Assignment::firstOrNew(['license_id' => $licenseId, 'account_id' => $account_id]);
                    $assignment->license_id = $licenseId;
                    $assignment->account_id = $account_id;
                    $assignment->save();
                    $message = " Assign user success!";
                } else {
                    //$license = License::FindOrFail($licenseId);
                    $isSuccess = true;
                    foreach ($license->seatAccounts as $seat) {
                        if ($seat->accountId == $account_id) {
                            $isSuccess = false;
                            break;
                        }
                    }
                    if ($isSuccess) {
                        Assignment::where('license_id', $licenseId)->where('account_id', $account_id)->delete();
                        $message = " Unassign user success!";
                    } else {
                        $errors = ['message' => 'Unassign user failed. The user has active license', 'stauts' => false];
                        return response()->json($errors, HttpStatusCodes::CLIENT_ERROR_BAD_REQUEST);
                    }
                    //Check account exist active users of licenses

                }
            }

            $response = ['message' => $message];
            return response()->json($response);
        } catch (\Exception $e) {
            Log::info('===========errorsassign========');
            Log::info($e);
            Log::info('===========!errorsassign========');
            $response = ['message' => 'Error'];
            return response()->json($response);
        }
    }
    public function assignUsers(Request $request)
    {
        $this->validate($request, [
            'licenseId' => 'required',
            'type' => 'required|string',
        ]);
        $current_user = Auth::user();
        if ($current_user->role < 1) {
            return response()->json(['message' => 'Please login'], 403);
        }

        //Need check own - superadmin can access all
        $accountMember = AccountMember::where('member_id', $current_user->account_id)->where('member_role', 1)->first();
        if ($current_user->role == 2) {
            $license = License::where('id', $request->input('licenseId'))->first();
        } else {
            $license = License::where('id', $request->input('licenseId'))->where('owner_id', $accountMember->account_id)->first();
        }
        if (!$license) {
            return response()->json(['message' => 'This oganization is not own this license'], 400);
        }
        //$license = License::where('id',$id)->with(['product','account','scheme'])->first();

        $type = $request->input('type');
        $licenseId = $request->input('licenseId');
        $message = "";
        $accountMember = AccountMember::where('member_id', $current_user->account_id)->first();
        $account_id = $accountMember != null ? $accountMember->account_id : $current_user->account_id;
        $members = AccountMember::where('account_id', $account_id)->get();

        //25112020 - Hungdt: trường license.arbitrary_domain=1 và license.assignment_policy=1, thì không được assign license cho user mà domain không nằm trong danh sách license.assignment_policy_data
        $license = License::FindOrFail($licenseId);
        $usingDomainCheck = $license->arbitrary_domain == 1 && $license->assignment_policy == 1;

        $isNotSuccessEmails = "";

        if ($type == 'Assign') {
            $message = "Assign all users success! ";
            foreach ($members as $m) {
                $m->member = User::where('account_id', $m->member_id)->first();
                if ($m->member) {
                    if ($usingDomainCheck && strpos($license->assignment_policy_data, explode('@', $m->member->email)[1]) === false) {
                        $isNotSuccessEmails = $isNotSuccessEmails . $m->member->email . ", ";
                    } else {
                        $assignment = Assignment::firstOrNew(['license_id' => $licenseId, 'account_id' => $m->member->account_id]);
                        $assignment->license_id = $licenseId;
                        $assignment->account_id = $m->member->account_id;
                        $assignment->save();
                    }
                }
            }
        } else {
            //$license = License::FindOrFail($licenseId);
            $account_ids = array();
            foreach ($license->seatAccounts as $seat) {
                array_push($account_ids, $seat->accountId);
            }
            $message = " Unassign all users! ";
            foreach ($members as $m) {
                if (!in_array($m->member_id, $account_ids)) {
                    $m->member = User::where('account_id', $m->member_id)->first();
                    if ($usingDomainCheck && strpos($license->assignment_policy_data, explode('@', $m->member->email)[1]) === false) {
                        $isNotSuccessEmails = $isNotSuccessEmails . $m->member->email . ", ";
                    } else {
                        Assignment::where('license_id', $licenseId)->where('account_id', $m->member_id)->delete();
                    }
                }
                // if ($m->member) {
                //     Assignment::where('license_id', $licenseId)->where('account_id', $m->member->account_id)->delete();
                // }
            }
        }
        if ($isNotSuccessEmails !== "") {
            $message = $message . "Not inclues: " . $isNotSuccessEmails;
        }

        $response = ['message' => $message, $members];
        return response()->json($response);
    }

    public function reSend(Request $request)
    {
        $this->validate($request, [
            'license_id' => 'required',
        ]);
        $licenses = License::with(['product', 'account', 'scheme'])->where('owner_id', $user_id)->get();
        return response()->json($licenses);
    }

}
