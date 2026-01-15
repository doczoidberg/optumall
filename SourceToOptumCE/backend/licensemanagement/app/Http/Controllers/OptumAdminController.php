<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Models\Account;
use App\Models\AccountMember;
use App\Models\AccountGroup;
use App\Models\GroupMember;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class OptumAdminController extends Controller
{
    /**
     * Get all accounts with their members
     *
     * @return \Illuminate\Http\JsonResponse
     */
    public function getAllAccounts()
    {
        try {
            $accounts = Account::with(['members'])->get();

            $result = $accounts->map(function ($account) {
                // Count members properly
                $memberCount = AccountMember::where('account_id', $account->id)->count();

                return [
                    'id' => $account->id,
                    'name' => $account->name,
                    'domain' => $account->domain,
                    'type' => $account->type,
                    'type_name' => $this->getAccountTypeName($account->type),
                    'created_date' => $account->created_date,
                    'total_members' => $memberCount,
                    'members' => $account->members->map(function ($member) {
                        return [
                            'id' => $member->id,
                            'member_id' => $member->member_id,
                            'role' => $member->member_role,
                            'role_name' => $member->member_role == 1 ? 'Admin' : 'Member',
                        ];
                    })
                ];
            });

            return response()->json([
                'success' => true,
                'data' => $result
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error fetching accounts',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get single account with detailed information
     *
     * @param int $id
     * @return \Illuminate\Http\JsonResponse
     */
    public function getAccount($id)
    {
        try {
            $account = Account::with(['members'])->find($id);

            if (!$account) {
                return response()->json([
                    'success' => false,
                    'message' => 'Account not found'
                ], 404);
            }

            // Get all users (identities) for this account
            // member_id in account_member refers to the user's account_id, not user.id
            $users = User::whereIn('account_id', function ($query) use ($id) {
                $query->select('member_id')
                    ->from('account_member')
                    ->where('account_id', $id);
            })->get();

            // Get groups for this account
            $groups = AccountGroup::where('account_id', $id)
                ->with(['members'])
                ->get();

            return response()->json([
                'success' => true,
                'data' => [
                    'id' => $account->id,
                    'name' => $account->name,
                    'domain' => $account->domain,
                    'type' => $account->type,
                    'type_name' => $this->getAccountTypeName($account->type),
                    'created_date' => $account->created_date,
                    'users' => $users->map(function ($user) use ($id) {
                        $membership = AccountMember::where('account_id', $id)
                            ->where('member_id', $user->account_id)
                            ->first();

                        return [
                            'id' => $user->id,
                            'account_id' => $user->account_id,
                            'email' => $user->email,
                            'user_name' => $user->user_name,
                            'first_name' => $user->first_name,
                            'last_name' => $user->last_name,
                            'name' => $user->first_name . ' ' . $user->last_name,
                            'role' => $user->role,
                            'global_role_name' => $this->getGlobalRoleName($user->role),
                            'organization_role' => $membership ? $membership->member_role : null,
                            'organization_role_name' => $membership ? ($membership->member_role == 1 ? 'Admin' : 'Member') : null,
                            'email_validated' => $user->email_validated,
                            'two_factor_enabled' => $user->two_factor_enabled,
                            'phone_number' => $user->phone_number,
                            'title' => $user->title,
                            'organization_field' => $user->organization,
                            'street' => $user->street,
                            'city' => $user->city,
                            'region' => $user->region,
                            'zipcode' => $user->zipcode,
                            'country' => $user->country,
                            'avatar' => $user->avatarUrl,
                            'created_date' => $user->created_date,
                        ];
                    }),
                    'groups' => $groups->map(function ($group) {
                        return [
                            'id' => $group->id,
                            'name' => $group->name,
                            'description' => $group->description,
                            'created_date' => $group->created_date,
                            'total_members' => $group->totalMember ?? 0,
                        ];
                    })
                ]
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error fetching account',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get all users (identities)
     *
     * @return \Illuminate\Http\JsonResponse
     */
    public function getAllUsers()
    {
        try {
            $users = User::with(['account'])->get();

            $result = $users->map(function ($user) {
                // Get group info manually
                $groupInfo = null;
                if ($user->groupId && $user->groupId > 0) {
                    $group = AccountGroup::find($user->groupId);
                    if ($group) {
                        $groupInfo = [
                            'id' => $group->id,
                            'name' => $group->name,
                        ];
                    }
                }

                return [
                    'id' => $user->id,
                    'account_id' => $user->account_id,
                    'email' => $user->email,
                    'user_name' => $user->user_name,
                    'first_name' => $user->first_name,
                    'last_name' => $user->last_name,
                    'name' => $user->first_name . ' ' . $user->last_name,
                    'role' => $user->role,
                    'role_name' => $this->getGlobalRoleName($user->role),
                    'organization' => $user->account ? [
                        'id' => $user->account->id,
                        'name' => $user->account->name,
                        'domain' => $user->account->domain,
                    ] : null,
                    'group' => $groupInfo,
                    'email_validated' => $user->email_validated,
                    'two_factor_enabled' => $user->two_factor_enabled,
                    'phone_number' => $user->phone_number,
                    'organization_name' => $user->organization,
                    'title' => $user->title,
                    'created_date' => $user->created_date,
                ];
            });

            return response()->json([
                'success' => true,
                'data' => $result
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error fetching users',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get single user by ID
     *
     * @param int $id
     * @return \Illuminate\Http\JsonResponse
     */
    public function getUser($id)
    {
        try {
            $user = User::with(['account', 'group'])->find($id);

            if (!$user) {
                return response()->json([
                    'success' => false,
                    'message' => 'User not found'
                ], 404);
            }

            // Get all organizations this user is a member of
            $organizations = DB::table('account_member')
                ->join('account', 'account_member.account_id', '=', 'account.id')
                ->where('account_member.member_id', $user->account_id)
                ->select('account.*', 'account_member.member_role')
                ->get();

            return response()->json([
                'success' => true,
                'data' => [
                    'id' => $user->id,
                    'account_id' => $user->account_id,
                    'email' => $user->email,
                    'user_name' => $user->user_name,
                    'first_name' => $user->first_name,
                    'last_name' => $user->last_name,
                    'name' => $user->first_name . ' ' . $user->last_name,
                    'role' => $user->role,
                    'role_name' => $this->getGlobalRoleName($user->role),
                    'primary_organization' => $user->account ? [
                        'id' => $user->account->id,
                        'name' => $user->account->name,
                        'domain' => $user->account->domain,
                    ] : null,
                    'organizations' => $organizations->map(function ($org) {
                        return [
                            'id' => $org->id,
                            'name' => $org->name,
                            'domain' => $org->domain,
                            'role' => $org->member_role,
                            'role_name' => $org->member_role == 1 ? 'Admin' : 'Member',
                        ];
                    }),
                    'group' => $user->group ? [
                        'id' => $user->group->id,
                        'name' => $user->group->name,
                    ] : null,
                    'email_validated' => $user->email_validated,
                    'two_factor_enabled' => $user->two_factor_enabled,
                    'phone_number' => $user->phone_number,
                    'street' => $user->street,
                    'city' => $user->city,
                    'region' => $user->region,
                    'zipcode' => $user->zipcode,
                    'country' => $user->country,
                    'organization_field' => $user->organization,
                    'title' => $user->title,
                    'avatar' => $user->avatarUrl,
                    'created_date' => $user->created_date,
                ]
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error fetching user',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get all groups with their members
     *
     * @return \Illuminate\Http\JsonResponse
     */
    public function getAllGroups()
    {
        try {
            $groups = AccountGroup::with(['members', 'account'])->get();

            $result = $groups->map(function ($group) {
                return [
                    'id' => $group->id,
                    'account_id' => $group->account_id,
                    'name' => $group->name,
                    'description' => $group->description,
                    'created_date' => $group->created_date,
                    'organization' => $group->account ? [
                        'id' => $group->account->id,
                        'name' => $group->account->name,
                        'domain' => $group->account->domain,
                    ] : null,
                    'total_members' => $group->totalMember ?? 0,
                ];
            });

            return response()->json([
                'success' => true,
                'data' => $result
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error fetching groups',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get statistics overview
     *
     * @return \Illuminate\Http\JsonResponse
     */
    public function getStats()
    {
        try {
            $totalAccounts = Account::count();
            $totalUsers = User::count();
            $totalGroups = AccountGroup::count();
            $verifiedUsers = User::where('email_validated', 1)->count();
            $twoFactorUsers = User::where('two_factor_enabled', 1)->count();

            // Account types breakdown
            $accountsByType = Account::select('type', DB::raw('count(*) as count'))
                ->groupBy('type')
                ->get()
                ->map(function ($item) {
                    return [
                        'type' => $item->type,
                        'type_name' => $this->getAccountTypeName($item->type),
                        'count' => $item->count
                    ];
                });

            // User roles breakdown
            $usersByRole = User::select('role', DB::raw('count(*) as count'))
                ->groupBy('role')
                ->get()
                ->map(function ($item) {
                    return [
                        'role' => $item->role,
                        'role_name' => $this->getGlobalRoleName($item->role),
                        'count' => $item->count
                    ];
                });

            return response()->json([
                'success' => true,
                'data' => [
                    'total_accounts' => $totalAccounts,
                    'total_users' => $totalUsers,
                    'total_groups' => $totalGroups,
                    'verified_users' => $verifiedUsers,
                    'two_factor_users' => $twoFactorUsers,
                    'accounts_by_type' => $accountsByType,
                    'users_by_role' => $usersByRole,
                ]
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error fetching statistics',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Search users and accounts
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function search(Request $request)
    {
        try {
            $query = $request->input('q', '');

            if (empty($query)) {
                return response()->json([
                    'success' => false,
                    'message' => 'Search query is required'
                ], 400);
            }

            // Search users
            $users = User::where('email', 'like', "%{$query}%")
                ->orWhere('user_name', 'like', "%{$query}%")
                ->orWhere('first_name', 'like', "%{$query}%")
                ->orWhere('last_name', 'like', "%{$query}%")
                ->with(['account'])
                ->limit(20)
                ->get();

            // Search accounts
            $accounts = Account::where('name', 'like', "%{$query}%")
                ->orWhere('domain', 'like', "%{$query}%")
                ->limit(20)
                ->get();

            return response()->json([
                'success' => true,
                'data' => [
                    'users' => $users->map(function ($user) {
                        return [
                            'id' => $user->id,
                            'email' => $user->email,
                            'name' => $user->first_name . ' ' . $user->last_name,
                            'organization' => $user->account ? $user->account->name : null,
                        ];
                    }),
                    'accounts' => $accounts->map(function ($account) {
                        return [
                            'id' => $account->id,
                            'name' => $account->name,
                            'domain' => $account->domain,
                            'type_name' => $this->getAccountTypeName($account->type),
                        ];
                    }),
                ]
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error searching',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Helper: Get account type name
     */
    private function getAccountTypeName($type)
    {
        switch ($type) {
            case 0:
                return 'Individual';
            case 1:
                return 'Organization';
            case 3:
                return 'University';
            default:
                return 'Unknown';
        }
    }

    /**
     * Helper: Get global role name
     */
    private function getGlobalRoleName($role)
    {
        switch ($role) {
            case 0:
                return 'User';
            case 1:
                return 'Admin';
            case 2:
                return 'Superadmin';
            default:
                return 'Unknown';
        }
    }
}
