<?php

namespace App\Http\Controllers;

use App\Models\Account;
use App\Models\AccountCredit;
use App\Models\CreditTransaction;
use App\Models\CreditUsageLog;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;

class CreditsController extends Controller
{
    // Optum Tokens packages configuration
    private $packages = [
        'basic' => [
            'id' => 'basic',
            'name' => 'Token Package S',
            'tokens' => 500,
            'price' => 100.00,
            'currency' => 'EUR',
            'description' => '500 tokens for running Optum AI workloads'
        ],
        'standard' => [
            'id' => 'standard',
            'name' => 'Token Package M',
            'tokens' => 3000,
            'price' => 500.00,
            'currency' => 'EUR',
            'description' => '3000 tokens for running Optum AI workloads'
        ],
        'premium' => [
            'id' => 'premium',
            'name' => 'Token Package XL',
            'tokens' => 20000,
            'price' => 2500.00,
            'currency' => 'EUR',
            'description' => '20000 tokens for running Optum AI workloads'
        ]
    ];

    public function __construct()
    {
        // Don't apply auth middleware - it's handled by routes
        // OptumAdmin routes use 'apikey' middleware
        // License management routes use 'auth' middleware
    }

    /**
     * Get available credit packages
     */
    public function getPackages()
    {
        return response()->json([
            'success' => true,
            'data' => $this->packages
        ]);
    }

