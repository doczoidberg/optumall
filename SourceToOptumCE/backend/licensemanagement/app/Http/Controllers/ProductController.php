<?php

namespace App\Http\Controllers;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use  App\Models\License;
use  App\Models\Product;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
class ProductController extends Controller
{
    public function __construct()
    {
        // $this->middleware('auth');
    }
    /**
     * Create a new controller instance.
     *
     * @return void
     */
    public function index()
    {
        $accounts = Product::all();
        return response()->json($accounts);
    }


}