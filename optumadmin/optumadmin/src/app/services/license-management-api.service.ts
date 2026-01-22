import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { tap, shareReplay } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface Account {
  id: number;
  name: string;
  domain: string;
  type: number;
  type_name: string;
  created_date: string;
  total_members: number;
  credits: number;
  credits_used: number;
  available_credits: number;
  last_purchase_date?: string;
  members?: any[];
  users?: User[];
  groups?: Group[];
}

export interface User {
  id: number;
  account_id: number;
  email: string;
  user_name: string;
  first_name: string;
  last_name: string;
  name: string;
  role: number;
  role_name: string;
  global_role_name?: string;
  organization_role?: number;
  organization_role_name?: string;
  organization?: any;
  organization_field?: string;
  group?: any;
  email_validated: boolean;
  two_factor_enabled: boolean;
  phone_number?: string;
  organization_name?: string;
  title?: string;
  street?: string;
  city?: string;
  region?: string;
  zipcode?: string;
  country?: string;
  avatar?: string;
  created_date: string;
}

export interface Group {
  id: number;
  account_id: number;
  name: string;
  description: string;
  created_date: string;
  organization?: any;
  total_members: number;
}

export interface Stats {
  total_accounts: number;
  total_users: number;
  total_groups: number;
  verified_users: number;
  two_factor_users: number;
  accounts_by_type: any[];
  users_by_role: any[];
}

@Injectable({
  providedIn: 'root'
})
export class LicenseManagementApiService {
  private apiUrl: string;
  private apiKey: string;

  // Cache storage
  private cache = new Map<string, { data: any; timestamp: number }>();
  private cacheDuration = 5 * 60 * 1000; // 5 minutes in milliseconds

  // In-flight requests to prevent duplicate calls
  private inFlightRequests = new Map<string, Observable<any>>();

  constructor(private http: HttpClient) {
    this.apiUrl = environment.licenseManagementApiUrl || 'http://localhost:8000/api/optumadmin';
    this.apiKey = environment.licenseManagementApiKey || 'your-secret-api-key-change-this-in-production';
  }

  /**
   * Get HTTP headers with API key
   */
  private getHeaders(): HttpHeaders {
    return new HttpHeaders({
      'X-Api-Key': this.apiKey,
      'Content-Type': 'application/json'
    });
  }

  /**
   * Check if cached data is still valid
   */
  private isCacheValid(key: string): boolean {
    const cached = this.cache.get(key);
    if (!cached) {
      return false;
    }
    const now = Date.now();
    return (now - cached.timestamp) < this.cacheDuration;
  }

  /**
   * Get data from cache
   */
  private getFromCache<T>(key: string): Observable<T> | null {
    if (this.isCacheValid(key)) {
      const cached = this.cache.get(key);
      if (cached) {
        return of(cached.data);
      }
    }
    return null;
  }

  /**
   * Store data in cache
   */
  private setCache(key: string, data: any): void {
    this.cache.set(key, {
      data: data,
      timestamp: Date.now()
    });
  }

  /**
   * Clear all cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Clear specific cache entry
   */
  clearCacheEntry(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Make a cached HTTP request
   */
  private cachedRequest<T>(key: string, request: Observable<T>): Observable<T> {
    // Check cache first
    const cached = this.getFromCache<T>(key);
    if (cached) {
      return cached;
    }

    // Check if request is already in flight
    if (this.inFlightRequests.has(key)) {
      return this.inFlightRequests.get(key) as Observable<T>;
    }

    // Make new request
    const inFlight = request.pipe(
      tap(data => {
        this.setCache(key, data);
        this.inFlightRequests.delete(key);
      }),
      shareReplay(1)
    );

    this.inFlightRequests.set(key, inFlight);
    return inFlight;
  }

  /**
   * Get all accounts (cached)
   */
  getAllAccounts(): Observable<{ success: boolean; data: Account[] }> {
    const cacheKey = 'accounts_all';
    return this.cachedRequest(
      cacheKey,
      this.http.get<{ success: boolean; data: Account[] }>(
        `${this.apiUrl}/accounts`,
        { headers: this.getHeaders() }
      )
    );
  }

  /**
   * Get single account by ID (cached)
   */
  getAccount(id: number): Observable<{ success: boolean; data: Account }> {
    const cacheKey = `account_${id}`;
    return this.cachedRequest(
      cacheKey,
      this.http.get<{ success: boolean; data: Account }>(
        `${this.apiUrl}/accounts/${id}`,
        { headers: this.getHeaders() }
      )
    );
  }

  /**
   * Get all users (cached)
   */
  getAllUsers(): Observable<{ success: boolean; data: User[] }> {
    const cacheKey = 'users_all';
    return this.cachedRequest(
      cacheKey,
      this.http.get<{ success: boolean; data: User[] }>(
        `${this.apiUrl}/users`,
        { headers: this.getHeaders() }
      )
    );
  }

  /**
   * Get single user by ID (cached)
   */
  getUser(id: number): Observable<{ success: boolean; data: User }> {
    const cacheKey = `user_${id}`;
    return this.cachedRequest(
      cacheKey,
      this.http.get<{ success: boolean; data: User }>(
        `${this.apiUrl}/users/${id}`,
        { headers: this.getHeaders() }
      )
    );
  }

  /**
   * Get all groups (cached)
   */
  getAllGroups(): Observable<{ success: boolean; data: Group[] }> {
    const cacheKey = 'groups_all';
    return this.cachedRequest(
      cacheKey,
      this.http.get<{ success: boolean; data: Group[] }>(
        `${this.apiUrl}/groups`,
        { headers: this.getHeaders() }
      )
    );
  }

  /**
   * Get statistics (cached)
   */
  getStats(): Observable<{ success: boolean; data: Stats }> {
    const cacheKey = 'stats';
    return this.cachedRequest(
      cacheKey,
      this.http.get<{ success: boolean; data: Stats }>(
        `${this.apiUrl}/stats`,
        { headers: this.getHeaders() }
      )
    );
  }

  /**
   * Search users and accounts (not cached - always fresh)
   */
  search(query: string): Observable<{ success: boolean; data: { users: User[]; accounts: Account[] } }> {
    return this.http.get<{ success: boolean; data: { users: User[]; accounts: Account[] } }>(
      `${this.apiUrl}/search?q=${encodeURIComponent(query)}`,
      { headers: this.getHeaders() }
    );
  }
}
