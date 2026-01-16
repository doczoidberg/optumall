import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, RouterOutlet } from '@angular/router';
import { AuthService } from './services/auth.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterModule, RouterOutlet],
  template: `
    @if (authService.isAuthenticated()) {
      <nav class="navbar">
        <div class="nav-brand">
          <a routerLink="/">OptumAdmin</a>
        </div>
        <div class="nav-links">
          <a routerLink="/accounts" routerLinkActive="active">Accounts</a>
          @if (authService.isAdmin()) {
            <a routerLink="/dashboard" routerLinkActive="active">Dashboard</a>
          }
        </div>
        <div class="nav-user">
          <span class="user-name">{{ authService.currentUser()?.email }}</span>
          <span class="user-role badge" [class]="getRoleBadgeClass()">
            {{ getRoleName() }}
          </span>
          <button class="btn btn-secondary btn-sm" (click)="logout()">Logout</button>
        </div>
      </nav>
    }

    <main>
      <router-outlet></router-outlet>
    </main>
  `,
  styles: [`
    .navbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 24px;
      background: white;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.08);
      position: sticky;
      top: 0;
      z-index: 100;
    }

    .nav-brand a {
      font-size: 20px;
      font-weight: 700;
      color: #333;
      text-decoration: none;

      &:hover {
        color: #007bff;
        text-decoration: none;
      }
    }

    .nav-links {
      display: flex;
      gap: 24px;

      a {
        color: #666;
        text-decoration: none;
        font-weight: 500;
        padding: 8px 4px;
        border-bottom: 2px solid transparent;
        transition: all 0.2s;

        &:hover {
          color: #007bff;
          text-decoration: none;
        }

        &.active {
          color: #007bff;
          border-bottom-color: #007bff;
        }
      }
    }

    .nav-user {
      display: flex;
      align-items: center;
      gap: 12px;

      .user-name {
        color: #666;
        font-size: 14px;
      }

      .badge {
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 11px;
        font-weight: 600;
        text-transform: uppercase;
      }

      .badge-superadmin {
        background: #7c3aed;
        color: white;
      }

      .badge-admin {
        background: #2563eb;
        color: white;
      }

      .badge-user {
        background: #6b7280;
        color: white;
      }
    }

    .btn-sm {
      padding: 6px 12px;
      font-size: 13px;
    }

    main {
      min-height: calc(100vh - 60px);
    }
  `]
})
export class AppComponent {
  authService = inject(AuthService);

  logout(): void {
    this.authService.logout();
  }

  getRoleName(): string {
    const user = this.authService.currentUser();
    if (!user) return '';

    switch (user.role) {
      case 2: return 'Super Admin';
      case 1: return 'Admin';
      default: return 'User';
    }
  }

  getRoleBadgeClass(): string {
    const user = this.authService.currentUser();
    if (!user) return '';

    switch (user.role) {
      case 2: return 'badge-superadmin';
      case 1: return 'badge-admin';
      default: return 'badge-user';
    }
  }
}
