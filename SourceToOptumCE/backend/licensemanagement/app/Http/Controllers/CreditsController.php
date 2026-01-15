<?php

namespace App\Http\Controllers;

use App\Models\Account;
use App\Models\AccountCredit;
use App\Models\CreditTransaction;
use App\Models\CreditUsageLog;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;

class CreditsController extends Controller
{
    // Credit packages configuration
    private $packages = [
        'starter' => [
            'name' => 'Starter Pack',
            'credits' => 100,
            'price' => 10.00,
            'currency' => 'USD'
        ],
        'professional' => [
            'name' => 'Professional Pack',
            'credits' => 500,
            'price' => 45.00,
            'currency' => 'USD'
        ],
        'enterprise' => [
            'name' => 'Enterprise Pack',
            'credits' => 1000,
            'price' => 80.00,
            'currency' => 'USD'
        ],
        'ultimate' => [
            'name' => 'Ultimate Pack',
            'credits' => 5000,
            'price' => 350.00,
            'currency' => 'USD'
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

            // If no accountId provided and user is authenticated, use user's account
            if (!$accountId && $user) {
                $accountId = $user->account_id;
            }

            // If still no accountId, return error
            if (!$accountId) {
                return response()->json([
                    'success' => false,
                    'message' => 'Account ID required'
                ], 400);
            }

            // Check if user has access to this account (only if authenticated via JWT)
            if ($user && !$this->userCanAccessAccount($user, $accountId)) {
                return response()->json([
                    'success' => false,
                    'message' => 'Access denied'
                ], 403);
            }

            $credits = AccountCredit::where('account_id', $accountId)->first();

            if (!$credits) {
                // Create initial credit record
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

            // If no accountId provided and user is authenticated, use user's account
            if (!$accountId && $user) {
                $accountId = $user->account_id;
            }

            // If still no accountId, return error
            if (!$accountId) {
                return response()->json([
                    'success' => false,
                    'message' => 'Account ID required'
                ], 400);
            }

            // Check if user has access to this account (only if authenticated via JWT)
            if ($user && !$this->userCanAccessAccount($user, $accountId)) {
                return response()->json([
                    'success' => false,
                    'message' => 'Access denied'
                ], 403);
            }

            $transactions = CreditTransaction::where('account_id', $accountId)
                ->orderBy('created_date', 'desc')
                ->limit(50)
                ->get();

            return response()->json([
                'success' => true,
                'data' => $transactions
            ]);
        } catch (\Exception $e) {
            Log::error('Error fetching transactions: ' . $e->getMessage());
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

            // Create checkout session
            $session = \Stripe\Checkout\Session::create([
                'payment_method_types' => ['card'],
                'line_items' => [[
                    'price_data' => [
                        'currency' => strtolower($package['currency']),
                        'product_data' => [
                            'name' => $package['name'],
                            'description' => $package['credits'] . ' Credits for ' . $account->name,
                        ],
                        'unit_amount' => $package['price'] * 100, // Convert to cents
                    ],
                    'quantity' => 1,
                ]],
                'mode' => 'payment',
                'success_url' => env('APP_URL') . '/#/credits/success?session_id={CHECKOUT_SESSION_ID}',
                'cancel_url' => env('APP_URL') . '/#/credits/cancel',
                'client_reference_id' => $accountId,
                'metadata' => [
                    'account_id' => $accountId,
                    'package' => $packageKey,
                    'credits' => $package['credits'],
                    'user_id' => $user->id
                ]
            ]);

            // Create pending transaction
            $transaction = CreditTransaction::create([
                'account_id' => $accountId,
                'package_name' => $package['name'],
                'credits' => $package['credits'],
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
                    $transaction->completed_date = now();
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
                'completed_date' => now(),
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
}
