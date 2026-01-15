<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use  App\Models\User;
use  App\Models\Notification;

use Log;
use Illuminate\Support\Facades\Auth;
use App\Helpers\MailHelper;
use App\Mail\RegisterConfirmation;
use App\Helpers\HttpStatusCodes;
use App\Helpers\ResponseHelper;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
class NotificationController extends Controller
{
    /**
     * Create a new controller instance.
     *
     * @return void
     */
    public function __construct()
    {
        $this->middleware('auth');
    }


     /**
     * Get a JWT via given credentials.
     *
     * @param  Request  $request
     * @return Response
     */
    public function index()
    {
        $current_user = Auth::user();
        $accounts = Notification::where('member_id',$current_user->id)->get();
        return response()->json($accounts);
    }

}