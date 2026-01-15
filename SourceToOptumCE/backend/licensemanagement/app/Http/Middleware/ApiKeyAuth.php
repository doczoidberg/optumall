<?php

namespace App\Http\Middleware;

use Closure;

class ApiKeyAuth
{
    /**
     * Handle an incoming request for API key authentication.
     * Used for server-to-server communication from optumadmin.
     *
     * @param  \Illuminate\Http\Request  $request
     * @param  \Closure  $next
     * @return mixed
     */
    public function handle($request, Closure $next)
    {
        $apiKey = $request->header('X-Api-Key');
        $expectedApiKey = env('OPTUMADMIN_API_KEY', 'your-secret-api-key-here');

        if (!$apiKey || $apiKey !== $expectedApiKey) {
            return response()->json([
                'error' => 'Unauthorized',
                'message' => 'Invalid or missing API key'
            ], 401);
        }

        return $next($request);
    }
}
