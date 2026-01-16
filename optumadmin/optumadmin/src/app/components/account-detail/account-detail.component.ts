import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { forkJoin } from 'rxjs';
import { AccountsService } from '../../services/accounts.service';
import { Account, getAccountTypeName } from '../../models/account.model';
import { CreditBalance, CreditTransaction } from '../../models/credits.model';

@Component({
  selector: 'app-account-detail',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="account-detail-container">
      <nav class="breadcrumb">
        <a routerLink="/accounts">Accounts</a>
        <span class="separator">/</span>
        <span>{{ account()?.name || 'Loading...' }}</span>
      </nav>

      @if (loading()) {
        <div class="loading">Loading account details...</div>
      }

      @if (error()) {
        <div class="alert alert-error">{{ error() }}</div>
      }

      @if (!loading() && account()) {
        <header class="page-header">
          <div class="header-content">
            <h1>{{ account()!.name }}</h1>
            <span class="badge" [class]="getTypeBadgeClass(account()!.type)">
              {{ getTypeName(account()!.type) }}
            </span>
          </div>
          <p class="account-domain" *ngIf="account()!.domain">{{ account()!.domain }}</p>
        </header>

        <div class="content-grid">
          <!-- Account Info Card -->
          <div class="card info-card">
            <h2>Account Information</h2>
            <dl class="info-list">
              <dt>Account ID</dt>
              <dd>{{ account()!.id }}</dd>

              <dt>Type</dt>
              <dd>{{ getTypeName(account()!.type) }}</dd>

              <dt>Domain</dt>
              <dd>{{ account()!.domain || 'Not set' }}</dd>

              <dt>Created</dt>
              <dd>{{ formatDate(account()!.created_date) }}</dd>

              <dt>Last Seen</dt>
              <dd>{{ account()!._last_seen ? formatDate(account()!._last_seen!) : 'Never' }}</dd>

              <dt>Total Members</dt>
              <dd>{{ account()!.total_members }}</dd>
            </dl>
          </div>

          <!-- Credits Card (replaces customers.credits) -->
          <div class="card credits-card">
            <h2>Credits</h2>
            @if (credits()) {
              <div class="credits-display">
                <div class="credit-stat">
                  <span class="credit-value available">{{ credits()!.available_credits }}</span>
                  <span class="credit-label">Available</span>
                </div>
                <div class="credit-stat">
                  <span class="credit-value used">{{ credits()!.credits_used }}</span>
                  <span class="credit-label">Used</span>
                </div>
                <div class="credit-stat">
                  <span class="credit-value total">{{ credits()!.credits }}</span>
                  <span class="credit-label">Total Purchased</span>
                </div>
              </div>
              @if (credits()!.last_credit_purchase) {
                <p class="last-purchase">
                  Last purchase: {{ formatDate(credits()!.last_credit_purchase!) }}
                </p>
              }
            } @else {
              <p class="no-credits">No credit data available</p>
            }
          </div>

          <!-- Members Card -->
          <div class="card members-card full-width">
            <h2>Members ({{ account()!.members?.length || 0 }})</h2>
            @if (account()!.members && account()!.members!.length > 0) {
              <table class="table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Member ID</th>
                    <th>Role</th>
                  </tr>
                </thead>
                <tbody>
                  @for (member of account()!.members; track member.id) {
                    <tr>
                      <td>{{ member.id }}</td>
                      <td>{{ member.member_id }}</td>
                      <td>
                        <span class="badge" [class]="member.role === 1 ? 'badge-success' : 'badge-info'">
                          {{ member.role_name }}
                        </span>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            } @else {
              <p class="empty-state">No members in this account</p>
            }
          </div>

          <!-- Groups Card -->
          <div class="card groups-card full-width">
            <h2>Groups ({{ account()!.groups?.length || 0 }})</h2>
            @if (account()!.groups && account()!.groups!.length > 0) {
              <table class="table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Name</th>
                    <th>Description</th>
                    <th>Created</th>
                  </tr>
                </thead>
                <tbody>
                  @for (group of account()!.groups; track group.id) {
                    <tr>
                      <td>{{ group.id }}</td>
                      <td>{{ group.name }}</td>
                      <td>{{ group.description || '-' }}</td>
                      <td>{{ formatDate(group.created_date) }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            } @else {
              <p class="empty-state">No groups in this account</p>
            }
          </div>

          <!-- Transactions Card -->
          <div class="card transactions-card full-width">
            <h2>Credit Transactions</h2>
            @if (transactions() && transactions()!.length > 0) {
              <table class="table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Package</th>
                    <th>Credits</th>
                    <th>Amount</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  @for (tx of transactions(); track tx.id) {
                    <tr>
                      <td>{{ formatDate(tx.created_date) }}</td>
                      <td>{{ tx.package_name }}</td>
                      <td>{{ tx.credits }}</td>
                      <td>{{ formatCurrency(tx.amount, tx.currency) }}</td>
                      <td>
                        <span class="badge" [class]="getStatusBadgeClass(tx.status)">
                          {{ tx.status }}
                        </span>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            } @else {
              <p class="empty-state">No transactions yet</p>
            }
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .account-detail-container {
      padding: 24px;
      max-width: 1400px;
      margin: 0 auto;
    }

    .breadcrumb {
      margin-bottom: 20px;
      font-size: 14px;

      a {
        color: #007bff;

        &:hover {
          text-decoration: underline;
        }
      }

      .separator {
        margin: 0 8px;
        color: #999;
      }
    }

    .page-header {
      margin-bottom: 24px;

      .header-content {
        display: flex;
        align-items: center;
        gap: 12px;

        h1 {
          font-size: 28px;
          font-weight: 600;
          color: #1a1a1a;
        }
      }

      .account-domain {
        color: #666;
        margin-top: 4px;
      }
    }

    .content-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;

      .full-width {
        grid-column: 1 / -1;
      }
    }

    .card {
      h2 {
        font-size: 16px;
        font-weight: 600;
        margin-bottom: 16px;
        color: #333;
        border-bottom: 1px solid #eee;
        padding-bottom: 8px;
      }
    }

    .info-list {
      display: grid;
      grid-template-columns: 120px 1fr;
      gap: 8px 16px;

      dt {
        font-weight: 500;
        color: #666;
      }

      dd {
        color: #333;
      }
    }

    .credits-display {
      display: flex;
      gap: 32px;
      margin-bottom: 16px;

      .credit-stat {
        display: flex;
        flex-direction: column;

        .credit-value {
          font-size: 32px;
          font-weight: 700;

          &.available {
            color: #2e7d32;
          }

          &.used {
            color: #c62828;
          }

          &.total {
            color: #1565c0;
          }
        }

        .credit-label {
          font-size: 12px;
          color: #666;
          text-transform: uppercase;
        }
      }
    }

    .last-purchase {
      font-size: 13px;
      color: #666;
    }

    .no-credits {
      color: #999;
      font-style: italic;
    }

    .badge {
      display: inline-block;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 500;
    }

    .badge-individual {
      background-color: #e3f2fd;
      color: #1565c0;
    }

    .badge-organization {
      background-color: #e8f5e9;
      color: #2e7d32;
    }

    .badge-university {
      background-color: #fff3e0;
      color: #e65100;
    }

    .badge-success {
      background-color: #d4edda;
      color: #155724;
    }

    .badge-info {
      background-color: #d1ecf1;
      color: #0c5460;
    }

    .badge-warning {
      background-color: #fff3cd;
      color: #856404;
    }

    .badge-danger {
      background-color: #f8d7da;
      color: #721c24;
    }

    .empty-state {
      color: #999;
      font-style: italic;
      padding: 20px 0;
      text-align: center;
    }
  `]
})
export class AccountDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private accountsService = inject(AccountsService);

  account = signal<Account | null>(null);
  credits = signal<CreditBalance | null>(null);
  transactions = signal<CreditTransaction[] | null>(null);
  loading = signal(true);
  error = signal<string | null>(null);

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (id) {
      this.loadAccountData(id);
    } else {
      this.error.set('Invalid account ID');
      this.loading.set(false);
    }
  }

  loadAccountData(id: number): void {
    this.loading.set(true);
    this.error.set(null);

    // Load account details and credits in parallel
    forkJoin({
      account: this.accountsService.getAccount(id),
      credits: this.accountsService.getCreditBalance(id),
      transactions: this.accountsService.getCreditTransactions(id)
    }).subscribe({
      next: (data) => {
        this.account.set(data.account);
        this.credits.set(data.credits);
        this.transactions.set(data.transactions);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Failed to load account data:', err);
        // Still try to show account even if credits fail
        this.accountsService.getAccount(id).subscribe({
          next: (account) => {
            this.account.set(account);
            this.loading.set(false);
          },
          error: (accountErr) => {
            this.error.set(accountErr.message || 'Failed to load account');
            this.loading.set(false);
          }
        });
      }
    });
  }

  getTypeName(type: number): string {
    return getAccountTypeName(type);
  }

  getTypeBadgeClass(type: number): string {
    switch (type) {
      case 0: return 'badge-individual';
      case 1: return 'badge-organization';
      case 3: return 'badge-university';
      default: return '';
    }
  }

  getStatusBadgeClass(status: string): string {
    switch (status.toLowerCase()) {
      case 'completed':
      case 'success':
        return 'badge-success';
      case 'pending':
        return 'badge-warning';
      case 'failed':
      case 'cancelled':
        return 'badge-danger';
      default:
        return 'badge-info';
    }
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  formatCurrency(amount: number, currency: string): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD'
    }).format(amount);
  }
}
