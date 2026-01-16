import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AccountsService } from '../../services/accounts.service';

interface Stats {
  total_accounts: number;
  total_users: number;
  total_groups: number;
  total_licenses: number;
  accounts_by_type: {
    individual: number;
    organization: number;
    university: number;
  };
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="dashboard-container">
      <header class="page-header">
        <h1>Dashboard</h1>
        <p class="subtitle">System overview and statistics</p>
      </header>

      @if (loading()) {
        <div class="loading">Loading statistics...</div>
      }

      @if (error()) {
        <div class="alert alert-error">{{ error() }}</div>
      }

      @if (!loading() && stats()) {
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-value">{{ stats()!.total_accounts }}</div>
            <div class="stat-label">Total Accounts</div>
          </div>

          <div class="stat-card">
            <div class="stat-value">{{ stats()!.total_users }}</div>
            <div class="stat-label">Total Users</div>
          </div>

          <div class="stat-card">
            <div class="stat-value">{{ stats()!.total_groups }}</div>
            <div class="stat-label">Total Groups</div>
          </div>

          <div class="stat-card">
            <div class="stat-value">{{ stats()!.total_licenses }}</div>
            <div class="stat-label">Total Licenses</div>
          </div>
        </div>

        <div class="breakdown-card card">
          <h2>Accounts by Type</h2>
          <div class="breakdown-grid">
            <div class="breakdown-item">
              <span class="breakdown-count">{{ stats()!.accounts_by_type.individual }}</span>
              <span class="breakdown-label">Individual</span>
            </div>
            <div class="breakdown-item">
              <span class="breakdown-count">{{ stats()!.accounts_by_type.organization }}</span>
              <span class="breakdown-label">Organization</span>
            </div>
            <div class="breakdown-item">
              <span class="breakdown-count">{{ stats()!.accounts_by_type.university }}</span>
              <span class="breakdown-label">University</span>
            </div>
          </div>
        </div>

        <div class="actions-card card">
          <h2>Quick Actions</h2>
          <div class="actions-grid">
            <a routerLink="/accounts" class="action-btn">
              <span class="action-icon">📋</span>
              <span class="action-text">View Accounts</span>
            </a>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .dashboard-container {
      padding: 24px;
      max-width: 1200px;
      margin: 0 auto;
    }

    .page-header {
      margin-bottom: 32px;

      h1 {
        font-size: 28px;
        font-weight: 600;
        color: #1a1a1a;
        margin-bottom: 4px;
      }

      .subtitle {
        color: #666;
        font-size: 14px;
      }
    }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
      margin-bottom: 24px;
    }

    .stat-card {
      background: white;
      padding: 24px;
      border-radius: 12px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
      text-align: center;

      .stat-value {
        font-size: 36px;
        font-weight: 700;
        color: #007bff;
        margin-bottom: 4px;
      }

      .stat-label {
        font-size: 14px;
        color: #666;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
    }

    .breakdown-card {
      h2 {
        font-size: 18px;
        font-weight: 600;
        margin-bottom: 16px;
        color: #333;
      }
    }

    .breakdown-grid {
      display: flex;
      gap: 32px;

      .breakdown-item {
        display: flex;
        flex-direction: column;

        .breakdown-count {
          font-size: 24px;
          font-weight: 600;
          color: #333;
        }

        .breakdown-label {
          font-size: 13px;
          color: #666;
        }
      }
    }

    .actions-card {
      margin-top: 20px;

      h2 {
        font-size: 18px;
        font-weight: 600;
        margin-bottom: 16px;
        color: #333;
      }
    }

    .actions-grid {
      display: flex;
      gap: 16px;
    }

    .action-btn {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 20px 32px;
      background: #f8f9fa;
      border-radius: 8px;
      text-decoration: none;
      transition: background-color 0.2s;

      &:hover {
        background: #e9ecef;
        text-decoration: none;
      }

      .action-icon {
        font-size: 32px;
        margin-bottom: 8px;
      }

      .action-text {
        font-size: 14px;
        font-weight: 500;
        color: #333;
      }
    }
  `]
})
export class DashboardComponent implements OnInit {
  private accountsService = inject(AccountsService);

  stats = signal<Stats | null>(null);
  loading = signal(true);
  error = signal<string | null>(null);

  ngOnInit(): void {
    this.loadStats();
  }

  loadStats(): void {
    this.loading.set(true);
    this.error.set(null);

    this.accountsService.getStats().subscribe({
      next: (data) => {
        this.stats.set(data);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err.message || 'Failed to load statistics');
        this.loading.set(false);
      }
    });
  }
}
