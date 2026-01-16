<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Models\Account;
use App\Models\AccountMember;
use App\Services\FirebaseService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class FirebaseController extends Controller
{
    protected $firebaseService;

    public function __construct()
    {
        $this->firebaseService = new FirebaseService();
    }

    /**
     * Sync a single user to Firebase
     *
     * POST /api/firebase/users/{id}
     *
     * @param int $id
     * @return \Illuminate\Http\JsonResponse
     */
    public function syncUser($id)
    {
        try {
            $user = User::with(['account'])->find($id);

            if (!$user) {
                return response()->json([
                    'success' => false,
                    'message' => 'User not found'
                ], 404);
            }

            $userData = FirebaseService::formatUserForFirebase($user);
            $result = $this->firebaseService->postUser($userData);

            if ($result['success']) {
                return response()->json([
                    'success' => true,
                    'message' => 'User synced to Firebase successfully',
                    'data' => [
                        'user_id' => $user->id,
                        'firebase_response' => $result['data']
                    ]
                ]);
            }

            return response()->json([
                'success' => false,
                'message' => 'Failed to sync user to Firebase',
                'error' => $result['error'] ?? 'Unknown error'
            ], $result['status_code'] ?? 500);

        } catch (\Exception $e) {
            Log::error('Sync user to Firebase error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Error syncing user to Firebase',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Sync multiple users to Firebase (batch)
     *
     * POST /api/firebase/users/batch
     * Body: { "user_ids": [1, 2, 3] }
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function syncUsersBatch(Request $request)
    {
        try {
            $userIds = $request->input('user_ids', []);

            if (empty($userIds)) {
                return response()->json([
                    'success' => false,
                    'message' => 'No user IDs provided'
                ], 400);
            }

            $users = User::with(['account'])->whereIn('id', $userIds)->get();

            if ($users->isEmpty()) {
                return response()->json([
                    'success' => false,
                    'message' => 'No users found with provided IDs'
                ], 404);
            }

            $usersData = $users->map(function ($user) {
                return FirebaseService::formatUserForFirebase($user);
            })->toArray();

            $result = $this->firebaseService->postUsers($usersData);

            if ($result['success']) {
                return response()->json([
                    'success' => true,
                    'message' => 'Users synced to Firebase successfully',
                    'data' => [
                        'synced_count' => count($usersData),
                        'user_ids' => $users->pluck('id'),
                        'firebase_response' => $result['data']
                    ]
                ]);
            }

            return response()->json([
                'success' => false,
                'message' => 'Failed to sync users to Firebase',
                'error' => $result['error'] ?? 'Unknown error'
            ], $result['status_code'] ?? 500);

        } catch (\Exception $e) {
            Log::error('Sync users batch to Firebase error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Error syncing users to Firebase',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Sync all users to Firebase (full sync)
     *
     * POST /api/firebase/users/full-sync
     * Query params: ?limit=100&offset=0 for pagination
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function fullSync(Request $request)
    {
        try {
            $limit = $request->input('limit', 1000);
            $offset = $request->input('offset', 0);

            $query = User::with(['account']);
            $totalCount = $query->count();

            $users = $query->skip($offset)->take($limit)->get();

            if ($users->isEmpty()) {
                return response()->json([
                    'success' => true,
                    'message' => 'No users to sync',
                    'data' => [
                        'synced_count' => 0,
                        'total_users' => $totalCount
                    ]
                ]);
            }

            $usersData = $users->map(function ($user) {
                return FirebaseService::formatUserForFirebase($user);
            })->toArray();

            $result = $this->firebaseService->fullSync($usersData);

            if ($result['success']) {
                return response()->json([
                    'success' => true,
                    'message' => 'Full sync to Firebase completed',
                    'data' => [
                        'synced_count' => count($usersData),
                        'total_users' => $totalCount,
                        'offset' => $offset,
                        'limit' => $limit,
                        'has_more' => ($offset + $limit) < $totalCount,
                        'firebase_response' => $result['data']
                    ]
                ]);
            }

            return response()->json([
                'success' => false,
                'message' => 'Failed to perform full sync to Firebase',
                'error' => $result['error'] ?? 'Unknown error'
            ], $result['status_code'] ?? 500);

        } catch (\Exception $e) {
            Log::error('Full sync to Firebase error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Error performing full sync to Firebase',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Sync users by account/organization to Firebase
     *
     * POST /api/firebase/users/by-account/{accountId}
     *
     * @param int $accountId
     * @return \Illuminate\Http\JsonResponse
     */
    public function syncByAccount($accountId)
    {
        try {
            $account = Account::find($accountId);

            if (!$account) {
                return response()->json([
                    'success' => false,
                    'message' => 'Account not found'
                ], 404);
            }

            // Get all users belonging to this account
            $memberIds = AccountMember::where('account_id', $accountId)
                ->pluck('member_id');

            $users = User::with(['account'])
                ->whereIn('account_id', $memberIds)
                ->get();

            if ($users->isEmpty()) {
                return response()->json([
                    'success' => true,
                    'message' => 'No users found for this account',
                    'data' => [
                        'account_id' => $accountId,
                        'synced_count' => 0
                    ]
                ]);
            }

            $usersData = $users->map(function ($user) {
                return FirebaseService::formatUserForFirebase($user);
            })->toArray();

            $result = $this->firebaseService->postUsers($usersData);

            if ($result['success']) {
                return response()->json([
                    'success' => true,
                    'message' => 'Account users synced to Firebase successfully',
                    'data' => [
                        'account_id' => $accountId,
                        'account_name' => $account->name,
                        'synced_count' => count($usersData),
                        'user_ids' => $users->pluck('id'),
                        'firebase_response' => $result['data']
                    ]
                ]);
            }

            return response()->json([
                'success' => false,
                'message' => 'Failed to sync account users to Firebase',
                'error' => $result['error'] ?? 'Unknown error'
            ], $result['status_code'] ?? 500);

        } catch (\Exception $e) {
            Log::error('Sync account users to Firebase error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Error syncing account users to Firebase',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Delete a user from Firebase
     *
     * DELETE /api/firebase/users/{id}
     *
     * @param int $id
     * @return \Illuminate\Http\JsonResponse
     */
    public function deleteUser($id)
    {
        try {
            $result = $this->firebaseService->deleteUser($id);

            if ($result['success']) {
                return response()->json([
                    'success' => true,
                    'message' => 'User deleted from Firebase successfully',
                    'data' => [
                        'user_id' => $id,
                        'firebase_response' => $result['data']
                    ]
                ]);
            }

            return response()->json([
                'success' => false,
                'message' => 'Failed to delete user from Firebase',
                'error' => $result['error'] ?? 'Unknown error'
            ], $result['status_code'] ?? 500);

        } catch (\Exception $e) {
            Log::error('Delete user from Firebase error: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Error deleting user from Firebase',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Check Firebase connection health
     *
     * GET /api/firebase/health
     *
     * @return \Illuminate\Http\JsonResponse
     */
    public function healthCheck()
    {
        try {
            $result = $this->firebaseService->healthCheck();

            return response()->json([
                'success' => $result['success'],
                'message' => $result['success'] ? 'Firebase connection is healthy' : 'Firebase connection failed',
                'data' => [
                    'firebase_url' => env('FIREBASE_FUNCTIONS_URL'),
                    'status_code' => $result['status_code'],
                    'response' => $result['data'] ?? null,
                    'error' => $result['error'] ?? null
                ]
            ], $result['success'] ? 200 : 503);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error checking Firebase health',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get sync status/statistics
     *
     * GET /api/firebase/status
     *
     * @return \Illuminate\Http\JsonResponse
     */
    public function status()
    {
        try {
            $totalUsers = User::count();
            $totalAccounts = Account::count();
            $verifiedUsers = User::where('email_validated', 1)->count();

            return response()->json([
                'success' => true,
                'data' => [
                    'total_users' => $totalUsers,
                    'total_accounts' => $totalAccounts,
                    'verified_users' => $verifiedUsers,
                    'firebase_url' => env('FIREBASE_FUNCTIONS_URL'),
                    'api_configured' => !empty(env('FIREBASE_API_KEY')),
                ]
            ]);

        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error getting status',
                'error' => $e->getMessage()
            ], 500);
        }
    }
}
