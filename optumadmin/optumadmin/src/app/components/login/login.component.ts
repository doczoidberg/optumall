import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="login-container">
      <div class="login-card">
        <h1>OptumAdmin</h1>
        <p class="subtitle">Sign in with your account credentials</p>

        @if (error()) {
          <div class="alert alert-error">{{ error() }}</div>
        }

        <form (ngSubmit)="onSubmit()" class="login-form">
          <div class="form-group">
            <label for="username">Email / Username</label>
            <input
              id="username"
              type="text"
              [(ngModel)]="credentials.user_name"
              name="username"
              required
              placeholder="Enter your email"
              [disabled]="loading()"
            />
          </div>

          <div class="form-group">
            <label for="password">Password</label>
            <input
              id="password"
              type="password"
              [(ngModel)]="credentials.password"
              name="password"
              required
              placeholder="Enter your password"
              [disabled]="loading()"
            />
          </div>

          <button type="submit" class="btn btn-primary btn-block" [disabled]="loading()">
            @if (loading()) {
              Signing in...
            } @else {
              Sign In
            }
          </button>
        </form>

        <p class="hint">
          Uses JWT authentication from the License Management API
        </p>
      </div>
    </div>
  `,
  styles: [`
    .login-container {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: 20px;
    }

    .login-card {
      background: white;
      padding: 40px;
      border-radius: 12px;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
      width: 100%;
      max-width: 400px;

      h1 {
        font-size: 28px;
        font-weight: 700;
        color: #333;
        margin-bottom: 8px;
        text-align: center;
      }

      .subtitle {
        color: #666;
        text-align: center;
        margin-bottom: 24px;
      }
    }

    .login-form {
      .form-group {
        margin-bottom: 20px;

        label {
          display: block;
          font-weight: 500;
          margin-bottom: 6px;
          color: #333;
        }

        input {
          width: 100%;
          padding: 12px 14px;
          border: 1px solid #ddd;
          border-radius: 8px;
          font-size: 15px;
          transition: border-color 0.2s, box-shadow 0.2s;

          &:focus {
            outline: none;
            border-color: #667eea;
            box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
          }

          &:disabled {
            background-color: #f5f5f5;
            cursor: not-allowed;
          }
        }
      }
    }

    .btn-block {
      width: 100%;
      padding: 14px;
      font-size: 16px;
      border-radius: 8px;
      margin-top: 8px;

      &:disabled {
        opacity: 0.7;
        cursor: not-allowed;
      }
    }

    .alert {
      margin-bottom: 20px;
    }

    .hint {
      margin-top: 20px;
      font-size: 12px;
      color: #999;
      text-align: center;
    }
  `]
})
export class LoginComponent {
  private authService = inject(AuthService);
  private router = inject(Router);

  credentials = {
    user_name: '',
    password: ''
  };

  loading = signal(false);
  error = signal<string | null>(null);

  onSubmit(): void {
    if (!this.credentials.user_name || !this.credentials.password) {
      this.error.set('Please enter both email and password');
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    this.authService.login(this.credentials).subscribe({
      next: (response) => {
        this.loading.set(false);
        if (response.success) {
          this.router.navigate(['/accounts']);
        } else {
          this.error.set(response.message || 'Login failed');
        }
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err.error?.message || 'Login failed. Please check your credentials.');
      }
    });
  }
}