    /**
     * Get credit balance for an account
     */
    public function getBalance(Request $request, $accountId = null)
    {
        try {
            // Handle both API key (OptumAdmin) and JWT auth (License Management)
            $user = Auth::user();

            Log::info('getBalance - User:', ['user' => $user ? $user->toArray() : null]);

            // If no accountId provided and user is authenticated, use user's account
            if (!$accountId && $user) {
                $accountId = $user->account_id;
                Log::info('getBalance - Using user account_id:', ['accountId' => $accountId]);
            }

            // If still no accountId, return error
            if (!$accountId) {
                Log::warning('getBalance - No account ID available');
                return response()->json([
                    'success' => false,
                    'message' => 'Account ID required',
                    'debug' => [
                        'user_exists' => $user ? true : false,
                        'user_account_id' => $user ? $user->account_id : null
                    ]
                ], 400);
            }

            // Check if user has access to this account (only if authenticated via JWT)
            if ($user && !$this->userCanAccessAccount($user, $accountId)) {
                Log::warning('getBalance - Access denied', ['userId' => $user->id, 'accountId' => $accountId]);
                return response()->json([
                    'success' => false,
                    'message' => 'Access denied'
                ], 403);
            }

            $credits = AccountCredit::where('account_id', $accountId)->first();

            if (!$credits) {
                // Create initial credit record
                Log::info('getBalance - Creating initial credit record for account:', ['accountId' => $accountId]);
                $credits = AccountCredit::create([
                    'account_id' => $accountId,
                    'credits' => 0,
                    'credits_used' => 0
                ]);
            }

            return response()->json([
                'success' => true,
                'data' => [
                    'account_id' => $accountId,
                    'credits' => $credits->credits,
                    'credits_used' => $credits->credits_used,
                    'available_credits' => $credits->getAvailableCreditsAttribute(),
                    'last_purchase_date' => $credits->last_purchase_date
                ]
            ]);
        } catch (\Exception $e) {
            Log::error('Error fetching credits: ' . $e->getMessage());
            Log::error('Stack trace: ' . $e->getTraceAsString());
            return response()->json([
                'success' => false,
                'message' => 'Error fetching credit balance',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get transaction history
     */
    public function getTransactions(Request $request, $accountId = null)
    {
        try {
            // Handle both API key (OptumAdmin) and JWT auth (License Management)
            $user = Auth::user();

            Log::info('getTransactions - User:', ['user' => $user]);
            Log::info('getTransactions - AccountId param:', ['accountId' => $accountId]);

            // If no accountId provided and user is authenticated, use user's account
            if (!$accountId && $user) {
                $accountId = $user->account_id;
                Log::info('getTransactions - Using user account_id:', ['accountId' => $accountId]);
            }

            // If still no accountId, return error
            if (!$accountId) {
                Log::warning('getTransactions - No account ID available');
                return response()->json([
                    'success' => false,
                    'message' => 'Account ID required',
                    'debug' => [
                        'user_exists' => $user ? true : false,
                        'user_account_id' => $user ? $user->account_id : null
                    ]
                ], 400);
            }

            // Check if user has access to this account (only if authenticated via JWT)
            if ($user && !$this->userCanAccessAccount($user, $accountId)) {
                Log::warning('getTransactions - Access denied', ['userId' => $user->id, 'accountId' => $accountId]);
                return response()->json([
                    'success' => false,
                    'message' => 'Access denied'
                ], 403);
            }

            // Pagination parameters
            $limit = $request->input('limit', 50);
            $get_all = $request->input('get_all', false);

            $query = CreditTransaction::where('account_id', $accountId)
                ->orderBy('created_date', 'desc');

            if ($get_all === true || $get_all === 'true' || $get_all === '1') {
                $transactions = $query->get();
            } else {
                $transactions = $query->limit($limit)->get();
            }

            Log::info('getTransactions - Found transactions:', ['count' => $transactions->count()]);

            return response()->json([
                'success' => true,
                'data' => $transactions,
                'total' => $transactions->count()
            ]);
        } catch (\Exception $e) {
            Log::error('Error fetching transactions: ' . $e->getMessage());
            Log::error('Stack trace: ' . $e->getTraceAsString());
            return response()->json([
                'success' => false,
                'message' => 'Error fetching transactions',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Create Stripe checkout session
     */
    public function createCheckoutSession(Request $request)
    {
        $this->validate($request, [
            'package' => 'required|string',
            'account_id' => 'required|numeric'
        ]);

        try {
            $user = Auth::user();
            $accountId = $request->input('account_id');
            $packageKey = $request->input('package');

            // Check if user has access
            if (!$this->userCanAccessAccount($user, $accountId)) {
                return response()->json([
                    'success' => false,
                    'message' => 'Access denied'
                ], 403);
            }

            // Validate package
            if (!isset($this->packages[$packageKey])) {
                return response()->json([
                    'success' => false,
                    'message' => 'Invalid package'
                ], 400);
            }

            $package = $this->packages[$packageKey];
            $account = Account::find($accountId);

            // Set Stripe API key
            \Stripe\Stripe::setApiKey(env('STRIPE_SECRET_KEY'));

            // Determine success/cancel URLs based on user role
            $isAdmin = $user->role >= 1;
            $baseUrl = env('APP_URL');
            $successUrl = $isAdmin
                ? $baseUrl . '/#/admin/tokens/success?session_id={CHECKOUT_SESSION_ID}'
                : $baseUrl . '/#/tokens/success?session_id={CHECKOUT_SESSION_ID}';
            $cancelUrl = $isAdmin
                ? $baseUrl . '/#/admin/tokens'
                : $baseUrl . '/#/tokens';

            // Create checkout session
            $session = \Stripe\Checkout\Session::create([
                'payment_method_types' => ['card'],
                'line_items' => [[
                    'price_data' => [
                        'currency' => strtolower($package['currency']),
                        'product_data' => [
                            'name' => $package['name'],
                            'description' => $package['description'],
                        ],
                        'unit_amount' => $package['price'] * 100, // Convert to cents
                    ],
                    'quantity' => 1,
                ]],
                'mode' => 'payment',
                'success_url' => $successUrl,
                'cancel_url' => $cancelUrl,
                'client_reference_id' => $accountId,
                'metadata' => [
                    'account_id' => $accountId,
                    'package' => $packageKey,
                    'tokens' => $package['tokens'],
                    'user_id' => $user->id
                ]
            ]);

            // Create pending transaction
            $transaction = CreditTransaction::create([
                'account_id' => $accountId,
                'package_name' => $package['name'],
                'credits' => $package['tokens'],
                'amount' => $package['price'],
                'currency' => $package['currency'],
                'status' => 'pending',
                'stripe_session_id' => $session->id,
                'metadata' => json_encode([
                    'package_key' => $packageKey,
                    'user_id' => $user->id
                ])
            ]);

            return response()->json([
                'success' => true,
                'data' => [
                    'session_id' => $session->id,
                    'url' => $session->url,
                    'transaction_id' => $transaction->id
                ]
            ]);

        } catch (\Exception $e) {
            Log::error('Error creating checkout session: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Error creating checkout session',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Stripe webhook handler
     */
    public function stripeWebhook(Request $request)
    {
        $payload = $request->getContent();
        $sigHeader = $request->header('Stripe-Signature');
        $webhookSecret = env('STRIPE_WEBHOOK_SECRET');

        try {
            \Stripe\Stripe::setApiKey(env('STRIPE_SECRET_KEY'));

            $event = \Stripe\Webhook::constructEvent(
                $payload,
                $sigHeader,
                $webhookSecret
            );

            Log::info('Stripe webhook received: ' . $event->type);

            // Handle the event
            if ($event->type === 'checkout.session.completed') {
                $session = $event->data->object;

                // Find the transaction
                $transaction = CreditTransaction::where('stripe_session_id', $session->id)->first();

                if ($transaction) {
                    // Update transaction status
                    $transaction->status = 'completed';
                    $transaction->stripe_payment_intent = $session->payment_intent;
                    $transaction->completed_date = Carbon::now();
                    $transaction->save();

                    // Add credits to account
                    $credits = AccountCredit::firstOrCreate(
                        ['account_id' => $transaction->account_id],
                        ['credits' => 0, 'credits_used' => 0]
                    );

                    $credits->addCredits($transaction->credits);

                    Log::info('Credits added successfully: ' . $transaction->credits . ' credits to account ' . $transaction->account_id);
                }
            }

            return response()->json(['status' => 'success']);

        } catch (\Exception $e) {
            Log::error('Webhook error: ' . $e->getMessage());
            return response()->json(['error' => $e->getMessage()], 400);
        }
    }

    /**
     * Check if user can access account
     */
    private function userCanAccessAccount($user, $accountId)
    {
        // User can access their own account
        if ($user->account_id == $accountId) {
            return true;
        }

        // Check if user is admin of the organization
        $membership = \App\Models\AccountMember::where('member_id', $user->account_id)
            ->where('account_id', $accountId)
            ->where('member_role', 1) // Admin
            ->first();

        return $membership !== null;
    }

    /**
     * Manually add credits (admin only)
     */
    public function addCreditsManual(Request $request)
    {
        $user = Auth::user();

        if ($user->role < 2) { // Only superadmin
            return response()->json([
                'success' => false,
                'message' => 'Access denied'
            ], 403);
        }

        $this->validate($request, [
            'account_id' => 'required|numeric',
            'credits' => 'required|numeric|min:0',
            'reason' => 'required|string'
        ]);

        try {
            $accountId = $request->input('account_id');
            $creditsToAdd = $request->input('credits');
            $reason = $request->input('reason');

            $credits = AccountCredit::firstOrCreate(
                ['account_id' => $accountId],
                ['credits' => 0, 'credits_used' => 0]
            );

            $credits->addCredits($creditsToAdd);

            // Log the manual addition
            CreditTransaction::create([
                'account_id' => $accountId,
                'package_name' => 'Manual Addition',
                'credits' => $creditsToAdd,
                'amount' => 0,
                'currency' => 'USD',
                'status' => 'completed',
                'completed_date' => Carbon::now(),
                'metadata' => json_encode([
                    'reason' => $reason,
                    'admin_user_id' => $user->id,
                    'admin_email' => $user->email
                ])
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Credits added successfully',
                'data' => [
                    'credits' => $credits->credits,
                    'available_credits' => $credits->getAvailableCreditsAttribute()
                ]
            ]);

        } catch (\Exception $e) {
            Log::error('Error adding credits manually: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Error adding credits',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get all transactions across all accounts (superadmin only)
     */
    public function getAllTransactions(Request $request)
    {
        try {
            $user = Auth::user();

            // Only superadmin can view all transactions
            if ($user->role < 2) {
                Log::warning('getAllTransactions - Access denied', ['userId' => $user->id, 'role' => $user->role]);
                return response()->json([
                    'success' => false,
                    'message' => 'Access denied. SuperAdmin access required.'
                ], 403);
            }

            // Optional filters
            $limit = $request->input('limit', 100);
            $status = $request->input('status'); // Filter by status (completed, pending, failed)
            $accountId = $request->input('account_id'); // Filter by specific account

            $query = CreditTransaction::with('account');

            if ($status) {
                $query->where('status', $status);
            }

            if ($accountId) {
                $query->where('account_id', $accountId);
            }

            $transactions = $query->orderBy('created_date', 'desc')
                ->limit($limit)
                ->get();

            // Add account name to each transaction
            $transactionsWithAccount = $transactions->map(function ($transaction) {
                return [
                    'id' => $transaction->id,
                    'account_id' => $transaction->account_id,
                    'account_name' => $transaction->account ? $transaction->account->name : 'N/A',
                    'package_name' => $transaction->package_name,
                    'credits' => $transaction->credits,
                    'amount' => $transaction->amount,
                    'currency' => $transaction->currency,
                    'status' => $transaction->status,
                    'stripe_session_id' => $transaction->stripe_session_id,
                    'stripe_payment_intent' => $transaction->stripe_payment_intent,
                    'metadata' => $transaction->metadata,
                    'created_date' => $transaction->created_date,
                    'completed_date' => $transaction->completed_date
                ];
            });

            Log::info('getAllTransactions - Returned transactions:', ['count' => $transactions->count()]);

            return response()->json([
                'success' => true,
                'data' => $transactionsWithAccount
            ]);

        } catch (\Exception $e) {
            Log::error('Error fetching all transactions: ' . $e->getMessage());
            Log::error('Stack trace: ' . $e->getTraceAsString());
            return response()->json([
                'success' => false,
                'message' => 'Error fetching transactions',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get pricing configuration for custom token purchases
     */
    public function getPricing()
    {
        return response()->json([
            'success' => true,
            'data' => [
                'price_per_token' => 0.20,
                'currency' => 'EUR',
                'min_tokens' => 100,
                'max_tokens' => 100000
            ]
        ]);
    }

    /**
     * Create Stripe checkout session for custom token amount
     */
    public function createCustomCheckoutSession(Request $request)
    {
        $this->validate($request, [
            'tokens' => 'required|numeric|min:100|max:100000',
            'account_id' => 'required|numeric'
        ]);

        try {
            $user = Auth::user();
            $accountId = $request->input('account_id');
            $tokens = $request->input('tokens');
            $pricePerToken = 0.20; // EUR per token
            $totalPrice = $tokens * $pricePerToken;

            // Check if user has access
            if (!$this->userCanAccessAccount($user, $accountId)) {
                return response()->json([
                    'success' => false,
                    'message' => 'Access denied'
                ], 403);
            }

            // Set Stripe API key
            \Stripe\Stripe::setApiKey(env('STRIPE_SECRET_KEY'));

            // Determine success/cancel URLs based on user role
            $isAdmin = $user->role >= 1;
            $baseUrl = env('APP_URL');
            $successUrl = $isAdmin
                ? $baseUrl . '/#/admin/tokens/success?session_id={CHECKOUT_SESSION_ID}'
                : $baseUrl . '/#/tokens/success?session_id={CHECKOUT_SESSION_ID}';
            $cancelUrl = $isAdmin
                ? $baseUrl . '/#/admin/tokens'
                : $baseUrl . '/#/tokens';

            // Create checkout session
            $session = \Stripe\Checkout\Session::create([
                'payment_method_types' => ['card'],
                'line_items' => [[
                    'price_data' => [
                        'currency' => 'eur',
                        'product_data' => [
                            'name' => 'Optum Tokens',
                            'description' => number_format($tokens) . ' tokens at €' . $pricePerToken . ' per token',
                        ],
                        'unit_amount' => round($totalPrice * 100), // Convert to cents
                    ],
                    'quantity' => 1,
                ]],
                'mode' => 'payment',
                'success_url' => $successUrl,
                'cancel_url' => $cancelUrl,
                'client_reference_id' => $accountId,
                'metadata' => [
                    'account_id' => $accountId,
                    'tokens' => $tokens,
                    'price_per_token' => $pricePerToken,
                    'user_id' => $user->id,
                    'custom_purchase' => 'true'
                ]
            ]);

            // Create pending transaction
            $transaction = CreditTransaction::create([
                'account_id' => $accountId,
                'package_name' => 'Custom Purchase',
                'credits' => $tokens,
                'amount' => $totalPrice,
                'currency' => 'EUR',
                'status' => 'pending',
                'stripe_session_id' => $session->id,
                'metadata' => json_encode([
                    'custom_purchase' => true,
                    'tokens' => $tokens,
                    'price_per_token' => $pricePerToken,
                    'user_id' => $user->id
                ])
            ]);

            return response()->json([
                'success' => true,
                'data' => [
                    'session_id' => $session->id,
                    'url' => $session->url,
                    'transaction_id' => $transaction->id,
                    'tokens' => $tokens,
                    'total_price' => $totalPrice
                ]
            ]);

        } catch (\Exception $e) {
            Log::error('Error creating custom checkout session: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Error creating checkout session',
                'error' => $e->getMessage()
            ], 500);
        }
    }
}
