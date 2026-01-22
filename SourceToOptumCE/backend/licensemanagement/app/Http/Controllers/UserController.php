<?php

namespace App\Http\Controllers;

use App\Helpers\HttpStatusCodes;
use App\Helpers\MailHelper;
use App\Helpers\ResponseHelper;
use App\Mail\SendCodeConfirmation;
use App\Models\AccountMember;
use App\Models\GroupMember;
use App\Models\Invitation;
use App\Models\Token;
use App\Models\User;
use DB;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use Log;

class UserController extends Controller
{
    /**
     * Instantiate a new UserController instance.
     *
     * @return void
     */
    public function __construct()
    {
        $this->middleware('auth');
    }

    /**
     * Get the authenticated User.
     *
     * @return Response
     */
    public function profile()
    {
        $userCurrent = Auth::user();
        $user = User::findOrFail($userCurrent->id);
        return response()->json(['user' => $user], 200);
    }

    public function createToken()
    {
        try {
            $user = Auth::user();
            $userCheck = User::where('id', $user->id)->first();
            $token = Token::create([
                'member_id' => $user->id,
            ]);
            Log::info('===========code createToken========');
            Log::info($token->code);
            Log::info('===========code createToken========');
            $userCheck->code = $token->code;
            $jsonApiResponse = MailHelper::sendEmail(
                $userCheck->email,
                new SendCodeConfirmation($userCheck),
                ResponseHelper::getJsonApiResponse($user, HttpStatusCodes::SUCCESS_CREATED)
            );
            return response()->json(['message' => 'Please check your email'], 200);
        } catch (\Exception $e) {
            //return error message
            Log::info('===========errors createToken========');
            Log::info($e);
            Log::info('===========!errors createToken========');
            // return response()->json(['message' => 'User Registration Failed!'], 400);
            $errors = ['message' => ['Cannot create code.']];
            return response()->json($errors, HttpStatusCodes::CLIENT_ERROR_BAD_REQUEST);
        }
    }

    /**
     * Get all User.
     *
     * @return Response
     */
    public function allUsers(Request $request)
    {
        $current_user = Auth::user();
        if ($current_user->role < 1) {
            return response()->json(['message' => 'Please login'], 403);
        }

        // Super admin (role=2) sees ALL users
        if ($current_user->role == 2) {
            $keyword = $request->input('keyword');
            $page = $request->input('page', 1);
            $per_page = $request->input('per_page', 500);
            $get_all = $request->input('get_all', false); // New parameter to get all users

            $query = User::query();
            if (trim($keyword) != '') {
                $query = $query->where(function($q) use ($keyword) {
                    $q->where('email', 'like', '%' . trim($keyword) . '%')
                      ->orWhere('first_name', 'like', '%' . trim($keyword) . '%');
                });
            }

            // If get_all is true, return all users without pagination
            if ($get_all === true || $get_all === 'true' || $get_all === '1') {
                $users = $query->get()->toArray();
                return response()->json([
                    'users' => $users,
                    'total' => count($users),
                    'page' => 1,
                    'per_page' => count($users),
                    'total_pages' => 1
                ], 200);
            }

            // Pagination
            $total = $query->count();
            $users = $query->skip(($page - 1) * $per_page)
                          ->take($per_page)
                          ->get()
                          ->toArray();

            return response()->json([
                'users' => $users,
                'total' => $total,
                'page' => (int)$page,
                'per_page' => (int)$per_page,
                'total_pages' => ceil($total / $per_page)
            ], 200);
        }

        // Regular admin - organization based
        $accountMember = AccountMember::where('member_id', $current_user->account_id)->where('member_role', 1)->first();
        $account_id = $accountMember != null ? $accountMember->account_id : $current_user->account_id;
        //List Id member in company
        $memberAndRoles = AccountMember::where('account_id', $account_id)->get()->toArray();
        $memberIds = array_unique(array_column($memberAndRoles, 'member_id'));
        $query = User::whereIn('account_id', $memberIds);
        $keyword = $request->input('keyword');
        if (trim($keyword) != '') {
            $query = $query->where('email', 'like', '%' . trim($keyword) . '%');
            $query = $query->orWhere('first_name', 'like', '%' . trim($keyword) . '%');
        }
        $users = $query->get()->toArray();

        $pendingExitsUserIds = Invitation::where('account_id', $account_id)->where('isNewUser', 0)->pluck('data')->toArray();
        $pendingExitsUsers = User::whereIn('account_id', $pendingExitsUserIds)->get()->toArray();

        $pendingNewMemberEmails = Invitation::where('account_id', $account_id)->where('isNewUser', 1)->pluck('data')->toArray();
        $pendingNewUsers = array_map(function ($email) {
            return ["name" => "New user", "roleName" => "User", "email" => $email, "first_name" => "New", "last_name" => "User",
                "avatarUrl" => env('APP_URL', BASE_URL) . "/images/avatar_default_new.jpg"];
        }, $pendingNewMemberEmails);

        $pendingUsers = array_merge($pendingExitsUsers, $pendingNewUsers);
        $pendingUsers = array_map(function ($user) {
            $user["isPending"] = 1;
            return $user;
        }, $pendingUsers);
        $allUsers = array_merge($users, $pendingUsers);

        $roleMapping = array_column($memberAndRoles, 'member_role', 'member_id');
        $allUsers = array_map(function ($user) use ($roleMapping) {
            if (array_key_exists('account_id', $user) && array_key_exists($user['account_id'], $roleMapping)) {
                $user['role'] = $roleMapping[$user['account_id']];
                $user['roleName'] = $user['role'] == 1 ? 'admin' : 'user';
            } else {
                $user['role'] = 0;
                $user['roleName'] = 'user';
            }
            return $user;
        }, $allUsers);

        return response()->json(['users' => $allUsers], 200);
    }

