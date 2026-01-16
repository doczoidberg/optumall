import { Injectable, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, tap, map, catchError, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { Account, AccountGroup } from '../models/account.model';
import { User } from '../models/user.model';
import { CreditBalance, CreditTransaction } from '../models/credits.model';
import { ApiResponse, StatsResponse, SearchResult } from '../models/api-response.model';

@Injectable({
  providedIn: 'root'
})
export class AccountsService {
  private apiUrl = `${environment.licenseManagementApiUrl}/api/optumadmin`;

  // Signals for reactive state management
  private accountsSignal = signal<Account[]>([]);
  private loadingSignal = signal<boolean>(false);
  private errorSignal = signal<string | null>(null);

  readonly accounts = this.accountsSignal.asReadonly();
  readonly loading = this.loadingSignal.asReadonly();
  readonly error = this.errorSignal.asReadonly();

  constructor(private http: HttpClient) {}

  /**
   * Get all accounts (replaces Firebase customers collection)
   */
  getAccounts(): Observable<Account[]> {
    this.loadingSignal.set(true);
    this.errorSignal.set(null);

    return this.http.get<ApiResponse<Account[]>>(`${this.apiUrl}/accounts`)
      .pipe(
        map(response => {
          if (response.success && response.data) {
            this.accountsSignal.set(response.data);
            return response.data;
          }
          throw new Error(response.message || 'Failed to load accounts');
        }),
        tap(() => this.loadingSignal.set(false)),
        catchError(error => {
          this.loadingSignal.set(false);
          this.errorSignal.set(error.message || 'Failed to load accounts');
          return throwError(() => error);
        })
      );
  }

  /**
   * Get a single account by ID (replaces Firebase customer document get)
   */
  getAccount(id: number): Observable<Account> {
    return this.http.get<ApiResponse<Account>>(`${this.apiUrl}/accounts/${id}`)
      .pipe(
        map(response => {
          if (response.success && response.data) {
            return response.data;
          }
          throw new Error(response.message || 'Account not found');
        }),
        catchError(error => {
          this.errorSignal.set(error.message || 'Failed to load account');
          return throwError(() => error);
        })
      );
  }

  /**
   * Get all users
   */
  getUsers(): Observable<User[]> {
    return this.http.get<ApiResponse<User[]>>(`${this.apiUrl}/users`)
      .pipe(
        map(response => {
          if (response.success && response.data) {
            return response.data;
          }
          throw new Error(response.message || 'Failed to load users');
        })
      );
  }

  /**
   * Get a single user by ID
   */
  getUser(id: number): Observable<User> {
    return this.http.get<ApiResponse<User>>(`${this.apiUrl}/users/${id}`)
      .pipe(
        map(response => {
          if (response.success && response.data) {
            return response.data;
          }
          throw new Error(response.message || 'User not found');
        })
      );
  }

  /**
   * Get all groups
   */
  getGroups(): Observable<AccountGroup[]> {
    return this.http.get<ApiResponse<AccountGroup[]>>(`${this.apiUrl}/groups`)
      .pipe(
        map(response => {
          if (response.success && response.data) {
            return response.data;
          }
          throw new Error(response.message || 'Failed to load groups');
        })
      );
  }

  /**
   * Get system statistics
   */
  getStats(): Observable<StatsResponse['data']> {
    return this.http.get<StatsResponse>(`${this.apiUrl}/stats`)
      .pipe(
        map(response => {
          if (response.success && response.data) {
            return response.data;
          }
          throw new Error('Failed to load statistics');
        })
      );
  }

  /**
   * Search users and accounts
   */
  search(query: string): Observable<SearchResult> {
    const params = new HttpParams().set('q', query);
    return this.http.get<ApiResponse<SearchResult>>(`${this.apiUrl}/search`, { params })
      .pipe(
        map(response => {
          if (response.success && response.data) {
            return response.data;
          }
          throw new Error(response.message || 'Search failed');
        })
      );
  }

  /**
   * Get credit balance for an account (replaces customers.credits)
   */
  getCreditBalance(accountId: number): Observable<CreditBalance> {
    return this.http.get<ApiResponse<CreditBalance>>(`${this.apiUrl}/credits/balance/${accountId}`)
      .pipe(
        map(response => {
          if (response.success && response.data) {
            return response.data;
          }
          throw new Error(response.message || 'Failed to load credit balance');
        })
      );
  }

  /**
   * Get credit transactions for an account (replaces customers transaction history)
   */
  getCreditTransactions(accountId: number): Observable<CreditTransaction[]> {
    return this.http.get<ApiResponse<CreditTransaction[]>>(`${this.apiUrl}/credits/transactions/${accountId}`)
      .pipe(
        map(response => {
          if (response.success && response.data) {
            return response.data;
          }
          throw new Error(response.message || 'Failed to load transactions');
        })
      );
  }

  /**
   * Clear local state
   */
  clearState(): void {
    this.accountsSignal.set([]);
    this.errorSignal.set(null);
    this.loadingSignal.set(false);
  }
}
