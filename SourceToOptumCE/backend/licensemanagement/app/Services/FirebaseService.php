<?php

namespace App\Services;

use GuzzleHttp\Client;
use GuzzleHttp\Exception\GuzzleException;
use Illuminate\Support\Facades\Log;

class FirebaseService
{
    protected $client;
    protected $baseUrl;
    protected $apiKey;

    public function __construct()
    {
        $this->baseUrl = env('FIREBASE_FUNCTIONS_URL', 'https://us-central1-optum-80593.cloudfunctions.net');
        $this->apiKey = env('FIREBASE_API_KEY', '');

        $this->client = new Client([
            'base_uri' => $this->baseUrl,
            'timeout' => 30,
            'headers' => [
                'Content-Type' => 'application/json',
                'Accept' => 'application/json',
            ]
        ]);
    }

    /**
     * Post a single user to Firebase
     *
     * @param array $userData
     * @return array
     */
    public function postUser(array $userData)
    {
        return $this->makeRequest('POST', '/syncUser', $userData);
    }

    /**
     * Post multiple users to Firebase in batch
     *
     * @param array $usersData
     * @return array
     */
    public function postUsers(array $usersData)
    {
        return $this->makeRequest('POST', '/syncUsers', ['users' => $usersData]);
    }

    /**
     * Update a user in Firebase
     *
     * @param int $userId
     * @param array $userData
     * @return array
     */
    public function updateUser(int $userId, array $userData)
    {
        return $this->makeRequest('PUT', "/syncUser/{$userId}", $userData);
    }

    /**
     * Delete a user from Firebase
     *
     * @param int $userId
     * @return array
     */
    public function deleteUser(int $userId)
    {
        return $this->makeRequest('DELETE', "/syncUser/{$userId}");
    }

    /**
     * Sync all users to Firebase (full sync)
     *
     * @param array $usersData
     * @return array
     */
    public function fullSync(array $usersData)
    {
        return $this->makeRequest('POST', '/fullSyncUsers', ['users' => $usersData]);
    }

    /**
     * Check Firebase connection health
     *
     * @return array
     */
    public function healthCheck()
    {
        return $this->makeRequest('GET', '/health');
    }

    /**
     * Make HTTP request to Firebase Functions
     *
     * @param string $method
     * @param string $endpoint
     * @param array|null $data
     * @return array
     */
    protected function makeRequest(string $method, string $endpoint, ?array $data = null)
    {
        try {
            $options = [];

            // Add API key to headers
            if ($this->apiKey) {
                $options['headers'] = [
                    'X-Api-Key' => $this->apiKey,
                ];
            }

            // Add body data for POST/PUT requests
            if ($data !== null && in_array($method, ['POST', 'PUT', 'PATCH'])) {
                $options['json'] = $data;
            }

            $response = $this->client->request($method, $endpoint, $options);

            $statusCode = $response->getStatusCode();
            $body = json_decode($response->getBody()->getContents(), true);

            return [
                'success' => $statusCode >= 200 && $statusCode < 300,
                'status_code' => $statusCode,
                'data' => $body,
            ];
        } catch (GuzzleException $e) {
            Log::error('Firebase API Error: ' . $e->getMessage(), [
                'method' => $method,
                'endpoint' => $endpoint,
                'data' => $data,
            ]);

            return [
                'success' => false,
                'status_code' => $e->getCode(),
                'error' => $e->getMessage(),
            ];
        } catch (\Exception $e) {
            Log::error('Firebase Service Error: ' . $e->getMessage(), [
                'method' => $method,
                'endpoint' => $endpoint,
            ]);

            return [
                'success' => false,
                'status_code' => 500,
                'error' => $e->getMessage(),
            ];
        }
    }

    /**
     * Format user data for Firebase
     *
     * @param \App\Models\User $user
     * @return array
     */
    public static function formatUserForFirebase($user)
    {
        return [
            'id' => $user->id,
            'account_id' => $user->account_id,
            'email' => $user->email,
            'user_name' => $user->user_name,
            'first_name' => $user->first_name,
            'last_name' => $user->last_name,
            'name' => $user->first_name . ' ' . $user->last_name,
            'role' => $user->role,
            'role_name' => $user->roleName,
            'organization' => $user->organization,
            'email_validated' => (bool) $user->email_validated,
            'two_factor_enabled' => (bool) $user->two_factor_enabled,
            'phone_number' => $user->phone_number,
            'title' => $user->title,
            'country' => $user->country,
            'city' => $user->city,
            'region' => $user->region,
            'zipcode' => $user->zipcode,
            'street' => $user->street,
            'avatar_url' => $user->avatarUrl,
            'created_date' => $user->created_date,
            'synced_at' => date('Y-m-d\TH:i:s\Z'),
        ];
    }
}