    /**
     * Get one user.
     *
     * @return Response
     */
    public function singleUser($id)
    {
        try {
            $user = User::findOrFail($id);

            return response()->json(['user' => $user], 200);

        } catch (\Exception $e) {

            return response()->json(['message' => 'user not found!'], 404);
        }

    }

    public function uploadImage(Request $request)
    {

        $this->validate($request, [
            'image' => 'required|image|mimes:jpeg,png,jpg,gif,svg|max:2048',
        ]);
        $response = null;
        $userResponse = (object) ['image' => ""];

        if ($request->hasFile('image')) {
            $user = Auth::user();
            $original_filename = $request->file('image')->getClientOriginalName();
            $original_filename_arr = explode('.', $original_filename);
            $file_ext = end($original_filename_arr);
            $uuid = Str::uuid()->toString();
            $destination_path = './upload/user/' . $uuid . '/';
            $image = $user->id . time() . '_avatar.' . $file_ext;

            if ($request->file('image')->move($destination_path, $image)) {
                $avatar_url = 'upload/user/' . $uuid . '/' . $image;
                $userResponse->image = env('APP_URL', '') . '/' . $avatar_url;
                $oldavatar = $user->avatar;
                $user->avatar = $avatar_url;
                $user->save();
                $oldavatar = $user->avatar;
                // Storage::delete(public_path($oldavatar));
                return $this->responseRequestSuccess($userResponse);
            } else {
                return $this->responseRequestError('Cannot upload file');
            }
        } else {
            return $this->responseRequestError('File not found');
        }
    }

    protected function responseRequestSuccess($ret)
    {
        return response()->json(['status' => 'success', 'data' => $ret], 200)
            ->header('Access-Control-Allow-Origin', '*')
            ->header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    }

