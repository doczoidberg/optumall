import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap, catchError, throwError } from 'rxjs';
import { environment } from '../../environments/environment';
import { AuthUser, LoginRequest, LoginResponse, USER_ROLES } from '../models/user.model';

const TOKEN_KEY = 'jwt_token';
const USER_KEY = 'auth_user';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = environment.licenseManagementApiUrl;

  private currentUserSignal = signal<AuthUser | null>(this.loadUserFromStorage());

  readonly currentUser = this.currentUserSignal.asReadonly();
  readonly isAuthenticated = computed(() => this.currentUserSignal() !== null);
  readonly isAdmin = computed(() => {
    const user = this.currentUserSignal();
    return user !== null && user.role >= USER_ROLES.ADMIN;
  });
  readonly isSuperAdmin = computed(() => {
    const user = this.currentUserSignal();
    return user !== null && user.role === USER_ROLES.SUPERADMIN;
  });

  constructor(
    private http: HttpClient,
    private router: Router
  ) {}

  private loadUserFromStorage(): AuthUser | null {
    if (typeof window === 'undefined') return null;

    const token = localStorage.getItem(TOKEN_KEY);
    const userJson = localStorage.getItem(USER_KEY);

    if (token && userJson) {
      try {
        const user = JSON.parse(userJson) as AuthUser;
        user.token = token;
        return user;
      } catch {
        this.clearStorage();
      }
    }
    return null;
  }

  private clearStorage(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }

  login(credentials: LoginRequest): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.apiUrl}/api/auth/login`, credentials)
      .pipe(
        tap(response => {
          if (response.success && response.token && response.user) {
            localStorage.setItem(TOKEN_KEY, response.token);
            localStorage.setItem(USER_KEY, JSON.stringify(response.user));
            this.currentUserSignal.set({ ...response.user, token: response.token });
          }
        }),
        catchError(error => {
          console.error('Login error:', error);
          return throwError(() => error);
        })
      );
  }

  logout(): void {
    this.clearStorage();
    this.currentUserSignal.set(null);
    this.router.navigate(['/login']);
  }

  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  refreshUser(): Observable<AuthUser> {
    return this.http.get<{ success: boolean; data: AuthUser }>(`${this.apiUrl}/api/profile`)
      .pipe(
        tap(response => {
          if (response.success && response.data) {
            const token = this.getToken();
            if (token) {
              const user = { ...response.data, token };
              localStorage.setItem(USER_KEY, JSON.stringify(user));
              this.currentUserSignal.set(user);
            }
          }
        }),
        catchError(error => {
          if (error.status === 401) {
            this.logout();
          }
          return throwError(() => error);
        })
      ) as Observable<AuthUser>;
  }

  hasRole(requiredRole: number): boolean {
    const user = this.currentUserSignal();
    return user !== null && user.role >= requiredRole;
  }
}