    protected function responseRequestError($message = 'Bad request', $statusCode = 200)
    {
        return response()->json(['status' => 'error', 'error' => $message], $statusCode)
            ->header('Access-Control-Allow-Origin', '*')
            ->header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    }
    public function uploadAvatar(Request $request)
    {
        $this->validate($request, [
            'image' => 'required',
        ]);
        $res = [
            'success' => false,
            'message' => '',
        ];
        $base64String = $request->input('image');
        $user = Auth::user();
        $folderName = '/uploads/avatar/' . $user->id . '/';
        $uuid = Str::uuid()->toString();
        $oldavatar = $user->avatar;
        $fileName = $this->saveImgBase64($base64String, $folderName, $uuid);
        $user->avatar = $fileName;
        if ($user->save()) {

            try {
                $this->removeImage($oldavatar, $folderName);
            } catch (\Exception $e) {

            }
            $res = [
                'success' => true,
                'message' => 'Successfully updated',
                'image' => $user->avatarUrl,
            ];
        }

        return response()->json($res);
    }
    protected function removeImage($fileName, $folderName)
    {
        return unlink(public_path() . $folderName . $fileName);
    }
    protected function saveImgBase64($param, $folderName, $uuid)
    {
        list($extension, $content) = explode(';', $param);
        $tmpExtension = explode('/', $extension);
        preg_match('/.([0-9]+) /', microtime(), $m);
        $fileName = sprintf('img%s_%s_%s.%s', date('YmdHis'), $uuid, $m[1], $tmpExtension[1]);
        $content = explode(',', $content)[1];
        $file = base64_decode($content);
        $destinationPath = public_path($folderName);
        if (!File::isDirectory($destinationPath)) {
            mkdir($destinationPath, 0755, true);
        }
        $success = file_put_contents(public_path() . $folderName . $fileName, $file);
        return $fileName;
    }
    public function removeUserWithToken(Request $request)
    {
        $this->validate($request, [
            'code' => 'required',
        ]);

        $token = Token::where('code', $request->input('code'))->first();
        $user = Auth::user();
        $userId = $request->input('userId');
        if (!$token || !$token->isValid() || $user->id != $token->member_id) {
            return response()->json(['message' => 'Invalid token'], HttpStatusCodes::CLIENT_ERROR_BAD_REQUEST);
        }
        try {
            Log::info('===========userId========');
            Log::info($userId);
            Log::info('===========!userId========');
            if ($userId != null) {
                $user = User::findOrFail($userId);
            } else {
                $user = User::findOrFail($user->id);
            }
            $accountmember = AccountMember::where('member_id', $user->account_id)->first();
            $accountmember->delete();
            $account = Account::where('id', $user->account_id)->first();
            $account->delete();
            $user->delete();
            $token->used = true;
            $token->save();
            //For test
            return response()->json(['message' => "Successfully deleted"], 200);
            //For real
            // return $this->removeUser($user->id);

        } catch (\Exception $e) {
            Log::info('===========errorsremoveUser========');
            Log::info($e);
            Log::info('===========!errorsremoveUser========');
            return response()->json(['message' => 'user not found!'], HttpStatusCodes::CLIENT_ERROR_BAD_REQUEST);
        }
    }
    public function removeUser($id)
    {
        $current_user = Auth::user();
        if ($current_user->role < 1) {
            return response()->json(['message' => 'Please login'], 403);
        }
        try {
            //DB::enableQueryLog();
            //company account id
            $accountMember = AccountMember::where('member_id', $current_user->account_id)->where('member_role', 1)->first();
            $account_id = $accountMember != null ? $accountMember->account_id : $current_user->account_id;
            if (strpos($id, '@') !== false) {
                $userBeInvited = User::where("email", $id)->first();
                if ($userBeInvited) {
                    $invitation = Invitation::where('account_id', $account_id)->where('data', $userBeInvited->account_id)->first();
                } else {
                    $invitation = Invitation::where('account_id', $account_id)->where('data', $id)->first();
                }
                if ($invitation) {
                    $invitation->delete();
                }

            } else {
                // user account id
                $user = User::findOrFail($id);
                $account = AccountMember::where('member_id', $user->account_id)->where('account_id', $account_id)->first();
                $account->delete();
            }

            //Log::debug(DB::getQueryLog());
            return response()->json(['message' => "Successfully deleted", 'id' => $id], 200);

        } catch (\Exception $e) {
            Log::info('===========errorsremoveUser========');
            Log::info($e);
            Log::info('===========!errorsremoveUser========');
            return response()->json(['message' => 'user not found!'], 404);
        }
    }

    public function update(Request $request)
    {
        $this->validate($request, [
            'phone_number' => 'numeric|digits_between:1,20',
            'first_name' => 'max:50',
            'organization' => 'max:255',
            'title' => 'max:250',
            'last_name' => 'max:50',
            'street_number' => 'max:250',
            'zipcode' => 'max:250',
            'region' => 'max:250',
        ]);
        try {
            // $user = $request->user();
            $user = Auth::user();
            $user->organization = $request->input('organization');
            $user->zipcode = $request->input('zipcode');
            $user->street_number = $request->input('street_number');
            $user->save();
            return tap($user)->update($request->only('first_name', 'last_name', 'organization', 'title', 'street', 'street_number', 'city', 'country', 'zipcode', 'region', 'phone_number'));

        } catch (\Exception $e) {
            Log::info('===========update========');
            Log::info($e);
            Log::info('===========!update========');
            return response()->json(['message' => 'Cannot update profile!'], 404);
        }
    }

    public function changeGroup(Request $request)
    {
        $user = Auth::user();
        if ($user->role < 1) {
            return response()->json(['message' => 'Please login'], 403);
        }
        $input = $request->all();
        $rules = array(
            'account_id' => 'required|integer',
            'user_id' => 'required|integer',
        );
        $validator = Validator::make($input, $rules);
        if ($validator->fails()) {
            return response()->json(['message' => $validator->errors()->first()], 400);
        } else {
            try {
                $user = User::findOrFail($request->input('user_id'));
                $group = GroupMember::where('account_id', $user->account_id)->first();
                if ($group) {
                    $group->group_id = $request->input('account_id');
                    $group->save();
                } else {
                    $account_member = new GroupMember;
                    $account_member->group_id = $request->input('account_id');
                    $account_member->account_id = $user->account_id;
                    // $account_member->member_role = $user->role;
                    $account_member->save();
                }
                //$user->account_id = $request->input('account_id');
                //$user->save();
                return response()->json(['user' => $user], 200);

            } catch (\Exception $e) {
                Log::info('===========changeGroup========');
                Log::info($e);
                Log::info('===========!changeGroup========');
                return response()->json(['message' => 'user not found!'], 404);
            }
        }
    }
    public function changeUserName(Request $request)
    {
        $input = $request->all();
        $rules = array(
            'user_name' => 'required',
        );
        $validator = Validator::make($input, $rules);
        if ($validator->fails()) {
            return response()->json(['message' => $validator->errors()->first()], 400);
        } else {
            try {
                $user = Auth::user();
                $user->user_name = $request->input('user_name');
                $user->save();
                return response()->json(['user' => $user], 200);

            } catch (\Exception $e) {

                return response()->json(['message' => 'Cannot change your user!'], 404);
            }
        }
    }
    public function changeEmail(Request $request)
    {
        throw new \Exception('Obsolete function: changing email is disable.');
        $input = $request->all();
        $rules = array(
            'email' => 'required',
        );
        $validator = Validator::make($input, $rules);
        if ($validator->fails()) {
            return response()->json(['message' => $validator->errors()->first()], 400);
        } else {
            try {

                $user = Auth::user();
                $user->email = $request->input('email');
                $user->save();
                return response()->json(['user' => $user], 200);

            } catch (\Exception $e) {
                Log::info('===========errorschangeEmail========');
                Log::info($e);
                Log::info('===========!errorschangeEmail========');
                return response()->json(['message' => 'Cannot change your email!'], 404);
            }
        }
    }
    public function changeTwoStepVerification(Request $request)
    {
        $input = $request->all();
        $rules = array(
            'type' => 'required',
        );
        $validator = Validator::make($input, $rules);
        if ($validator->fails()) {
            return response()->json(['message' => $validator->errors()->first()], 400);
        } else {
            try {

                $user = Auth::user();
                $user->two_factor_enabled = $request->input('type');
                $user->save();
                return response()->json(['message' => 'Updated!'], 200);

            } catch (\Exception $e) {

                return response()->json(['message' => 'user not found!'], 404);
            }
        }
    }

    public function changeRole(Request $request)
    {
        $user = Auth::user();
        if ($user->role < 1) {
            return response()->json(['message' => 'Please login'], 403);
        }
        $input = $request->all();
        $rules = array(
            'role_id' => 'required|integer',
            'user_id' => 'required|integer',
        );
        $validator = Validator::make($input, $rules);
        if ($validator->fails()) {
            return response()->json(['message' => $validator->errors()->first()], 400);
        } else {
            try {
                $accountMember = AccountMember::where('member_id', $user->account_id)->where('member_role', 1)->first();
                $userToChange = User::findOrFail($request->input('user_id'));
                // $user->role = $request->input('role_id');
                // $user->save();
                DB::enableQueryLog();
                $account_member = AccountMember::where('member_id', $userToChange->account_id)->where('account_id', $accountMember->account_id)->first();
                Log::debug(DB::getQueryLog());

                if ($account_member) {
                    $account_member->member_role = $request->input('role_id');
                    $account_member->save();
                    return response()->json(['user' => $user], 200);
                } else {
                    return response()->json(['message' => 'User is not belong to this organization'], 400);
                }
            } catch (\Exception $e) {
                Log::info('===========changeRole========');
                Log::info($e);
                Log::info('===========!changeRole========');
                return response()->json(['message' => 'Cannot change role. Please try again!'], 404);
            }
        }
    }

    public function changePassword(Request $request)
    {
        $input = $request->all();
        $userid = Auth::guard('api')->user()->id;
        $status =
        $rules = array(
            'old_password' => 'required',
            'new_password' => 'required|min:6',
            'confirm_password' => 'required|same:new_password',
        );
        $validator = Validator::make($input, $rules);
        if ($validator->fails()) {
            $arr = array("status" => 400, "message" => $validator->errors()->first(), "data" => array());
        } else {
            try {
                if ((Hash::check(request('old_password'), Auth::user()->password)) == false) {
                    $arr = array("status" => 400, "message" => "Check your old password.", "data" => array());
                } else if ((Hash::check(request('new_password'), Auth::user()->password)) == true) {
                    $arr = array("status" => 400, "message" => "Please enter a password which is not similar then current password.", "data" => array());
                } else {
                    User::where('id', $userid)->update(['password' => Hash::make($input['new_password'])]);
                    $arr = array("status" => 200, "message" => "Password updated successfully.", "data" => array());
                }
            } catch (\Exception $ex) {
                if (isset($ex->errorInfo[2])) {
                    $msg = $ex->errorInfo[2];
                } else {
                    $msg = $ex->getMessage();
                }
                $arr = array("status" => 400, "message" => $msg, "data" => array());
            }
        }
        return response()->json($arr, $arr['status']);
    }
}
